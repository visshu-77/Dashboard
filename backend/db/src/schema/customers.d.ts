import { z } from "zod/v4";
export declare const insertCustomerSchema: z.ZodObject<{
    userId: z.ZodNumber;
    name: z.ZodString;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = InsertCustomer & {
    id: number;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    createdAt: Date;
    updatedAt: Date;
};
//# sourceMappingURL=customers.d.ts.map