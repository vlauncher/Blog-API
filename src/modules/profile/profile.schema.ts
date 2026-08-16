import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z.object({
    age: z
      .preprocess(
        (val) => (val === "" || val === undefined ? undefined : Number(val)),
        z.number().int().min(13, "Age must be at least 13").max(150, "Invalid age").optional()
      ),
    bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
    phoneNumber: z
      .string()
      .max(20, "Phone number cannot exceed 20 characters")
      .optional(),
    address: z.string().max(200, "Address cannot exceed 200 characters").optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
