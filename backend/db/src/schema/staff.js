import { z } from "zod/v4";
export const insertStaffSchema = z.object({
    userId: z.number(),
    name: z.string(),
    email: z.string(),
    role: z.string().default("sales"),
    phone: z.string().nullish(),
    isActive: z.boolean().default(true),
});
//# sourceMappingURL=staff.js.map