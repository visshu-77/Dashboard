import { Router } from "express";
import { db, insertWithId, stripMongoId } from "db";
import { authMiddleware } from "../middlewares/auth";
import { CreateCustomerBody, UpdateCustomerBody, UpdateCustomerParams, GetCustomerParams, DeleteCustomerParams, ListCustomersQueryParams, } from "api-zod";
const router = Router();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getCustomerStats = async (customerId, userId) => {
    const [orders, invoices] = await Promise.all([
        db.orders.find({ customerId, userId }, { projection: { total: 1 } }).toArray(),
        db.invoices.find({ customerId, userId }, { projection: { total: 1 } }).toArray(),
    ]);
    return {
        totalOrders: orders.length + invoices.length,
        totalSpent: [...orders, ...invoices].reduce((sum, item) => sum + Number(item.total), 0),
    };
};
const withStats = async (customer, userId) => ({
    ...stripMongoId(customer),
    ...await getCustomerStats(customer.id, userId),
});
router.get("/customers", authMiddleware, async (req, res) => {
    const query = ListCustomersQueryParams.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: query.error.message });
        return;
    }
    const { search, page, limit } = query.data;
    const offset = (page - 1) * limit;
    const filter = { userId: req.userId };
    if (search)
        filter.name = { $regex: escapeRegExp(search), $options: "i" };
    const [customers, total] = await Promise.all([
        db.customers.find(filter).sort({ createdAt: 1 }).skip(offset).limit(limit).toArray(),
        db.customers.countDocuments(filter),
    ]);
    res.json({ items: await Promise.all(customers.map((customer) => withStats(customer, req.userId))), total, page, limit });
});
router.post("/customers", authMiddleware, async (req, res) => {
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const customer = await insertWithId(db.customers, "customers", { ...parsed.data, userId: req.userId });
    res.status(201).json({ ...customer, totalOrders: 0, totalSpent: 0 });
});
router.get("/customers/:id/history", authMiddleware, async (req, res) => {
    const params = GetCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const customerId = params.data.id;
    const customerExists = await db.customers.findOne({ id: customerId, userId: req.userId }, { projection: { id: 1 } });
    if (!customerExists) {
        res.status(404).json({ error: "Customer not found" });
        return;
    }
    const [orders, invoices, orderItems, invoiceItems] = await Promise.all([
        db.orders.find({ customerId, userId: req.userId }).sort({ createdAt: -1 }).toArray(),
        db.invoices.find({ customerId, userId: req.userId }).sort({ createdAt: -1 }).toArray(),
        db.orderItems.find({ userId: req.userId }).toArray(),
        db.invoiceItems.find({ userId: req.userId }).toArray(),
    ]);
    const orderProductMap = new Map();
    for (const item of orderItems.filter((item) => orders.some((order) => order.id === item.orderId))) {
        const list = orderProductMap.get(item.orderId) ?? [];
        list.push(item.productName);
        orderProductMap.set(item.orderId, list);
    }
    const invoiceProductMap = new Map();
    for (const item of invoiceItems.filter((item) => invoices.some((invoice) => invoice.id === item.invoiceId))) {
        const list = invoiceProductMap.get(item.invoiceId) ?? [];
        list.push(item.productName);
        invoiceProductMap.set(item.invoiceId, list);
    }
    const history = [
        ...orders.map((order) => ({
            id: order.id,
            reference: `ORD-${order.id}`,
            type: "order",
            customerId: order.customerId,
            customerName: order.customerName,
            status: order.status,
            total: Number(order.total),
            notes: order.notes,
            createdAt: order.createdAt,
            itemCount: orderProductMap.get(order.id)?.length ?? 0,
            productNames: orderProductMap.get(order.id) ?? [],
        })),
        ...invoices.map((invoice) => ({
            id: invoice.id,
            reference: invoice.invoiceNumber,
            type: "invoice",
            customerId: invoice.customerId,
            customerName: invoice.customerName,
            status: invoice.status,
            total: Number(invoice.total),
            notes: invoice.notes,
            createdAt: invoice.createdAt,
            itemCount: invoiceProductMap.get(invoice.id)?.length ?? 0,
            productNames: invoiceProductMap.get(invoice.id) ?? [],
        })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ items: history });
});
router.get("/customers/:id", authMiddleware, async (req, res) => {
    const params = GetCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const customer = await db.customers.findOne({ id: params.data.id, userId: req.userId });
    if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
    }
    res.json(await withStats(customer, req.userId));
});
router.put("/customers/:id", authMiddleware, async (req, res) => {
    const params = UpdateCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const parsed = UpdateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
    }
    const updated = await db.customers.findOneAndUpdate({ id: params.data.id, userId: req.userId }, { $set: { ...parsed.data, updatedAt: new Date() } }, { returnDocument: "after" });
    if (!updated) {
        res.status(404).json({ error: "Customer not found" });
        return;
    }
    res.json(await withStats(updated, req.userId));
});
router.delete("/customers/:id", authMiddleware, async (req, res) => {
    const params = DeleteCustomerParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
    }
    const deleted = await db.customers.findOneAndDelete({ id: params.data.id, userId: req.userId });
    if (!deleted) {
        res.status(404).json({ error: "Customer not found" });
        return;
    }
    res.sendStatus(204);
});
export default router;
//# sourceMappingURL=customers.js.map