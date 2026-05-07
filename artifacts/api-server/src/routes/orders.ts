import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import {
  CreateOrderBody,
  UpdateOrderBody,
  UpdateOrderParams,
  GetOrderParams,
  ListOrdersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const formatOrder = (order: typeof ordersTable.$inferSelect & { itemCount?: number | string }) => ({
  id: order.id,
  customerId: order.customerId,
  customerName: order.customerName,
  status: order.status,
  total: parseFloat(order.total as string),
  itemCount: Number(order.itemCount ?? 0),
  notes: order.notes,
  createdAt: order.createdAt,
});

router.get("/orders", async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, customerId, page, limit } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (customerId) conditions.push(eq(ordersTable.customerId, customerId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: ordersTable.id,
        customerId: ordersTable.customerId,
        customerName: ordersTable.customerName,
        status: ordersTable.status,
        total: ordersTable.total,
        notes: ordersTable.notes,
        createdAt: ordersTable.createdAt,
        itemCount: sql<number>`count(${orderItemsTable.id})`,
      })
      .from(ordersTable)
      .leftJoin(orderItemsTable, eq(ordersTable.id, orderItemsTable.orderId))
      .where(where)
      .groupBy(ordersTable.id)
      .orderBy(sql`${ordersTable.createdAt} desc`)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where),
  ]);

  res.json({
    items: items.map(formatOrder),
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, ...orderData } = parsed.data;

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const [order] = await db
    .insert(ordersTable)
    .values({ ...orderData, total: total.toString() })
    .returning();

  if (items.length > 0) {
    const productIds = items.map((i) => i.productId);

    const products = await db
      .select({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku })
      .from(productsTable)
      .where(sql`${productsTable.id} = ANY(${productIds}::int[])`);

    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems = items.map((item) => {
      const product = productMap.get(item.productId);
      return {
        orderId: order.id,
        productId: item.productId,
        productName: product?.name ?? "Unknown",
        sku: product?.sku ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        subtotal: (item.quantity * item.unitPrice).toString(),
      };
    });

    await db.insert(orderItemsTable).values(orderItems);
  }

  res.status(201).json({ ...formatOrder(order), itemCount: items.length });
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, params.data.id));

  const formattedItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: parseFloat(item.unitPrice as string),
    subtotal: parseFloat(item.subtotal as string),
  }));

  res.json({
    ...formatOrder({ ...order, itemCount: items.length }),
    items: formattedItems,
  });
});

router.put("/orders/:id", async (req, res): Promise<void> => {
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

  const [updated] = await db
    .update(ordersTable)
    .set(parsed.data)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [itemCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, params.data.id));

  res.json({ ...formatOrder(updated), itemCount: Number(itemCount.count) });
});

export default router;
