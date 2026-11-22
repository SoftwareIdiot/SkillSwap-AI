import IntroExperience from "@/components/intro-experience";
import { isSupabaseConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Home() {
  return <IntroExperience authReady={isSupabaseConfigured()} />;
}
