import { z } from "zod/v4";
export declare const insertInvoiceSchema: z.ZodObject<{
    userId: z.ZodNumber;
    invoiceNumber: z.ZodString;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    customerName: z.ZodString;
    customerEmail: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    staffId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    staffName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodString>;
    subtotal: z.ZodDefault<z.ZodNumber>;
    taxRate: z.ZodDefault<z.ZodNumber>;
    taxAmount: z.ZodDefault<z.ZodNumber>;
    total: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueDate: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
}, z.core.$strip>;
export declare const insertInvoiceItemSchema: z.ZodObject<{
    userId: z.ZodNumber;
    invoiceId: z.ZodNumber;
    productId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    productName: z.ZodString;
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodDefault<z.ZodNumber>;
    unitPrice: z.ZodNumber;
    subtotal: z.ZodNumber;
}, z.core.$strip>;
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
//# sourceMappingURL=invoices.d.ts.map