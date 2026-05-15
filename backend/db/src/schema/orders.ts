import { z } from "zod/v4";

export const insertOrderSchema = z.object({
  userId: z.number(),
  customerId: z.number().nullish(),
  customerName: z.string(),
  status: z.string().default("pending"),
  total: z.number().default(0),
  notes: z.string().nullish(),
});

export const insertOrderItemSchema = z.object({
  userId: z.number(),
  orderId: z.number(),
  productId: z.number(),
  productName: z.string(),
  sku: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  subtotal: z.number(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = InsertOrder & {
  id: number;
  customerId?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type OrderItem = InsertOrderItem & {
  id: number;
};
