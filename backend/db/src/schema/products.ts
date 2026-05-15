import { z } from "zod/v4";

export const insertProductSchema = z.object({
  userId: z.number(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullish(),
  price: z.number(),
  cost: z.number(),
  stock: z.number().default(0),
  minStock: z.number().default(5),
  categoryId: z.number().nullish(),
  brand: z.string().nullish(),
  imageUrl: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = InsertProduct & {
  id: number;
  description?: string | null;
  categoryId?: number | null;
  brand?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
