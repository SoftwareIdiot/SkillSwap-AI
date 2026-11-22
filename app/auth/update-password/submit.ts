"use server";
import { db, isSupabaseConfigured } from "@/lib/supabase";
import { redirect } from "next/navigation";
import type { AuthState } from "../actions";
export async function updatePassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured())
    return { error: "Account services are not connected." };
  const password = String(form.get("password") || "");
  if (password.length < 8 || password.length > 72)
    return { error: "Use a password between 8 and 72 characters." };
  if (password !== form.get("confirmation"))
    return { error: "Those passwords do not match. Please try again." };
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      error:
        "This recovery session has expired. Request a fresh password reset email.",
    };
  const { error } = await client.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/student");
}
