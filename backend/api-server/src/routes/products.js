import { Router } from "express";
import multer from "multer";
import path from "path";
import { db, insertWithId, stripMongoId } from "db";
import { CreateProductBody, UpdateProductBody, UpdateProductParams, GetProductParams, DeleteProductParams, ListProductsQueryParams, } from "api-zod";
import { parseCSVFile, parseExcelFile, validateProductRow } from "../lib/file-parser";
import { authMiddleware } from "../middlewares/auth";
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if ([".csv", ".xlsx", ".xls"].includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type"));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildProductFilter = (userId, query) => {
    const filter = { userId };
    if (query.search)
        filter.name = { $regex: escapeRegExp(query.search), $options: "i" };
    if (query.categoryId)
        filter.categoryId = query.categoryId;
    if (query.lowStock)
        filter.$expr = { $lte: ["$stock", "$minStock"] };
    return filter;
};
const categoryMapForProducts = async (userId, products) => {
    const categoryIds = [...new Set(products.map((p) => p.categoryId).filter((id) => typeof id === "number"))];
    if (categoryIds.length === 0)
        return new Map();
    const categories = await db.categories.find({ userId, id: { $in: categoryIds } }).toArray();
    return new Map(categories.map((category) => [category.id, stripMongoId(category)]));
};
const withCategoryNames = async (userId, products) => {
    const categoryById = await categoryMapForProducts(userId, products);
    return products.map((product) => ({
        ...stripMongoId(product),
        categoryName: product.categoryId ? categoryById.get(product.categoryId)?.name ?? null : null,
    }));
};
const toCreateProductDbValues = (product) => ({
    ...product,
    description: product.description ?? null,
    minStock: product.minStock ?? 5,
    categoryId: product.categoryId ?? null,
    brand: product.brand ?? null,
    imageUrl: product.imageUrl ?? null,
    isActive: product.isActive ?? true,
});
const toUpdateProductDbValues = (product) => {
    const values = {};
    if (product.name !== undefined)
        values.name = product.name;
    if (product.sku !== undefined)
        values.sku = product.sku;
    if (product.description !== undefined)
        values.description = product.description;
    if (product.price !== undefined)
        values.price = product.price;
    if (product.cost !== undefined)
        values.cost = product.cost;
    if (product.stock !== undefined)
        values.stock = product.stock;
    if (product.minStock !== undefined)
        values.minStock = product.minStock;
    if (product.categoryId !== undefined)
        values.categoryId = product.categoryId ?? null;
    if (product.brand !== undefined)
        values.brand = product.brand;
    if (product.imageUrl !== undefined)
        values.imageUrl = product.imageUrl;
    if (product.isActive !== undefined)
        values.isActive = product.isActive;
    return values;
};
const escapeCSVValue = (value) => {
    if (value === null || value === undefined)
        return "";
    const stringValue = String(value);
    if (stringValue.includes("\n") || stringValue.includes(",") || stringValue.includes("\"")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};
router.get("/products/export", authMiddleware, async (req, res) => {
    const query = ListProductsQueryParams.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: query.error.message });
        return;
    }
    const filter = buildProductFilter(req.userId, query.data);
    const products = await db.products.find(filter).sort({ createdAt: 1, id: 1 }).toArray();
    const items = await withCategoryNames(req.userId, products);
    const headers = ["name", "sku", "description", "price", "cost", "stock", "minStock", "categoryName", "brand", "imageUrl", "isActive"];
    const csv = [
        headers.join(","),
        ...items.map((product) => headers.map((header) => escapeCSVValue(product[header])).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv;charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="products-export.csv"');
    res.send(csv);
});
router.get("/products", authMiddleware, async (req, res) => {
    const query = ListProductsQueryParams.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: query.error.message });
        return;
    }
    const { page, limit } = query.data;
    const offset = (page - 1) * limit;
    const filter = buildProductFilter(req.userId, query.data);
    const [products, total] = await Promise.all([
        db.products.find(filter).sort({ createdAt: 1, id: 1 }).skip(offset).limit(limit).toArray(),
        db.products.countDocuments(filter),
    ]);
    res.json({ items: await withCategoryNames(req.userId, products), total, page, limit });
});
router.post("/products", authMiddleware, async (req, res) => {
    const parsed = CreateProductBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const product = await insertWithId(db.products, "products", {
        ...toCreateProductDbValues(parsed.data),
        userId: req.userId,
    });
    const [withCategory] = await withCategoryNames(req.userId, [product]);
    res.status(201).json(withCategory);
});
router.get("/products/download-template", (_req, res) => {
    const csv = `name,sku,description,price,cost,stock,minStock,categoryName,brand,imageUrl,isActive
Sample Product 1,SKU-001,A sample product,99.99,49.99,100,5,Electronics,Brand A,,true
Sample Product 2,SKU-002,Another sample,149.99,74.99,50,10,Accessories,Brand B,,true`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="products-template.csv"');
    res.send(csv);
});
router.get("/products/:id", authMiddleware, async (req, res) => {
    const params = GetProductParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const product = await db.products.findOne({ id: params.data.id, userId: req.userId });
    if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
    }
    const [withCategory] = await withCategoryNames(req.userId, [product]);
    res.json(withCategory);
});
router.put("/products/:id", authMiddleware, async (req, res) => {
    const params = UpdateProductParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const parsed = UpdateProductBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const updated = await db.products.findOneAndUpdate({ id: params.data.id, userId: req.userId }, { $set: { ...toUpdateProductDbValues(parsed.data), updatedAt: new Date() } }, { returnDocument: "after" });
    if (!updated) {
        res.status(404).json({ error: "Product not found" });
        return;
    }
    const [withCategory] = await withCategoryNames(req.userId, [updated]);
    res.json(withCategory);
});
router.delete("/products/:id", authMiddleware, async (req, res) => {
    const params = DeleteProductParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const deleted = await db.products.findOneAndDelete({ id: params.data.id, userId: req.userId });
    if (!deleted) {
        res.status(404).json({ error: "Product not found" });
        return;
    }
    res.sendStatus(204);
});
router.post("/products/bulk-upload", authMiddleware, upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    const fileExt = req.file.originalname.split(".").pop()?.toLowerCase();
    const isCSV = fileExt === "csv";
    const isExcel = ["xlsx", "xls"].includes(fileExt || "");
    if (!isCSV && !isExcel) {
        res.status(400).json({ error: "File must be CSV or Excel format (.csv, .xlsx, .xls)" });
        return;
    }
    try {
        const rows = isCSV ? parseCSVFile(req.file.buffer) : parseExcelFile(req.file.buffer);
        if (rows.length === 0) {
            res.status(400).json({ error: "No data found in file" });
            return;
        }
        const validationErrors = [];
        const validRows = rows.filter((row, index) => {
            const validation = validateProductRow(row, index + 2);
            if (!validation.valid) {
                validationErrors.push(...validation.errors);
                return false;
            }
            return true;
        });
        if (validRows.length === 0) {
            res.status(400).json({ error: "No valid rows found", details: validationErrors });
            return;
        }
        const skuSet = new Set();
        const duplicateSKUs = validRows.filter((row) => {
            if (skuSet.has(row.sku))
                return true;
            skuSet.add(row.sku);
            return false;
        });
        if (duplicateSKUs.length > 0) {
            res.status(400).json({ error: "Duplicate SKUs found in file", duplicates: duplicateSKUs.map((r) => r.sku) });
            return;
        }
        const existingSKUs = await db.products
            .find({ userId: req.userId, sku: { $in: validRows.map((row) => row.sku) } }, { projection: { sku: 1 } })
            .toArray();
        if (existingSKUs.length > 0) {
            res.status(400).json({ error: "Some SKUs already exist in database", existing: existingSKUs.map((r) => r.sku) });
            return;
        }
        const categoryIds = [...new Set(validRows.map((row) => row.categoryId).filter((value) => value !== undefined))];
        const categoryNames = [...new Set(validRows.map((row) => row.categoryName?.trim()).filter((value) => Boolean(value)))];
        const categoryFilters = [];
        if (categoryIds.length > 0)
            categoryFilters.push({ id: { $in: categoryIds } });
        if (categoryNames.length > 0)
            categoryFilters.push({ name: { $in: categoryNames } });
        const existingCategoryRows = categoryFilters.length > 0
            ? await db.categories.find({ userId: req.userId, $or: categoryFilters }).toArray()
            : [];
        const categoryByName = new Map(existingCategoryRows.map((c) => [c.name.trim().toLowerCase(), stripMongoId(c)]));
        const categoryById = new Map(existingCategoryRows.map((c) => [c.id, stripMongoId(c)]));
        const missingNames = categoryNames.filter((name) => !categoryByName.has(name.trim().toLowerCase()));
        for (const name of missingNames) {
            const category = await insertWithId(db.categories, "categories", { name, userId: req.userId, description: null });
            categoryByName.set(category.name.trim().toLowerCase(), category);
            categoryById.set(category.id, category);
        }
        const categoryErrors = [];
        const resolvedRows = validRows.map((row, index) => {
            const rowNumber = index + 2;
            const normalizedCategoryName = row.categoryName?.trim().toLowerCase();
            const categoryFromName = normalizedCategoryName ? categoryByName.get(normalizedCategoryName) : undefined;
            const categoryFromId = row.categoryId !== undefined ? categoryById.get(row.categoryId) : undefined;
            if (row.categoryId !== undefined && !categoryFromId) {
                categoryErrors.push(`Row ${rowNumber}: categoryId ${row.categoryId} does not exist. Use a valid categoryId or provide categoryName only.`);
            }
            if (categoryFromId && categoryFromName && categoryFromId.id !== categoryFromName.id) {
                categoryErrors.push(`Row ${rowNumber}: categoryId ${row.categoryId} does not match categoryName "${row.categoryName}".`);
            }
            return { ...row, resolvedCategoryId: categoryFromName?.id ?? categoryFromId?.id ?? null };
        });
        if (categoryErrors.length > 0) {
            res.status(400).json({ error: "Some category references are invalid", details: categoryErrors });
            return;
        }
        const insertedProducts = await Promise.all(resolvedRows.map((row) => insertWithId(db.products, "products", {
            userId: req.userId,
            name: row.name,
            sku: row.sku,
            description: row.description || null,
            price: row.price,
            cost: row.cost,
            stock: row.stock,
            minStock: row.minStock || 5,
            categoryId: row.resolvedCategoryId,
            brand: row.brand || null,
            imageUrl: row.imageUrl || null,
            isActive: row.isActive !== false,
        })));
        res.status(201).json({
            success: true,
            imported: insertedProducts.length,
            skipped: rows.length - insertedProducts.length,
            validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
            products: await withCategoryNames(req.userId, insertedProducts),
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to process file", message: error instanceof Error ? error.message : "Unknown error" });
    }
});
export default router;
//# sourceMappingURL=products.js.map