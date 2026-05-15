import { Router } from "express";
import { db, insertWithId, stripMongoId } from "db";
import { authMiddleware } from "../middlewares/auth";
const router = Router();
function nextInvoiceNumber(lastNum) {
    if (!lastNum)
        return "INV-0001";
    const match = lastNum.match(/INV-(\d+)/);
    if (!match)
        return "INV-0001";
    return `INV-${String(parseInt(match[1], 10) + 1).padStart(4, "0")}`;
}
function formatInvoice(inv) {
    return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        customerPhone: inv.customerPhone,
        customerAddress: inv.customerAddress,
        staffId: inv.staffId,
        staffName: inv.staffName,
        status: inv.status,
        subtotal: Number(inv.subtotal),
        taxRate: Number(inv.taxRate),
        taxAmount: Number(inv.taxAmount),
        total: Number(inv.total),
        notes: inv.notes,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        itemCount: Number(inv.itemCount ?? 0),
    };
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
router.get("/billing/invoices", authMiddleware, async (req, res) => {
    const status = req.query.status;
    const search = req.query.search;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const filter = { userId: req.userId };
    if (status)
        filter.status = status;
    if (search)
        filter.customerName = { $regex: escapeRegExp(search), $options: "i" };
    const [invoices, total] = await Promise.all([
        db.invoices.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
        db.invoices.countDocuments(filter),
    ]);
    const counts = await Promise.all(invoices.map((invoice) => db.invoiceItems.countDocuments({ invoiceId: invoice.id, userId: req.userId })));
    res.json({ items: invoices.map((invoice, index) => formatInvoice({ ...stripMongoId(invoice), itemCount: counts[index] })), total, page, limit });
});
router.get("/billing/invoices/:id", authMiddleware, async (req, res) => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    const invoice = await db.invoices.findOne({ id, userId: req.userId });
    if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    const items = await db.invoiceItems.find({ invoiceId: id, userId: req.userId }).toArray();
    res.json({
        ...formatInvoice({ ...stripMongoId(invoice), itemCount: items.length }),
        items: items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
        })),
    });
});
router.post("/billing/invoices", authMiddleware, async (req, res) => {
    const { customerId, customerName, customerEmail, customerPhone, customerAddress, staffId, staffName, taxRate, notes, dueDate, items } = req.body;
    if (!customerName || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "customerName and at least one item are required" });
        return;
    }
    let resolvedCustomerId = customerId ?? null;
    let resolvedStaffName = staffName ?? null;
    if (!resolvedCustomerId) {
        let existingCustomer = null;
        if (customerEmail) {
            existingCustomer = await db.customers.findOne({ email: customerEmail, userId: req.userId }, { projection: { id: 1 } });
        }
        if (!existingCustomer) {
            existingCustomer = await db.customers.findOne({ name: { $regex: `^${escapeRegExp(customerName.trim())}$`, $options: "i" }, userId: req.userId }, { projection: { id: 1 } });
        }
        if (existingCustomer) {
            resolvedCustomerId = existingCustomer.id;
            if (customerPhone) {
                await db.customers.updateOne({ id: resolvedCustomerId, userId: req.userId }, { $set: { phone: customerPhone, updatedAt: new Date() } });
            }
        }
        else {
            const newCustomer = await insertWithId(db.customers, "customers", {
                name: customerName.trim(),
                email: customerEmail ?? null,
                phone: customerPhone ?? null,
                address: customerAddress ?? null,
                userId: req.userId,
            });
            resolvedCustomerId = newCustomer.id;
        }
    }
    if (staffId && !resolvedStaffName) {
        const staff = await db.staff.findOne({ id: staffId, userId: req.userId }, { projection: { name: 1 } });
        resolvedStaffName = staff?.name ?? null;
    }
    const productIds = items.filter((i) => i.productId).map((i) => i.productId);
    const products = productIds.length > 0
        ? await db.products.find({ id: { $in: productIds }, userId: req.userId }, { projection: { id: 1, name: 1, sku: 1, stock: 1 } }).toArray()
        : [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    const mergedItems = new Map();
    for (const item of items) {
        if (!item.productId)
            continue;
        const existing = mergedItems.get(item.productId);
        if (existing)
            existing.quantity += item.quantity;
        else
            mergedItems.set(item.productId, { productId: item.productId, productName: item.productName, sku: item.sku, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice });
    }
    for (const [productId, item] of mergedItems) {
        const product = productMap.get(productId);
        if (!product) {
            res.status(400).json({ error: `Product not found for item: ${item.productName ?? productId}` });
            return;
        }
        if (item.quantity > product.stock) {
            res.status(400).json({ error: `Only ${product.stock} unit(s) available for ${product.name}` });
            return;
        }
    }
    const lastInvoice = await db.invoices.find({ userId: req.userId }).sort({ id: -1 }).limit(1).next();
    const invoiceNumber = nextInvoiceNumber(lastInvoice?.invoiceNumber ?? null);
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const rate = parseFloat(taxRate ?? "0") || 0;
    const taxAmount = Math.round(subtotal * rate * 100) / 10000;
    const total = subtotal + taxAmount;
    const invoice = await insertWithId(db.invoices, "invoices", {
        invoiceNumber,
        customerId: resolvedCustomerId,
        customerName: customerName.trim(),
        customerEmail: customerEmail ?? null,
        customerPhone: customerPhone ?? null,
        customerAddress: customerAddress ?? null,
        staffId: staffId ?? null,
        staffName: resolvedStaffName,
        status: "draft",
        subtotal: Number(subtotal.toFixed(2)),
        taxRate: Number(rate.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes: notes ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAt: null,
        userId: req.userId,
    });
    const invoiceItems = await Promise.all(Array.from(mergedItems.values()).map((item) => {
        const product = productMap.get(item.productId);
        return insertWithId(db.invoiceItems, "invoiceItems", {
            userId: req.userId,
            invoiceId: invoice.id,
            productId: item.productId ?? null,
            productName: item.productName || product?.name || "Custom Item",
            sku: item.sku || product?.sku || null,
            description: item.description ?? null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice.toFixed(2)),
            subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
        });
    }));
    await Promise.all(invoiceItems.map((item) => item.productId
        ? db.products.updateOne({ id: item.productId, userId: req.userId }, { $inc: { stock: -item.quantity }, $set: { updatedAt: new Date() } })
        : Promise.resolve()));
    res.status(201).json({ ...formatInvoice({ ...invoice, itemCount: items.length }), items: invoiceItems, customerAutoCreated: !customerId });
});
router.patch("/billing/invoices/:id/status", authMiddleware, async (req, res) => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    const { status } = req.body;
    const validStatuses = ["draft", "sent", "paid", "overdue"];
    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
        return;
    }
    const updateValues = { status, updatedAt: new Date() };
    if (status === "paid")
        updateValues.paidAt = new Date();
    const updated = await db.invoices.findOneAndUpdate({ id, userId: req.userId }, { $set: updateValues }, { returnDocument: "after" });
    if (!updated) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    res.json(formatInvoice(stripMongoId(updated)));
});
router.delete("/billing/invoices/:id", authMiddleware, async (req, res) => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    const invoiceExists = await db.invoices.findOne({ id, userId: req.userId }, { projection: { id: 1 } });
    if (!invoiceExists) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    const invoiceItems = await db.invoiceItems.find({ invoiceId: id, userId: req.userId }).toArray();
    await Promise.all(invoiceItems.map((item) => item.productId
        ? db.products.updateOne({ id: item.productId, userId: req.userId }, { $inc: { stock: item.quantity }, $set: { updatedAt: new Date() } })
        : Promise.resolve()));
    await db.invoiceItems.deleteMany({ invoiceId: id, userId: req.userId });
    const deleted = await db.invoices.findOneAndDelete({ id, userId: req.userId });
    if (!deleted) {
        res.status(404).json({ error: "Invoice not found" });
        return;
    }
    res.json({ success: true });
});
router.get("/billing/stats", authMiddleware, async (req, res) => {
    const invoices = await db.invoices.find({ userId: req.userId }).toArray();
    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
    res.json({
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        pendingInvoices: invoices.filter((invoice) => invoice.status === "sent").length,
        overdueInvoices: invoices.filter((invoice) => invoice.status === "overdue").length,
        totalRevenue: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0),
    });
});
export default router;
//# sourceMappingURL=billing.js.map