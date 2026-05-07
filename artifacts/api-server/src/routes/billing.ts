import { Router, type IRouter } from "express";
import { eq, sql, desc, and, ilike } from "drizzle-orm";
import { db, invoicesTable, invoiceItemsTable, customersTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

function nextInvoiceNumber(lastNum: string | null): string {
  if (!lastNum) return "INV-0001";
  const match = lastNum.match(/INV-(\d+)/);
  if (!match) return "INV-0001";
  const next = parseInt(match[1], 10) + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}

function formatInvoice(inv: typeof invoicesTable.$inferSelect & { itemCount?: number | string }) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerAddress: inv.customerAddress,
    status: inv.status,
    subtotal: parseFloat(inv.subtotal as string),
    taxRate: parseFloat(inv.taxRate as string),
    taxAmount: parseFloat(inv.taxAmount as string),
    total: parseFloat(inv.total as string),
    notes: inv.notes,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
    itemCount: Number(inv.itemCount ?? 0),
  };
}

// List invoices
router.get("/billing/invoices", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (search) conditions.push(ilike(invoicesTable.customerName, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        customerId: invoicesTable.customerId,
        customerName: invoicesTable.customerName,
        customerEmail: invoicesTable.customerEmail,
        customerAddress: invoicesTable.customerAddress,
        status: invoicesTable.status,
        subtotal: invoicesTable.subtotal,
        taxRate: invoicesTable.taxRate,
        taxAmount: invoicesTable.taxAmount,
        total: invoicesTable.total,
        notes: invoicesTable.notes,
        dueDate: invoicesTable.dueDate,
        paidAt: invoicesTable.paidAt,
        createdAt: invoicesTable.createdAt,
        updatedAt: invoicesTable.updatedAt,
        itemCount: sql<number>`count(${invoiceItemsTable.id})`,
      })
      .from(invoicesTable)
      .leftJoin(invoiceItemsTable, eq(invoicesTable.id, invoiceItemsTable.invoiceId))
      .where(where)
      .groupBy(invoicesTable.id)
      .orderBy(desc(invoicesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(where),
  ]);

  res.json({
    items: items.map(formatInvoice),
    total: Number(countResult[0].count),
    page,
    limit,
  });
});

// Get single invoice with items
router.get("/billing/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));

  res.json({
    ...formatInvoice({ ...invoice, itemCount: items.length }),
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice as string),
      subtotal: parseFloat(item.subtotal as string),
    })),
  });
});

// Create invoice
router.post("/billing/invoices", async (req, res): Promise<void> => {
  const { customerId, customerName, customerEmail, customerAddress, taxRate, notes, dueDate, items } = req.body;

  if (!customerName || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "customerName and at least one item are required" });
    return;
  }

  // Auto-generate invoice number
  const [lastInvoice] = await db
    .select({ invoiceNumber: invoicesTable.invoiceNumber })
    .from(invoicesTable)
    .orderBy(desc(invoicesTable.id))
    .limit(1);

  const invoiceNumber = nextInvoiceNumber(lastInvoice?.invoiceNumber ?? null);

  const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0);
  const rate = parseFloat(taxRate ?? "0") || 0;
  const taxAmount = Math.round(subtotal * rate) / 100;
  const total = subtotal + taxAmount;

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      invoiceNumber,
      customerId: customerId ?? null,
      customerName,
      customerEmail: customerEmail ?? null,
      customerAddress: customerAddress ?? null,
      status: "draft",
      subtotal: subtotal.toFixed(2),
      taxRate: rate.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      notes: notes ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  // Resolve product names/skus for line items
  const productIds = items.filter((i: { productId?: number }) => i.productId).map((i: { productId: number }) => i.productId);
  let productMap = new Map<number, { name: string; sku: string }>();
  if (productIds.length > 0) {
    const products = await db
      .select({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku })
      .from(productsTable)
      .where(sql`${productsTable.id} = ANY(${productIds}::int[])`);
    productMap = new Map(products.map((p) => [p.id, p]));
  }

  const invoiceItems = items.map((item: { productId?: number; productName?: string; sku?: string; description?: string; quantity: number; unitPrice: number }) => {
    const product = item.productId ? productMap.get(item.productId) : null;
    return {
      invoiceId: invoice.id,
      productId: item.productId ?? null,
      productName: item.productName || product?.name || "Custom Item",
      sku: item.sku || product?.sku || null,
      description: item.description ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      subtotal: (item.quantity * item.unitPrice).toFixed(2),
    };
  });

  await db.insert(invoiceItemsTable).values(invoiceItems);

  res.status(201).json({ ...formatInvoice({ ...invoice, itemCount: items.length }), items: invoiceItems });
});

// Update invoice status
router.patch("/billing/invoices/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status } = req.body;
  const validStatuses = ["draft", "sent", "paid", "overdue"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const updateValues: Record<string, unknown> = { status };
  if (status === "paid") updateValues.paidAt = new Date();

  const [updated] = await db
    .update(invoicesTable)
    .set(updateValues)
    .where(eq(invoicesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Invoice not found" }); return; }

  res.json(formatInvoice(updated));
});

// Delete invoice
router.delete("/billing/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const [deleted] = await db.delete(invoicesTable).where(eq(invoicesTable.id, id)).returning();

  if (!deleted) { res.status(404).json({ error: "Invoice not found" }); return; }

  res.json({ success: true });
});

// Billing stats
router.get("/billing/stats", async (_req, res): Promise<void> => {
  const [total, paid, pending, overdue, revenue] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "paid")),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "sent")),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "overdue")),
    db.select({ val: sql<string>`coalesce(sum(total::numeric), 0)` }).from(invoicesTable).where(eq(invoicesTable.status, "paid")),
  ]);

  res.json({
    totalInvoices: Number(total[0].count),
    paidInvoices: Number(paid[0].count),
    pendingInvoices: Number(pending[0].count),
    overdueInvoices: Number(overdue[0].count),
    totalRevenue: parseFloat(revenue[0].val as string),
  });
});

export default router;
