import PasswordForm from "@/components/password-form";
import Logo from "@/components/logo";
import { db, isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function UpdatePassword() {
  if (!isSupabaseConfigured()) redirect("/auth");
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/auth?error=recovery");
  return (
    <main className="center-page">
      <Link className="back-brand" href="/">
        <Logo />
      </Link>
      <PasswordForm />
    </main>
  );
}
