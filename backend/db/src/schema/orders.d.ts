import { z } from "zod/v4";
export declare const insertOrderSchema: z.ZodObject<{
    userId: z.ZodNumber;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    customerName: z.ZodString;
    status: z.ZodDefault<z.ZodString>;
    total: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const insertOrderItemSchema: z.ZodObject<{
    userId: z.ZodNumber;
    orderId: z.ZodNumber;
    productId: z.ZodNumber;
    productName: z.ZodString;
    sku: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    subtotal: z.ZodNumber;
}, z.core.$strip>;
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
//# sourceMappingURL=orders.d.ts.map