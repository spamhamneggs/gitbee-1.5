import { z } from "zod";

export const atlantisSchema = z.object({
  email: z
    .object({
      Email: z.string(),
      isPrefEmail: z.string(),
    })
    .array(),
  NIM: z.string(),
  Name: z.string(),
  BinusianID: z.string(),
  KodeDosen: z.string(),
});
export type Atlantis = z.infer<typeof atlantisSchema>;