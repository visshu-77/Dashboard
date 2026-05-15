import { Router, type IRouter } from "express";
import { db, insertWithId, stripMongoId, type Order } from "db";
import { authMiddleware } from "../middlewares/auth";
import {
  CreateOrderBody,
  UpdateOrderBody,
  UpdateOrderParams,
  GetOrderParams,
  ListOrdersQueryParams,
} from "api-zod";

const router: IRouter = Router();

type FormattableOrder = Pick<Order, "id" | "customerId" | "customerName" | "status" | "total" | "notes" | "createdAt"> & {
  itemCount?: number | string;
};

const formatOrder = (order: FormattableOrder) => ({
  id: order.id,
  customerId: order.customerId,
  customerName: order.customerName,
  status: order.status,
  total: Number(order.total),
  itemCount: Number(order.itemCount ?? 0),
  notes: order.notes,
  createdAt: order.createdAt,
});

router.get("/orders", authMiddleware, async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, customerId, page, limit } = query.data;
  const offset = (page - 1) * limit;
  const filter: Partial<Order> = { userId: req.userId! };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;

  const [orders, total] = await Promise.all([
    db.orders.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    db.orders.countDocuments(filter),
  ]);

  const itemCounts = await Promise.all(orders.map((order) => db.orderItems.countDocuments({ orderId: order.id })));

  res.json({
    items: orders.map((order, index) => formatOrder({ ...stripMongoId(order), itemCount: itemCounts[index] })),
    total,
    page,
    limit,
  });
});

router.post("/orders", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, ...orderData } = parsed.data;
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const order = await insertWithId(db.orders, "orders", { ...orderData, total, userId: req.userId! });

  if (items.length > 0) {
    const products = await db.products.find({ id: { $in: items.map((i) => i.productId) }, userId: req.userId! }).toArray();
    const productMap = new Map(products.map((p) => [p.id, p]));

    await Promise.all(items.map((item) => {
      const product = productMap.get(item.productId);
      return insertWithId(db.orderItems, "orderItems", {
        userId: req.userId!,
        orderId: order.id,
        productId: item.productId,
        productName: product?.name ?? "Unknown",
        sku: product?.sku ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
      });
    }));
  }

  res.status(201).json({ ...formatOrder(order), itemCount: items.length });
});

router.get("/orders/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const order = await db.orders.findOne({ id: params.data.id, userId: req.userId! });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db.orderItems.find({ orderId: params.data.id, userId: req.userId! }).toArray();
  const formattedItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    subtotal: Number(item.subtotal),
  }));

  res.json({ ...formatOrder({ ...stripMongoId(order), itemCount: items.length }), items: formattedItems });
});

router.put("/orders/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updated = await db.orders.findOneAndUpdate(
    { id: params.data.id, userId: req.userId! },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const itemCount = await db.orderItems.countDocuments({ orderId: params.data.id, userId: req.userId! });
  res.json({ ...formatOrder(stripMongoId(updated)), itemCount });
});

export default router;
