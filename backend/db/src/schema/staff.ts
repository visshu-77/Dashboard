import { z } from "zod/v4";

export const insertStaffSchema = z.object({
  userId: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.string().default("sales"),
  phone: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = InsertStaff & {
  id: number;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
