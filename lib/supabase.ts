import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
export const isSupabaseConfigured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project")
  );

export async function db() {
  if (!isSupabaseConfigured())
    throw new Error(
      "Account services are not connected yet. You can use the local workspace.",
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(
          items: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Component read-only context */
          }
        },
      },
    },
  );
}
