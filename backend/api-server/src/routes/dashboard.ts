import { Router, type IRouter } from "express";
import { db, type Invoice, type Order } from "db";
import { GetRevenueChartQueryParams, GetRecentOrdersQueryParams, GetTopProductsQueryParams } from "api-zod";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (date: Date) => date.toLocaleString("en-US", { month: "short", year: "numeric" });

router.get("/dashboard/stats", authMiddleware, async (req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [orders, invoices, customers, products] = await Promise.all([
    db.orders.find({ userId: req.userId! }).toArray(),
    db.invoices.find({ userId: req.userId! }).toArray(),
    db.customers.find({ userId: req.userId! }).toArray(),
    db.products.find({ userId: req.userId! }).toArray(),
  ]);

  const currentOrderRevenue = orders.filter((o) => o.status === "completed" && o.createdAt >= startOfMonth).reduce((sum, o) => sum + Number(o.total), 0);
  const currentInvoiceRevenue = invoices.filter((i) => i.status === "paid" && i.createdAt >= startOfMonth).reduce((sum, i) => sum + Number(i.total), 0);
  const lastOrderRevenue = orders.filter((o) => o.status === "completed" && o.createdAt >= startOfLastMonth && o.createdAt <= endOfLastMonth).reduce((sum, o) => sum + Number(o.total), 0);
  const lastInvoiceRevenue = invoices.filter((i) => i.status === "paid" && i.createdAt >= startOfLastMonth && i.createdAt <= endOfLastMonth).reduce((sum, i) => sum + Number(i.total), 0);

  const totalRevenue = currentOrderRevenue + currentInvoiceRevenue;
  const lastMonthRevenue = lastOrderRevenue + lastInvoiceRevenue;
  const totalOrders = orders.filter((o) => o.createdAt >= startOfMonth).length + invoices.filter((i) => i.createdAt >= startOfMonth).length;
  const lastMonthOrders = orders.filter((o) => o.createdAt >= startOfLastMonth && o.createdAt <= endOfLastMonth).length + invoices.filter((i) => i.createdAt >= startOfLastMonth && i.createdAt <= endOfLastMonth).length;
  const lastMonthCustomers = customers.filter((c) => c.createdAt <= endOfLastMonth).length;
  const newCustomers = customers.length - lastMonthCustomers;

  const revenueGrowth = lastMonthRevenue === 0 ? 100 : ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  const ordersGrowth = lastMonthOrders === 0 ? 100 : ((totalOrders - lastMonthOrders) / lastMonthOrders) * 100;
  const customersGrowth = lastMonthCustomers === 0 ? 100 : (newCustomers / lastMonthCustomers) * 100;

  res.json({
    totalRevenue,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    totalOrders,
    ordersGrowth: Math.round(ordersGrowth * 10) / 10,
    totalCustomers: customers.length,
    customersGrowth: Math.round(customersGrowth * 10) / 10,
    totalProducts: products.filter((p) => p.isActive).length,
    lowStockCount: products.filter((p) => p.stock <= p.minStock).length,
    pendingOrders: orders.filter((o) => o.status === "pending").length + invoices.filter((i) => ["draft", "sent", "overdue"].includes(i.status)).length,
    completedOrdersToday: orders.filter((o) => o.status === "completed" && o.createdAt >= startOfToday).length + invoices.filter((i) => i.status === "paid" && i.createdAt >= startOfToday).length,
  });
});

router.get("/dashboard/revenue-chart", authMiddleware, async (req, res): Promise<void> => {
  const query = GetRevenueChartQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { months } = query.data;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - (months - 1));
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const [orders, invoices] = await Promise.all([
    db.orders.find({ userId: req.userId!, createdAt: { $gte: startDate } }).toArray(),
    db.invoices.find({ userId: req.userId!, createdAt: { $gte: startDate } }).toArray(),
  ]);

  const merged = new Map<string, { month: string; revenue: number; orders: number }>();
  const addRow = (row: Order | Invoice, isRevenue: boolean) => {
    const key = monthKey(row.createdAt);
    const existing = merged.get(key) ?? { month: monthLabel(row.createdAt), revenue: 0, orders: 0 };
    if (isRevenue) existing.revenue += Number(row.total);
    existing.orders += 1;
    merged.set(key, existing);
  };

  orders.forEach((order) => addRow(order, order.status === "completed"));
  invoices.forEach((invoice) => addRow(invoice, invoice.status === "paid"));

  res.json(Array.from(merged.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, row]) => row));
});

