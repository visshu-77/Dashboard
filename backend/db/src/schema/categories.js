import { z } from "zod/v4";
export const insertCategorySchema = z.object({
    userId: z.number(),
    name: z.string(),
    description: z.string().nullish(),
});
//# sourceMappingURL=categories.js.map