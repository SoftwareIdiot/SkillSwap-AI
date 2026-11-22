"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Hash, Send, Video } from "lucide-react";
import type { Room } from "@/lib/workspace";
import StudyVoice, { type VoiceRoom } from "./study-voice";

type Message = {
  id: string;
  sender_id: string;
  name: string;
  body: string;
  created_at: string;
};
type CommunitySnapshot = {
  messages: Message[];
  rooms: VoiceRoom[];
  voiceAvailable: boolean;
  voiceError: string | null;
};

export default function StudyCommunity({
  community,
  userId,
  back,
}: {
  community: Room;
  userId: string;
  back: () => void;
}) {
  const [channel, setChannel] = useState<"chat" | "voice">("chat");
  const [snapshot, setSnapshot] = useState<CommunitySnapshot | null>(null);
  const [call, setCall] = useState<VoiceRoom | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const lastSnapshot = useRef("");
  const feed = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const lastMessageId = snapshot?.messages.at(-1)?.id;

  useEffect(() => {
    const abort = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (document.visibilityState === "visible") {
          const response = await fetch(
            `/api/groups/community?community=${community.id}`,
            { cache: "no-store", signal: abort.signal },
          );
          const json = await response.json();
          if (!response.ok) throw new Error(json.error);
          const serialized = JSON.stringify(json);
          if (!abort.signal.aborted && serialized !== lastSnapshot.current) {
            lastSnapshot.current = serialized;
            setSnapshot(json);
          }
          if (!abort.signal.aborted) setLoadError("");
        }
      } catch (reason) {
        if (!abort.signal.aborted)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Connection interrupted. Retrying…",
          );
      }
      if (!abort.signal.aborted) timeout = setTimeout(poll, 3000);
    }
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timeout);
    };
  }, [community.id, refresh]);

  useEffect(() => {
    if (follow.current && feed.current)
      feed.current.scrollTop = feed.current.scrollHeight;
  }, [lastMessageId, channel]);

  async function write(fields: object) {
    if (pending) return false;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/groups/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ community: community.id, ...fields }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      if (json.room) {
        const room: VoiceRoom = json.room;
        setSnapshot(
          (previous) =>
            previous && {
              ...previous,
              rooms: [
                room,
                ...previous.rooms.filter((entry) => entry.id !== room.id),
              ],
            },
        );
      }
      setRefresh((previous) => previous + 1);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save. Try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="study-community">
      <button className="text-link community-back" onClick={back}>
        <ArrowLeft size={16} /> All communities
      </button>
      <div className="community-layout">
        <aside className="panel community-channels">
          <span className="eyebrow">
            {community.visibility === "private"
              ? "INVITE-ONLY COMMUNITY"
              : "OPEN COMMUNITY"}
          </span>
          <h2>{community.name}</h2>
          <span className="badge">{community.topic}</span>
          {community.description && <p>{community.description}</p>}
          <nav aria-label="Community spaces">
            <button
              aria-current={channel === "chat" ? "page" : undefined}
              onClick={() => setChannel("chat")}
            >
              <Hash size={17} /> General chat
            </button>
            <button
              aria-current={channel === "voice" ? "page" : undefined}
              onClick={() => setChannel("voice")}
            >
              <Video size={17} /> Voice rooms{call ? " · In call" : ""}
            </button>
          </nav>
          {community.host_id === userId && (
            <small>
              Invite code <code>{community.code}</code>
            </small>
          )}
        </aside>
        <div className="community-content">
          {(loadError || error) && (
            <p role="alert" className="form-error">
              {error || loadError}
            </p>
          )}
          {channel === "chat" && (
            <section className="panel community-chat">
              <header>
                <h3>General chat</h3>
                <p>Talk with people in {community.name}.</p>
              </header>
              <div
                ref={feed}
                className="community-feed"
                role="log"
                aria-label="Community messages"
                onScroll={(event) => {
                  const list = event.currentTarget;
                  follow.current =
                    list.scrollHeight - list.scrollTop - list.clientHeight < 80;
                }}
              >
                {!snapshot && !loadError && (
                  <p className="muted">Loading messages…</p>
                )}
                {snapshot?.messages.length === 0 && (
                  <p className="muted">
                    Start the conversation with an introduction or a study
                    question.
                  </p>
                )}
                {snapshot?.messages.map((item) => (
                  <article
                    className={`community-message ${item.sender_id === userId ? "own" : ""}`}
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.sender_id === userId ? "You" : item.name}
                      </strong>
                      <time dateTime={item.created_at}>
                        {new Date(item.created_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
              <form
                className="community-compose"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const body = message.trim();
                  if (body && (await write({ action: "message", body }))) {
                    setMessage("");
                    follow.current = true;
                  }
                }}
              >
                <textarea
                  aria-label="Community message"
                  placeholder="Write a message…"
                  value={message}
                  maxLength={2000}
                  rows={2}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button
                  className="btn primary"
                  disabled={pending || !message.trim()}
                >
                  <Send size={16} /> Send
                </button>
              </form>
            </section>
          )}
          {call && (
            <div hidden={channel !== "voice"}>
              <StudyVoice
                key={call.id}
                room={call}
                onLeave={() => setCall(null)}
              />
            </div>
          )}
          {channel === "voice" && !call && (
            <section className="panel community-rooms">
              <header>
                <h3>Voice rooms</h3>
                <p>
                  Study together with up to four people. You join with your mic
                  and camera off.
                </p>
              </header>
              {snapshot?.voiceAvailable === false && (
                <p role="status" className="muted">
                  {snapshot.voiceError}
                </p>
              )}
              {snapshot?.rooms.map((room) => (
                <div className="community-room-row" key={room.id}>
                  <div>
                    <strong>{room.title}</strong>
                    <span>{room.background} background</span>
                  </div>
                  <button
                    className="btn secondary"
                    onClick={() => setCall(room)}
                  >
                    <Video size={15} /> Join room
                  </button>
                </div>
              ))}
              <form
                className="community-room-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const values = new FormData(form);
                  if (
                    await write({
                      action: "room",
                      title: values.get("title"),
                      background: values.get("background"),
                    })
                  )
                    form.reset();
                }}
              >
                <label>
                  Room name
                  <input
                    name="title"
                    minLength={3}
                    maxLength={70}
                    required
                    placeholder="Quiet study"
                  />
                </label>
                <label>
                  Shared background
                  <select name="background">
                    <option value="night">Night desk</option>
                    <option value="forest">Forest</option>
                    <option value="dawn">Dawn</option>
                  </select>
                </label>
                <button
                  className="btn primary"
                  disabled={pending || !snapshot?.voiceAvailable}
                >
                  {pending ? "Creating room…" : "Create room"}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
