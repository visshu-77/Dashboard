import { z } from "zod/v4";
export declare const insertUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    passwordHash: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = InsertUser & {
    id: number;
    sessionToken?: string | null;
    createdAt: Date;
    updatedAt: Date;
};
//# sourceMappingURL=users.d.ts.map