router.get("/dashboard/recent-orders", authMiddleware, async (req, res): Promise<void> => {
  const query = GetRecentOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit } = query.data;
  const [orders, invoices] = await Promise.all([
    db.orders.find({ userId: req.userId! }).sort({ createdAt: -1 }).limit(limit).toArray(),
    db.invoices.find({ userId: req.userId! }).sort({ createdAt: -1 }).limit(limit).toArray(),
  ]);

  const rows = await Promise.all([...orders, ...invoices].map(async (row) => {
    const isInvoice = "invoiceNumber" in row;
    const itemCount = isInvoice
      ? await db.invoiceItems.countDocuments({ invoiceId: row.id, userId: req.userId! })
      : await db.orderItems.countDocuments({ orderId: row.id, userId: req.userId! });
    return { ...row, total: Number(row.total), itemCount };
  }));

  res.json(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit));
});

router.get("/dashboard/top-products", authMiddleware, async (req, res): Promise<void> => {
  const query = GetTopProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit } = query.data;
  const [products, categories, orderItems, invoiceItems] = await Promise.all([
    db.products.find({ userId: req.userId! }).toArray(),
    db.categories.find({ userId: req.userId! }).toArray(),
    db.orderItems.find({ userId: req.userId! }).toArray(),
    db.invoiceItems.find({ userId: req.userId! }).toArray(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<number, { id: number; name: string; sku: string; categoryName: string | null; totalSold: number; revenue: number }>();

  for (const item of [...orderItems, ...invoiceItems]) {
    if (!item.productId) continue;
    const product = productById.get(item.productId);
    if (!product) continue;
    const existing = merged.get(product.id) ?? { id: product.id, name: product.name, sku: product.sku, categoryName: product.categoryId ? categoryById.get(product.categoryId) ?? null : null, totalSold: 0, revenue: 0 };
    existing.totalSold += item.quantity;
    existing.revenue += Number(item.subtotal);
    merged.set(product.id, existing);
  }

  res.json(Array.from(merged.values()).sort((a, b) => b.totalSold - a.totalSold).slice(0, limit));
});

router.get("/dashboard/category-breakdown", authMiddleware, async (req, res): Promise<void> => {
  const [products, categories, orderItems, invoiceItems] = await Promise.all([
    db.products.find({ userId: req.userId! }).toArray(),
    db.categories.find({ userId: req.userId! }).toArray(),
    db.orderItems.find({ userId: req.userId! }).toArray(),
    db.invoiceItems.find({ userId: req.userId! }).toArray(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<string, { categoryName: string; revenue: number; orderIds: Set<string> }>();

  for (const item of orderItems) {
    const product = productById.get(item.productId);
    const categoryName = product?.categoryId ? categoryById.get(product.categoryId) ?? "Uncategorized" : "Uncategorized";
    const row = merged.get(categoryName) ?? { categoryName, revenue: 0, orderIds: new Set<string>() };
    row.revenue += Number(item.subtotal);
    row.orderIds.add(`order:${item.orderId}`);
    merged.set(categoryName, row);
  }

  for (const item of invoiceItems) {
    if (!item.productId) continue;
    const product = productById.get(item.productId);
    const categoryName = product?.categoryId ? categoryById.get(product.categoryId) ?? "Uncategorized" : "Uncategorized";
    const row = merged.get(categoryName) ?? { categoryName, revenue: 0, orderIds: new Set<string>() };
    row.revenue += Number(item.subtotal);
    row.orderIds.add(`invoice:${item.invoiceId}`);
    merged.set(categoryName, row);
  }

  const values = Array.from(merged.values());
  const totalRevenue = values.reduce((sum, row) => sum + row.revenue, 0);

  res.json(values.map((row) => ({
    categoryName: row.categoryName,
    revenue: row.revenue,
    orderCount: row.orderIds.size,
    percentage: totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 1000) / 10 : 0,
  })));
});

export default router;
