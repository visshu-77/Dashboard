import { z } from "zod/v4";
export declare const insertStaffSchema: z.ZodObject<{
    userId: z.ZodNumber;
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodDefault<z.ZodString>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = InsertStaff & {
    id: number;
    phone?: string | null;
    createdAt: Date;
    updatedAt: Date;
};
//# sourceMappingURL=staff.d.ts.map