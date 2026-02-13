import { z } from "zod";

const EnvSchema = z.object({
  // GitHub
  GITHUB_TOKEN: z.string().min(1).optional(),

  // Vercel
  VERCEL_TOKEN: z.string().min(1).optional(),
  VERCEL_TEAM_ID: z.string().min(1).optional(),

  // Hugging Face
  HF_TOKEN: z.string().min(1).optional()
});

export const env = EnvSchema.parse(process.env);
