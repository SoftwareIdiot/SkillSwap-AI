import { z } from "zod";
export const emailCredentials = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});
export const emailSignup = emailCredentials
  .extend({ confirmation: z.string() })
  .refine((v) => v.password === v.confirmation, {
    message: "Those passwords do not match. Please try again.",
    path: ["confirmation"],
  });
export const emailCode = z.object({
  email: z.string().trim().email(),
  token: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/),
});
// An obfuscated existing-account response is not evidence of a sent email.
export function signupNeedsCode(
  user:
    { identities?: unknown[]; email_confirmed_at?: string } | null | undefined,
) {
  return (
    !!user &&
    !user.email_confirmed_at &&
    Array.isArray(user.identities) &&
    user.identities.length > 0
  );
}
