import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "./lib/request-origin";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project")) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items: { name: string; value: string; options: CookieOptions }[]) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  const redirectTo = (path: string) => {
    const result = NextResponse.redirect(new URL(path, requestOrigin(request)));
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  };
  if (
    ["/student", "/teacher", "/recruiter"].some((p) =>
      request.nextUrl.pathname.startsWith(p),
    ) &&
    !user
  )
    return redirectTo("/auth");
  if (request.nextUrl.pathname === "/auth" && user)
    return redirectTo("/student");
  return response;
}
export const config = {
  matcher: [
    "/student/:path*",
    "/teacher/:path*",
    "/recruiter/:path*",
    "/auth",
    // These routes authenticate and bound their own media uploads.
    "/api/((?!profile/avatar$|groups/feed$).*)",
    "/",
  ],
};
