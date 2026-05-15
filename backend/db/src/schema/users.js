import { z } from "zod/v4";
export const insertUserSchema = z.object({
    name: z.string(),
    email: z.string(),
    shopName: z.string(),
    address: z.string(),
    passwordHash: z.string(),
    isActive: z.boolean().default(true),
});
//# sourceMappingURL=users.js.map