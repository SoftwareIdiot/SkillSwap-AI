import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isSameOrigin, requestOrigin } from "@/lib/request-origin";
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const client = await db();
  await client.auth.signOut();
  return NextResponse.redirect(new URL("/", requestOrigin(request)), 303);
}
