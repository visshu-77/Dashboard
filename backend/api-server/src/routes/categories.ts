import { Router, type IRouter } from "express";
import { db, insertWithId, stripMongoId } from "db";
import { CreateCategoryBody } from "api-zod";
import { authMiddleware } from "../middlewares/auth";
import zod from "zod";

const router: IRouter = Router();

const UpdateCategoryBody = zod.object({
  name: zod.string().optional(),
  description: zod.string().optional(),
});

router.get("/categories", authMiddleware, async (req, res): Promise<void> => {
  const categories = await db.categories.find({ userId: req.userId! }).sort({ name: 1 }).toArray();
  const rows = await Promise.all(categories.map(async (category) => ({
    ...stripMongoId(category),
    productCount: await db.products.countDocuments({ userId: req.userId!, categoryId: category.id }),
  })));

  res.json(rows);
});

router.post("/categories", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const category = await insertWithId(db.categories, "categories", { ...parsed.data, userId: req.userId! });

  res.status(201).json({ ...category, productCount: 0 });
});

router.put("/categories/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid category id" });
    return;
  }

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updated = stripMongoId(await db.categories.findOneAndUpdate(
    { id, userId: req.userId! },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: "after" },
  ));

  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const productCount = await db.products.countDocuments({ userId: req.userId!, categoryId: id });

  res.json({ ...updated, productCount });
});

router.delete("/categories/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid category id" });
    return;
  }

  const count = await db.products.countDocuments({ userId: req.userId!, categoryId: id });

  if (count > 0) {
    res.status(409).json({ error: "Cannot delete a category that has products assigned to it" });
    return;
  }

  const deleted = await db.categories.findOneAndDelete({ id, userId: req.userId! });

  if (!deleted) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
