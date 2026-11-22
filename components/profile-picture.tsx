"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  avatarLimit,
  avatarSizeMessage,
  avatarType,
  avatarTypes,
} from "@/lib/profile-avatar";

const endpoint = "/api/profile/avatar";
const avatarCache = () => caches.open("skillswap-profile-pictures");

export function useProfilePicture(owner: string | null, connected: boolean) {
  const key = owner ? `/profile-picture/${encodeURIComponent(owner)}` : "";
  const [state, setState] = useState<{
    key: string;
    picture: Blob | null;
    local: boolean;
  }>();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const current = state?.key === key ? state : undefined;
  const picture = current?.picture;

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    void (async () => {
      try {
        if (connected) {
          const response = await fetch(endpoint, {
            cache: "no-store",
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(25000)]),
          });
          if (response.ok && response.status !== 204) {
            const picture = await response.blob();
            if (!abort.signal.aborted) setState({ key, picture, local: false });
            return;
          }
        }
      } catch {
        if (abort.signal.aborted) return;
      }
      const picture = await avatarCache()
        .then(async (cache) => (await cache.match(key))?.blob())
        .catch(() => null);
      if (!abort.signal.aborted)
        setState({ key, picture: picture ?? null, local: Boolean(picture) });
    })();
    return () => abort.abort();
  }, [key, connected]);

  useEffect(() => {
    const next = picture ? URL.createObjectURL(picture) : "";
    setUrl(next);
    return () => {
      if (next) URL.revokeObjectURL(next);
    };
  }, [picture]);

  async function save(file: File | null) {
    if (!current || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let picture: Blob | null = null;
      if (file) {
        const type = await avatarType(file);
        if (!type) throw new Error("Choose a PNG, JPEG, WebP, or GIF.");
        if (file.size > avatarLimit(type))
          throw new Error(avatarSizeMessage(type));
        picture = file.slice(0, file.size, type);
        const preview = URL.createObjectURL(picture);
        try {
          const image = new Image();
          image.src = preview;
          await image.decode();
          if (image.naturalWidth > 2048 || image.naturalHeight > 2048)
            throw new Error(
              "Choose a picture no larger than 2048 × 2048 pixels.",
            );
        } finally {
          URL.revokeObjectURL(preview);
        }
      }
      let local = !connected;
      if (connected) {
        const response = await fetch(
          endpoint,
          picture
            ? {
                method: "POST",
                headers: { "Content-Type": picture.type },
                body: picture,
              }
            : { method: "DELETE" },
        );
        if (!response.ok) {
          const result = await response.json();
          if (result.code !== "avatar_storage_missing")
            throw new Error(result.error);
          local = true;
        }
      }
      if (local && picture) {
        const cache = await avatarCache();
        await cache.put(key, new Response(picture));
      } else if (local || current.local) {
        await avatarCache().then((cache) => cache.delete(key));
      }
      setState({ key, picture, local: Boolean(picture && local) });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save your picture. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return {
    url: picture ? url : "",
    loading: !current,
    busy,
    error,
    local: !!current?.local,
    save,
  };
}

export function ProfilePictureControls({
  picture,
}: {
  picture: ReturnType<typeof useProfilePicture>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="profile-picture-controls">
      <div className="button-row">
        <input
          ref={input}
          type="file"
          accept={avatarTypes.join(",")}
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void picture.save(file);
          }}
        />
        <button
          className="btn secondary"
          disabled={picture.loading || picture.busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={15} />
          {picture.busy
            ? "Saving…"
            : picture.url
              ? "Change picture"
              : "Upload picture"}
        </button>
        {picture.url && (
          <button
            className="btn secondary"
            disabled={picture.busy}
            onClick={() => void picture.save(null)}
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
      </div>
      <small>GIFs up to 12 MB · PNG, JPEG and WebP up to 3 MB</small>
      {picture.local && <small role="status">Saved on this device.</small>}
      {picture.error && (
        <p className="form-error" role="alert">
          {picture.error}
        </p>
      )}
    </div>
  );
}
