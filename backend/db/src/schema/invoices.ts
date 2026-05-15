import { z } from "zod/v4";

export const insertInvoiceSchema = z.object({
  userId: z.number(),
  invoiceNumber: z.string(),
  customerId: z.number().nullish(),
  customerName: z.string(),
  customerEmail: z.string().nullish(),
  customerPhone: z.string().nullish(),
  customerAddress: z.string().nullish(),
  staffId: z.number().nullish(),
  staffName: z.string().nullish(),
  logoUrl: z.string().nullish(),
  status: z.string().default("draft"),
  subtotal: z.number().default(0),
  taxRate: z.number().default(0),
  taxAmount: z.number().default(0),
  total: z.number().default(0),
  notes: z.string().nullish(),
  dueDate: z.date().nullish(),
  paidAt: z.date().nullish(),
});

export const insertInvoiceItemSchema = z.object({
  userId: z.number(),
  invoiceId: z.number(),
  productId: z.number().nullish(),
  productName: z.string(),
  sku: z.string().nullish(),
  description: z.string().nullish(),
  quantity: z.number().default(1),
  unitPrice: z.number(),
  subtotal: z.number(),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type Invoice = InsertInvoice & {
  id: number;
  customerId?: number | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  staffId?: number | null;
  staffName?: string | null;
  logoUrl?: string | null;
  notes?: string | null;
  dueDate?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type InvoiceItem = InsertInvoiceItem & {
  id: number;
  productId?: number | null;
  sku?: string | null;
  description?: string | null;
};
