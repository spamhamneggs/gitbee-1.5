import { z } from "zod";

export const atlantisSchema = z.object({
  email: z
    .object({
      Email: z.string(),
      isPrefEmail: z.string(),
    })
    .array(),
  // Omitted for people with no NIM (staff); that's an answer, not a bad response.
  NIM: z.string().optional(),
  Name: z.string(),
  BinusianID: z.string(),
  KodeDosen: z.string(),
});
export type Atlantis = z.infer<typeof atlantisSchema>;