import { z } from "zod/v4";

export const insertCustomerSchema = z.object({
  userId: z.number(),
  name: z.string(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = InsertCustomer & {
  id: number;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
