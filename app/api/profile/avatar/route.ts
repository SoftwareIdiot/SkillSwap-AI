import { NextRequest, NextResponse } from "next/server";
import {
  avatarLimit,
  avatarSizeMessage,
  avatarType,
  avatarTypes,
} from "@/lib/profile-avatar";
import { isSameOrigin } from "@/lib/request-origin";
import { boundedBody } from "@/lib/bounded-body";
import { db } from "@/lib/supabase";

async function access() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  return (
    user && {
      files: client.storage.from("profile-avatars"),
      path: `${user.id}/avatar`,
    }
  );
}

function problem(error: string, status: number, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

function storageMissing(error: { message: string }) {
  return (
    ("code" in error && error.code === "NoSuchBucket") ||
    /bucket not found/i.test(error.message)
  );
}

export async function GET() {
  try {
    const avatar = await access();
    if (!avatar) return problem("Sign in to view your profile picture.", 401);
    const { data, error } = await avatar.files.download(avatar.path);
    if (error) {
      if (storageMissing(error)) return new Response(null, { status: 204 });
      if (
        ("code" in error && error.code === "NoSuchKey") ||
        /object not found/i.test(error.message)
      )
        return new Response(null, { status: 204 });
      return problem("Your profile picture could not be loaded.", 503);
    }
    const type = data && (await avatarType(data));
    if (!data || !type || data.size > avatarLimit(type))
      return new Response(null, { status: 204 });
    return new Response(data, {
      headers: { "Content-Type": type, "Cache-Control": "private, no-store" },
    });
  } catch {
    return problem("Your profile picture could not be loaded.", 503);
  }
}

async function changeAvatar(request: NextRequest, remove: boolean) {
  if (!isSameOrigin(request)) return problem("Invalid request origin.", 403);
  try {
    const avatar = await access();
    if (!avatar) return problem("Sign in to update your profile picture.", 401);
    let error;
    if (remove) {
      ({ error } = await avatar.files.remove([avatar.path]));
    } else {
      const type = request.headers.get("Content-Type") || "";
      if (!avatarTypes.includes(type))
        return problem("Choose a PNG, JPEG, WebP, or GIF.", 415);
      const picture = await boundedBody(request, avatarLimit(type));
      if (!picture) return problem(avatarSizeMessage(type), 413);
      if (type !== (await avatarType(picture)))
        return problem("This file is not a supported image.", 415);
      ({ error } = await avatar.files.upload(avatar.path, picture, {
        contentType: type,
        upsert: true,
      }));
    }
    if (error && storageMissing(error))
      return problem(
        "Account picture storage has not been set up.",
        503,
        "avatar_storage_missing",
      );
    if (
      error &&
      (error.status === 413 ||
        ("code" in error && error.code === "EntityTooLarge"))
    )
      return problem(
        "This picture exceeds the account storage limit. Try a smaller file.",
        413,
      );
    if (error)
      return problem(
        "Your profile picture could not be updated. Try again.",
        503,
      );
    return new Response(null, { status: 204 });
  } catch {
    return problem(
      "Your profile picture could not be updated. Try again.",
      503,
    );
  }
}

export async function POST(request: NextRequest) {
  return changeAvatar(request, false);
}

export async function DELETE(request: NextRequest) {
  return changeAvatar(request, true);
}
