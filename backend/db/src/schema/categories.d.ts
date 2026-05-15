import { z } from "zod/v4";
export declare const insertCategorySchema: z.ZodObject<{
    userId: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = InsertCategory & {
    id: number;
    description?: string | null;
    createdAt: Date;
    updatedAt?: Date;
};
//# sourceMappingURL=categories.d.ts.map