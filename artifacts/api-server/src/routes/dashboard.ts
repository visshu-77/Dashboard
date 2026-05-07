import { Router, type IRouter } from "express";
import { eq, sql, lte, gte, and } from "drizzle-orm";
import { db, productsTable, ordersTable, customersTable, orderItemsTable, categoriesTable } from "@workspace/db";
import { GetRevenueChartQueryParams, GetRecentOrdersQueryParams, GetTopProductsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalRevenueResult,
    lastMonthRevenueResult,
    totalOrdersResult,
    lastMonthOrdersResult,
    totalCustomersResult,
    lastMonthCustomersResult,
    totalProductsResult,
    lowStockResult,
    pendingOrdersResult,
    completedTodayResult,
  ] = await Promise.all([
    db.select({ val: sql<string>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, startOfMonth))),
    db.select({ val: sql<string>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, startOfLastMonth), lte(ordersTable.createdAt, endOfLastMonth))),
    db.select({ val: sql<number>`count(*)` }).from(ordersTable).where(gte(ordersTable.createdAt, startOfMonth)),
    db.select({ val: sql<number>`count(*)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, startOfLastMonth), lte(ordersTable.createdAt, endOfLastMonth))),
    db.select({ val: sql<number>`count(*)` }).from(customersTable),
    db.select({ val: sql<number>`count(*)` }).from(customersTable).where(lte(customersTable.createdAt, endOfLastMonth)),
    db.select({ val: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.isActive, true)),
    db.select({ val: sql<number>`count(*)` }).from(productsTable).where(lte(productsTable.stock, productsTable.minStock)),
    db.select({ val: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
    db.select({ val: sql<number>`count(*)` }).from(ordersTable).where(and(eq(ordersTable.status, "completed"), gte(ordersTable.createdAt, startOfToday))),
  ]);

  const totalRevenue = parseFloat(totalRevenueResult[0].val as string);
  const lastMonthRevenue = parseFloat(lastMonthRevenueResult[0].val as string);
  const totalOrders = Number(totalOrdersResult[0].val);
  const lastMonthOrders = Number(lastMonthOrdersResult[0].val);
  const totalCustomers = Number(totalCustomersResult[0].val);
  const lastMonthCustomers = Number(lastMonthCustomersResult[0].val);

  const revenueGrowth = lastMonthRevenue === 0 ? 100 : ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  const ordersGrowth = lastMonthOrders === 0 ? 100 : ((totalOrders - lastMonthOrders) / lastMonthOrders) * 100;
  const newCustomers = totalCustomers - lastMonthCustomers;
  const customersGrowth = lastMonthCustomers === 0 ? 100 : (newCustomers / lastMonthCustomers) * 100;

  res.json({
    totalRevenue,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    totalOrders,
    ordersGrowth: Math.round(ordersGrowth * 10) / 10,
    totalCustomers,
    customersGrowth: Math.round(customersGrowth * 10) / 10,
    totalProducts: Number(totalProductsResult[0].val),
    lowStockCount: Number(lowStockResult[0].val),
    pendingOrders: Number(pendingOrdersResult[0].val),
    completedOrdersToday: Number(completedTodayResult[0].val),
  });
});

router.get("/dashboard/revenue-chart", async (req, res): Promise<void> => {
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

  const rows = await db
    .select({
      month: sql<string>`to_char(${ordersTable.createdAt}, 'Mon YYYY')`,
      monthOrder: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM')`,
      revenue: sql<string>`coalesce(sum(case when ${ordersTable.status} = 'completed' then ${ordersTable.total}::numeric else 0 end), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, startDate))
    .groupBy(sql`to_char(${ordersTable.createdAt}, 'Mon YYYY'), to_char(${ordersTable.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM')`);

  res.json(rows.map((r) => ({
    month: r.month,
    revenue: parseFloat(r.revenue as string),
    orders: Number(r.orders),
  })));
});

router.get("/dashboard/recent-orders", async (req, res): Promise<void> => {
  const query = GetRecentOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit } = query.data;

  const rows = await db
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
    .groupBy(ordersTable.id)
    .orderBy(sql`${ordersTable.createdAt} desc`)
    .limit(limit);

  res.json(rows.map((r) => ({
    ...r,
    total: parseFloat(r.total as string),
    itemCount: Number(r.itemCount),
  })));
});

router.get("/dashboard/top-products", async (req, res): Promise<void> => {
  const query = GetTopProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit } = query.data;

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryName: categoriesTable.name,
      totalSold: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
      revenue: sql<string>`coalesce(sum(${orderItemsTable.subtotal}::numeric), 0)`,
    })
    .from(productsTable)
    .leftJoin(orderItemsTable, eq(productsTable.id, orderItemsTable.productId))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(productsTable.id, categoriesTable.name)
    .orderBy(sql`coalesce(sum(${orderItemsTable.quantity}), 0) desc`)
    .limit(limit);

  res.json(rows.map((r) => ({
    ...r,
    totalSold: Number(r.totalSold),
    revenue: parseFloat(r.revenue as string),
  })));
});

router.get("/dashboard/category-breakdown", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      categoryName: sql<string>`coalesce(${categoriesTable.name}, 'Uncategorized')`,
      revenue: sql<string>`coalesce(sum(${orderItemsTable.subtotal}::numeric), 0)`,
      orderCount: sql<number>`count(distinct ${orderItemsTable.orderId})`,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(orderItemsTable, eq(productsTable.id, orderItemsTable.productId))
    .groupBy(sql`coalesce(${categoriesTable.name}, 'Uncategorized')`);

  const totalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.revenue as string), 0);

  const result = rows.map((r) => ({
    categoryName: r.categoryName,
    revenue: parseFloat(r.revenue as string),
    orderCount: Number(r.orderCount),
    percentage: totalRevenue > 0 ? Math.round((parseFloat(r.revenue as string) / totalRevenue) * 1000) / 10 : 0,
  }));

  res.json(result);
});

export default router;
