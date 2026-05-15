import { z } from "zod/v4";
export const insertCustomerSchema = z.object({
    userId: z.number(),
    name: z.string(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    address: z.string().nullish(),
});
//# sourceMappingURL=customers.js.map