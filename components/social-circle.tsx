"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  Check,
  LockKeyhole,
  MessageCircle,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import "./social-circle.css";
type Person = {
  id: string;
  full_name: string;
  username: string;
  bio: string;
  institution: string;
  following: boolean;
  follows_you: boolean;
};
type Room = {
  id: string;
  name: string;
  goal: string;
  owner_id: string;
  accepted: boolean;
};
type Snapshot = {
  me: string;
  selected: string | null;
  preferences: { messages: boolean; ranking: boolean };
  people: Person[];
  blocked: { id: string; name: string }[];
  rooms: Room[];
  messages: {
    id: string;
    sender_id: string;
    body: string;
    full_name: string;
    created_at: string;
  }[];
  members: { id: string; name: string; accepted: boolean }[];
  checked: boolean;
  ranking: { id: string; full_name: string; days: number }[];
  reports: { id: string; reason: string; target: string; full_name: string }[];
};
function SocialModal({
  children,
  close,
  label,
}: {
  children: ReactNode;
  close: () => void;
  label: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="social-overlay"
      aria-label={label}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {children}
    </dialog>
  );
}
export default function SocialCircle({
  connected,
  initialTab = "people",
  navigate,
}: {
  connected: boolean;
  initialTab?: "people" | "inbox";
  navigate: (tab: "people" | "messages") => void;
}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState<"people" | "inbox" | "privacy">(initialTab),
    [room, setRoom] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<Person | null>(null),
    [creating, setCreating] = useState(false),
    [invites, setInvites] = useState<string[]>([]),
    [report, setReport] = useState<Person | null>(null);
  const revision = useRef(0),
    working = useRef(false),
    end = useRef<HTMLDivElement>(null);
  const request = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      const r = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, search: query, ...payload }),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      return value as Snapshot;
    },
    [room, query],
  );
  const load = useCallback(async () => {
    if (!connected || working.current) return;
    const rev = ++revision.current;
    try {
      const next = await request();
      if (rev === revision.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (rev === revision.current) setError((e as Error).message);
    } finally {
      if (rev === revision.current) setLoading(false);
    }
  }, [connected, request]);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(t);
      revision.current++;
    };
  }, [load]);
  useEffect(() => {
    if (tab !== "inbox" || !room) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 12000);
    return () => clearInterval(t);
  }, [tab, room, load]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [data?.messages.at(-1)?.id]);
  async function act(payload: Record<string, unknown>) {
    if (working.current) return false;
    working.current = true;
    revision.current++;
    setBusy(true);
    setError("");
    try {
      const next = await request(payload);
      setData(next);
      if (payload.action === "create") {
        setRoom(next.selected);
        setTab("inbox");
        setCreating(false);
      }
      if (payload.action === "leave") setRoom(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const current = data?.rooms.find((r) => r.id === room),
    mutual = data?.people.filter((p) => p.following && p.follows_you) || [];
  if (!connected)
    return (
      <section className="panel">
        Sign in to follow learners and join private conversations.
      </section>
    );
  return (
    <div className="social-space">
      <div className="social-toolbar">
        <div className="social-tabs" aria-label="Connections">
          {(["people", "inbox", "privacy"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => {
                if (t === "privacy") setTab(t);
                else if (t === initialTab) setTab(t);
                else navigate(t === "people" ? "people" : "messages");
              }}
            >
              {t === "people"
                ? "People"
                : t === "inbox"
                  ? "Conversations"
                  : "Privacy & requests"}
              {t === "inbox" &&
                !!data?.rooms.filter((r) => !r.accepted).length && (
                  <span className="badge">
                    {data.rooms.filter((r) => !r.accepted).length}
                  </span>
                )}
            </button>
          ))}
        </div>
        <button
          className="btn secondary"
          onClick={() => void load()}
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      {error && (
        <div role="alert" className="social-error">
          {error}
        </div>
      )}
      {loading && !data && <p role="status">Opening your connections…</p>}
      {tab === "people" && (
        <>
          <div className="social-directory-heading">
            <div>
              <span className="eyebrow">YOUR LEARNING NETWORK</span>
              <h2>Find your people.</h2>
              <p>
                Follow a learner. Follow each other to invite them into a
                private study conversation.
              </p>
            </div>
            <label className="social-search">
              <Search size={17} />
              <input
                aria-label="Find learners"
                placeholder="Name or username…"
                maxLength={80}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="social-people">
            {data?.people.map((p) => (
              <article key={p.id} className="social-person">
                <button
                  className="social-person-identity"
                  onClick={() => setSelected(p)}
                >
                  <span className="social-monogram">
                    {p.full_name.slice(0, 1)}
                  </span>
                  <span>
                    <b>{p.full_name}</b>
                    <small>@{p.username}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
                <p>{p.bio || p.institution || "Learning at their own pace."}</p>
                <div className="social-person-actions">
                  <button
                    className={p.following ? "btn secondary" : "btn"}
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: p.following ? "unfollow" : "follow",
                        target: p.id,
                      })
                    }
                  >
                    {p.following ? <Check size={15} /> : <Plus size={15} />}{" "}
                    {p.following ? "Following" : "Follow"}
                  </button>
                  {p.follows_you && (
                    <small>
                      {p.following ? "Mutual connection" : "Follows you"}
                    </small>
                  )}
                </div>
              </article>
            ))}
          </div>
          {data && !data.people.length && (
            <p className="panel">No learners match this search yet.</p>
          )}
        </>
      )}
      {tab === "inbox" && (
        <div className="social-inbox">
          <aside className="social-rooms">
            <header>
              <h2>Conversations</h2>
              <button
                className="icon-btn"
                aria-label="New private room"
                onClick={() => {
                  setCreating(true);
                  setInvites([]);
                }}
              >
                <Plus size={19} />
              </button>
            </header>
            {data?.rooms.map((r) => (
              <button
                className="social-room"
                data-active={r.id === room}
                key={r.id}
                onClick={() => setRoom(r.id)}
              >
                <MessageCircle size={18} />
                <span>
                  <b>{r.name}</b>
                  <small>
                    {r.accepted
                      ? "Private study room"
                      : "Invitation · accept to enter"}
                  </small>
                </span>
              </button>
            ))}
            {!data?.rooms.length && (
              <p>Start with a mutual connection, then create a conversation.</p>
            )}
          </aside>
          <section className="social-conversation">
            {!current ? (
              <div className="social-blank">
                <Users size={36} />
                <h2>A shared place to make progress.</h2>
                <p>
                  Choose a conversation or invite up to seven mutual
                  connections. Invitations must be accepted before messages are
                  visible.
                </p>
                <button className="btn" onClick={() => setCreating(true)}>
                  Create private room
                </button>
              </div>
            ) : (
              <>
                <header className="social-chat-heading">
                  <div>
                    <small>
                      <LockKeyhole size={12} /> PRIVATE ROOM
                    </small>
                    <h2>{current.name}</h2>
                  </div>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void act({ action: "leave" })}
                  >
                    {current.accepted ? "Leave" : "Decline"}
                  </button>
                </header>
                {!current.accepted ? (
                  <div className="social-blank">
                    <h3>You’re invited.</h3>
                    <p>
                      Accept to see the conversation and share progress with
                      this room.
                    </p>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => void act({ action: "accept" })}
                    >
                      Accept invitation
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="social-member-line">
                      {(data?.selected === room ? data.members : []).map(
                        (m) => (
                          <span key={m.id}>
                            {m.name}
                            {!m.accepted ? " · invited" : ""}
                          </span>
                        ),
                      )}
                    </div>
                    <div
                      className="social-messages"
                      role="log"
                      aria-label="Room messages"
                    >
                      {(data?.selected === room ? data.messages : []).map(
                        (m) => (
                          <article
                            key={m.id}
                            data-own={m.sender_id === data?.me}
                          >
                            <small>
                              {m.sender_id === data?.me ? "You" : m.full_name} ·{" "}
                              {new Date(m.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                            <p>{m.body}</p>
                          </article>
                        ),
                      )}
                      {!data?.messages.length && (
                        <p className="muted">
                          Share what you’re learning or ask a specific question.
                        </p>
                      )}
                      <div ref={end} />
                    </div>
                    <form
                      className="social-compose"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const body = new FormData(f).get("message");
                        if (await act({ action: "send", body })) f.reset();
                      }}
                    >
                      <input
                        name="message"
                        required
                        maxLength={2000}
                        aria-label="Message"
                        placeholder="Write a message…"
                      />
                      <button
                        className="btn"
                        disabled={busy}
                        aria-label="Send message"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                    <details className="social-progress">
                      <summary>Shared goal & weekly progress</summary>
                      {current.owner_id === data?.me ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void act({
                              action: "goal",
                              body: new FormData(e.currentTarget).get("goal"),
                            });
                          }}
                        >
                          <input
                            key={current.goal}
                            name="goal"
                            maxLength={240}
                            defaultValue={current.goal}
                            placeholder="Our shared learning goal"
                            aria-label="Shared goal"
                          />
                          <button className="btn secondary" disabled={busy}>
                            Save goal
                          </button>
                        </form>
                      ) : (
                        <p>
                          {current.goal ||
                            "The room owner can set a shared goal."}
                        </p>
                      )}
                      {current.goal && (
                        <button
                          className="btn secondary"
                          disabled={busy || data?.checked}
                          onClick={() => void act({ action: "checkin" })}
                        >
                          {data?.checked
                            ? "Progress recorded today"
                            : "I made progress today"}
                        </button>
                      )}
                      <p className="muted">
                        Last 7 days · one self-reported check-in per UTC day.
                        Participation is optional; this does not verify mastery.
                      </p>
                      <label className="social-choice">
                        <input
                          type="checkbox"
                          checked={data?.preferences.ranking || false}
                          disabled={busy}
                          onChange={(e) =>
                            void act({
                              action: "preferences",
                              body: String(data?.preferences.messages),
                              title: String(e.target.checked),
                            })
                          }
                        />
                        Show me in room leaderboards
                      </label>
                      {(data?.selected === room ? data.ranking : []).map(
                        (p, i) => (
                          <div className="social-ranking" key={p.id}>
                            <span>
                              {i + 1}. {p.full_name}
                            </span>
                            <b>{p.days}/7 days</b>
                          </div>
                        ),
                      )}
                    </details>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {tab === "privacy" && (
        <section className="panel social-privacy">
          <h2>Your connections, your choice.</h2>
          <label className="social-choice">
            <input
              type="checkbox"
              disabled={busy}
              checked={data?.preferences.messages ?? true}
              onChange={(e) =>
                void act({
                  action: "preferences",
                  body: String(e.target.checked),
                  title: String(data?.preferences.ranking),
                })
              }
            />
            Allow private room invitations from mutual followers
          </label>
          <p>
            Following does not open your inbox. New invitations require your
            acceptance. Private rooms are visible to their members; they are not
            end-to-end encrypted.
          </p>
          <h3>Blocked learners</h3>
          {data?.blocked.map((p) => (
            <div className="social-ranking" key={p.id}>
              <span>{p.name}</span>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => void act({ action: "unblock", target: p.id })}
              >
                Unblock
              </button>
            </div>
          ))}
          {!data?.blocked.length && <p>No blocked learners.</p>}
          {!!data?.reports.length && (
            <>
              <h3>Moderator reports</h3>
              {data.reports.map((r) => (
                <article key={r.id}>
                  <b>{r.full_name}</b>
                  <p>{r.reason}</p>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() =>
                      void act({ action: "resolve", target: r.id })
                    }
                  >
                    Mark reviewed
                  </button>
                </article>
              ))}
            </>
          )}
        </section>
      )}
      {selected && (
        <SocialModal close={() => setSelected(null)} label="Learner profile">
          <section
            className="social-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Learner profile"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="btn secondary" onClick={() => setSelected(null)}>
              Close
            </button>
            <span className="social-monogram">{selected.full_name[0]}</span>
            <h2>{selected.full_name}</h2>
            <p>
              @{selected.username} · {selected.institution}
            </p>
            <p>{selected.bio || "This learner has not added a bio yet."}</p>
            {error && (
              <p role="alert" className="social-error">
                {error}
              </p>
            )}
            <button
              className="btn secondary"
              disabled={busy}
              onClick={async () => {
                if (await act({ action: "block", target: selected.id }))
                  setSelected(null);
              }}
            >
              Block learner
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setReport(selected);
                setSelected(null);
              }}
            >
              Report
            </button>
          </section>
        </SocialModal>
      )}
      {report && (
        <SocialModal close={() => setReport(null)} label="Report learner">
          <form
            className="social-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Report learner"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act({
                  action: "report",
                  target: report.id,
                  body: new FormData(e.currentTarget).get("reason"),
                })
              )
                setReport(null);
            }}
          >
            <h2>Report {report.full_name}</h2>
            {error && (
              <p role="alert" className="social-error">
                {error}
              </p>
            )}
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              aria-label="Report details"
              placeholder="Describe what happened. A moderator can review this report."
            />
            <button className="btn" disabled={busy}>
              Submit report
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setReport(null)}
            >
              Cancel
            </button>
          </form>
        </SocialModal>
      )}
      {creating && (
        <SocialModal
          close={() => setCreating(false)}
          label="Create private room"
        >
          <form
            className="social-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Create private room"
            onSubmit={(e) => {
              e.preventDefault();
              void act({
                action: "create",
                title: new FormData(e.currentTarget).get("title"),
                invitees: invites,
              });
            }}
          >
            <h2>Start a private study room</h2>
            {error && (
              <p role="alert" className="social-error">
                {error}
              </p>
            )}
            <p>
              Invite mutual connections. Each person chooses whether to join.
            </p>
            <input
              name="title"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Friday Python practice"
              aria-label="Room name"
            />
            {mutual.map((p) => (
              <label key={p.id} className="social-choice">
                <input
                  type="checkbox"
                  checked={invites.includes(p.id)}
                  disabled={!invites.includes(p.id) && invites.length >= 7}
                  onChange={(e) =>
                    setInvites(
                      e.target.checked
                        ? [...invites, p.id]
                        : invites.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.full_name}
              </label>
            ))}
            {!mutual.length && (
              <p>
                Follow a learner and ask them to follow you back. Clear your
                People search to see all available connections.
              </p>
            )}
            <button className="btn" disabled={busy || !invites.length}>
              Send invitations
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </form>
        </SocialModal>
      )}
    </div>
  );
}
