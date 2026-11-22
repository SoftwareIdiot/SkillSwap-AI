import IntroExperience from "@/components/intro-experience";
import { isSupabaseConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default async function Auth({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <IntroExperience
      atAuth
      authReady={isSupabaseConfigured()}
      authError={params.error}
    />
  );
}
