import { z } from "zod/v4";

export const insertCategorySchema = z.object({
  userId: z.number(),
  name: z.string(),
  description: z.string().nullish(),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = InsertCategory & {
  id: number;
  description?: string | null;
  createdAt: Date;
  updatedAt?: Date;
};
