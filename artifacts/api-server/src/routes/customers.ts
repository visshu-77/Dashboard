import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, customersTable, ordersTable } from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  GetCustomerParams,
  DeleteCustomerParams,
  ListCustomersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const customerWithStats = async (id?: number) => {
  const q = db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      address: customersTable.address,
      createdAt: customersTable.createdAt,
      totalOrders: sql<number>`count(${ordersTable.id})`,
      totalSpent: sql<number>`coalesce(sum(${ordersTable.total}::numeric), 0)`,
    })
    .from(customersTable)
    .leftJoin(ordersTable, eq(customersTable.id, ordersTable.customerId))
    .groupBy(customersTable.id);

  if (id !== undefined) {
    return q.where(eq(customersTable.id, id));
  }
  return q;
};

router.get("/customers", async (req, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, page, limit } = query.data;
  const offset = (page - 1) * limit;

  const where = search ? ilike(customersTable.name, `%${search}%`) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        email: customersTable.email,
        phone: customersTable.phone,
        address: customersTable.address,
        createdAt: customersTable.createdAt,
        totalOrders: sql<number>`count(${ordersTable.id})`,
        totalSpent: sql<number>`coalesce(sum(${ordersTable.total}::numeric), 0)`,
      })
      .from(customersTable)
      .leftJoin(ordersTable, eq(customersTable.id, ordersTable.customerId))
      .where(where)
      .groupBy(customersTable.id)
      .orderBy(customersTable.createdAt)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
  ]);

  res.json({
    items: items.map((c) => ({
      ...c,
      totalOrders: Number(c.totalOrders),
      totalSpent: parseFloat(String(c.totalSpent)),
    })),
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.insert(customersTable).values(parsed.data).returning();

  res.status(201).json({ ...customer, totalOrders: 0, totalSpent: 0 });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await customerWithStats(params.data.id);

  if (!rows[0]) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const c = rows[0];
  res.json({
    ...c,
    totalOrders: Number(c.totalOrders),
    totalSpent: parseFloat(String(c.totalSpent)),
  });
});

router.put("/customers/:id", async (req, res): Promise<void> => {
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

  const [updated] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const rows = await customerWithStats(params.data.id);
  const c = rows[0];
  res.json({
    ...c,
    totalOrders: Number(c.totalOrders),
    totalSpent: parseFloat(String(c.totalSpent)),
  });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(customersTable)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
