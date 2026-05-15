import { Router } from "express";
import { db, insertWithId, stripMongoId, stripMongoIds } from "db";
import { authMiddleware } from "../middlewares/auth";
import { CreateStaffBody, UpdateStaffBody, UpdateStaffParams, DeleteStaffParams, } from "api-zod";
const router = Router();
router.get("/staff", authMiddleware, async (req, res) => {
    const staff = await db.staff.find({ userId: req.userId }).sort({ createdAt: 1 }).toArray();
    res.json(stripMongoIds(staff));
});
router.post("/staff", authMiddleware, async (req, res) => {
    const parsed = CreateStaffBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const staff = await insertWithId(db.staff, "staff", { ...parsed.data, userId: req.userId });
    res.status(201).json(staff);
});
router.put("/staff/:id", authMiddleware, async (req, res) => {
    const params = UpdateStaffParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const parsed = UpdateStaffBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const updated = stripMongoId(await db.staff.findOneAndUpdate({ id: params.data.id, userId: req.userId }, { $set: { ...parsed.data, updatedAt: new Date() } }, { returnDocument: "after" }));
    if (!updated) {
        res.status(404).json({ error: "Staff member not found" });
        return;
    }
    res.json(updated);
});
router.delete("/staff/:id", authMiddleware, async (req, res) => {
    const params = DeleteStaffParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const deleted = await db.staff.findOneAndDelete({ id: params.data.id, userId: req.userId });
    if (!deleted) {
        res.status(404).json({ error: "Staff member not found" });
        return;
    }
    res.sendStatus(204);
});
export default router;
//# sourceMappingURL=staff.js.map