"use client";
import { useEffect, useState } from "react";
import type { Room, WorkspaceData } from "@/lib/workspace";
import { recommend } from "@/lib/recommendations";
import { ArrowRight, Users } from "lucide-react";
import StudyCommunity from "./study-community";
import "./study-circle.css";
import "./planner.css";
export default function StudyGroups({
  data,
  connected,
}: {
  data: WorkspaceData;
  connected: boolean;
}) {
  const [rooms, setRooms] = useState<Room[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [active, setActive] = useState<Room | null>(null);
  async function request(op?: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        "/api/groups",
        op
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(op),
            }
          : { cache: "no-store" },
      );
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setRooms(json.rooms);
      if (op) setNotice("Group membership saved.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (connected) void request();
  }, [connected]);
  if (active)
    return (
      <StudyCommunity
        key={active.id}
        community={active}
        userId={data.userId}
        back={() => setActive(null)}
      />
    );
  return (
    <div className="study-groups">
      <section className="panel">
        <span className="eyebrow">STUDY CIRCLE</span>
        <h2>Find your study community</h2>
        <p>
          Join a community to talk in general chat and study together in voice
          rooms. Suggestions use your programme, interests, and enrolled skills.
        </p>
        {!connected && (
          <p>Connect an account to create and join real study groups.</p>
        )}
        <button
          className="btn secondary"
          disabled={busy || !connected}
          onClick={() => request()}
        >
          Refresh groups
        </button>
      </section>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="planner-habit-columns">
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            if (
              await request({
                type: "room.create",
                value: {
                  name: f.get("name"),
                  topic: f.get("topic"),
                  description: f.get("description"),
                  visibility: f.get("visibility"),
                },
              })
            )
              form.reset();
          }}
        >
          <h3>Create a community</h3>
          <label>
            Group name
            <input name="name" required minLength={3} maxLength={120} />
          </label>
          <label>
            Programme or topic
            <input
              name="topic"
              required
              minLength={2}
              maxLength={100}
              placeholder="CSE · algorithms"
            />
          </label>
          <label>
            What will you study?
            <textarea name="description" maxLength={500} />
          </label>
          <label>
            Visibility
            <select name="visibility">
              <option value="public">Public — anyone can join</option>
              <option value="private">Private — invite code required</option>
            </select>
          </label>
          <button className="btn primary" disabled={busy || !connected}>
            Create community
          </button>
        </form>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void request({
              type: "room.join",
              code: new FormData(e.currentTarget).get("code"),
            });
          }}
        >
          <h3>Have an invitation?</h3>
          <p>Enter the code shared by a private group’s host.</p>
          <label>
            Invite code
            <input name="code" required placeholder="SKILL-A1B2C3D4E5" />
          </label>
          <button className="btn secondary" disabled={busy || !connected}>
            Join with code
          </button>
        </form>
      </div>
      <h2>Browse communities</h2>
      {!rooms.length && !busy && (
        <p>
          No groups yet. Create the first group around your programme or a skill
          you’re learning.
        </p>
      )}
      <div className="community-directory">
        {recommend(
          rooms,
          (r) => `${r.name} ${r.topic} ${r.description}`,
          data,
        ).map((r) => (
          <article className="panel community-list-card" key={r.id}>
            <Users size={20} className="mint-text" />
            <span className="eyebrow">
              {r.visibility} · {r.joined ? "JOINED" : "OPEN TO JOIN"}
            </span>
            <h3>{r.name}</h3>
            <span className="badge">{r.topic}</span>
            <p>{r.description}</p>
            {r.joined ? (
              <>
                <button className="btn primary" onClick={() => setActive(r)}>
                  Open community <ArrowRight size={15} />
                </button>
                {r.host_id === data.userId && (
                  <p>
                    Invite code: <code>{r.code}</code>
                  </p>
                )}
              </>
            ) : (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={async () => {
                  if (await request({ type: "room.join", code: r.code }))
                    setActive({ ...r, joined: true });
                }}
              >
                Join community
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
