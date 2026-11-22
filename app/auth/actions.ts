"use server";
import { db, isSupabaseConfigured } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requestOrigin } from "@/lib/request-origin";
import { z } from "zod";
import {
  emailCredentials,
  emailSignup,
  emailCode,
  signupNeedsCode,
} from "@/lib/email-auth";
export type AuthState = {
  error?: string;
  success?: string;
  email?: string;
  needsVerification?: boolean;
};
const credentials = emailCredentials;
async function authOrigin() {
  return requestOrigin({
    headers: new Headers(await headers()),
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  });
}
export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured())
    return {
      error:
        "Account services are not connected. Your local workspace is ready to use.",
    };
  const v = credentials.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      error: "Enter a valid email and password (at least 8 characters).",
    };
  const supabase = await db();
  const { error } = await supabase.auth
    .signInWithPassword(v.data)
    .catch(() => ({
      error: { message: "Could not connect. Please try again." },
    }));
  if (error) return { error: error.message };
  redirect("/student");
}
export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured())
    return {
      error:
        "Account services are not connected. Your local workspace is ready to use.",
    };
  const v = credentials.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      error: "Enter a valid email and password (at least 8 characters).",
    };
  if (!emailSignup.safeParse(Object.fromEntries(form)).success)
    return { error: "Those passwords do not match. Please try again." };
  if (process.env.EMAIL_OTP_ENABLED !== "true")
    return {
      error:
        "Email signup is not available yet. Please continue with Google for now.",
    };
  const supabase = await db();
  const { data, error } = await supabase.auth
    .signUp({
      ...v.data,
      options: {
        emailRedirectTo: `${await authOrigin()}/auth/callback`,
      },
    })
    .catch(() => ({
      data: { session: null, user: null },
      error: {
        message: "Could not connect to the email service. Please try again.",
      },
    }));
  if (error) return { error: error.message };
  if (data.session) redirect("/student");
  if (!signupNeedsCode(data.user))
    return {
      error:
        "We couldn't start a new email signup. If you've used this email before, sign in with Google or your existing password.",
    };
  return {
    success: "Check your inbox for your verification code.",
    email: v.data.email,
    needsVerification: true,
  };
}
export async function verifyEmail(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = z.string().email().safeParse(form.get("email"));
  const token = z
    .string()
    .regex(/^\d{6,10}$/)
    .safeParse(form.get("token"));
  const code = emailCode.safeParse(Object.fromEntries(form));
  if (!email.success || !token.success || !code.success)
    return { error: "Enter the numeric code from your email." };
  if (!isSupabaseConfigured())
    return { error: "Account services are unavailable. Please try again." };
  const client = await db();
  const { data, error } = await client.auth
    .verifyOtp({ email: email.data, token: token.data, type: "email" })
    .catch(() => ({
      data: { session: null },
      error: { message: "Could not connect. Please try again." },
    }));
  if (error || !data.session)
    return {
      error:
        "That code could not be verified. Check the code or request a new one.",
    };
  redirect("/student");
}
export async function resendEmail(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success || !isSupabaseConfigured())
    return { error: "Enter a valid email address." };
  const client = await db();
  const { error } = await client.auth
    .resend({ type: "signup", email: email.data })
    .catch(() => ({
      error: { message: "Could not connect. Please try again." },
    }));
  return error
    ? { error: "Could not resend yet. Please wait a minute and try again." }
    : {
        success:
          "If this signup still needs verification, a new code was requested. Already have an account? Return to sign in.",
      };
}
export async function resetPassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured())
    return {
      error:
        "Account services are not connected. Your local workspace is ready to use.",
    };
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  const supabase = await db();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await authOrigin()}/auth/callback?next=/auth/update-password`,
  });
  return error
    ? { error: error.message }
    : { success: "If this email has an account, a reset link has been sent." };
}
