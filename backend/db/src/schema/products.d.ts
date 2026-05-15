import { z } from "zod/v4";
export declare const insertProductSchema: z.ZodObject<{
    userId: z.ZodNumber;
    name: z.ZodString;
    sku: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    price: z.ZodNumber;
    cost: z.ZodNumber;
    stock: z.ZodDefault<z.ZodNumber>;
    minStock: z.ZodDefault<z.ZodNumber>;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
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
//# sourceMappingURL=products.d.ts.map