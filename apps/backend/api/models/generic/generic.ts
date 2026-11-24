import { z } from "zod";

export const atlantisSchema = z.object({
  email: z
    .object({
      Email: z.string(),
      isPrefEmail: z.string(),
    })
    .array(),
  // Missing or null for people with no NIM (staff); that's an answer, not a bad response.
  NIM: z.string().nullish(),
  Name: z.string(),
  BinusianID: z.string(),
  KodeDosen: z.string(),
});
export type Atlantis = z.infer<typeof atlantisSchema>;