import { z } from "zod/v4";

export const insertUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  invoiceLogoUrl: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = InsertUser & {
  id: number;
  invoiceLogoUrl?: string | null;
  sessionToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
