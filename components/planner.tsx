"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  Plus,
  Flame,
  Trash2,
  ListTodo,
  Heart,
  Timer,
  Sprout,
  Send,
} from "lucide-react";
import type { Operation, WorkspaceData } from "@/lib/workspace";
import { dayKey } from "@/lib/workspace";
import "./planner.css";

type Page = "tasks" | "habits" | "journal" | "pomodoro";
type Save = (op: Operation, message?: string) => Promise<boolean>;
const moods = ["Very low", "Low", "Okay", "Good", "Great"];
import { habitRun } from "@/lib/planner";
import TaskQuiz from "./task-quiz";
import { findCheckpoint, type CheckpointRef } from "@/lib/checkpoints";
import FocusAtmosphere from "./focus-atmosphere";
export default function Planner({
  data,
  mutate,
  pending,
  visible,
  navigationTrigger,
  workspaceTools,
  restoreFocus,
  openCheckpoint,
}: {
  data: WorkspaceData;
  mutate: Save;
  pending: boolean;
  visible: boolean;
  navigationTrigger?: ReactNode;
  workspaceTools?: ReactNode;
  restoreFocus: () => void;
  openCheckpoint: (checkpoint: CheckpointRef) => void;
}) {
  const [page, setPage] = useState<Page>("tasks");
  const [now, setNow] = useState(() => new Date());
  const today = dayKey(now);
  const [zone, setZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [date, setDate] = useState(today);
  const entry = data.personal.checkins.find((c) => c.date === date);
  const [mood, setMood] = useState(entry?.mood || 3),
    [journal, setJournal] = useState(entry?.journal || "");
  const [draft, setDraft] = useState(""),
    [budget, setBudget] = useState(25),
    [notice, setNotice] = useState("");
  const [quizEnabled, setQuizEnabled] = useState(false);
  const [taskCheckpoint, setTaskCheckpoint] = useState<CheckpointRef>();
  const [quizTopic, setQuizTopic] = useState("");
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizResultId, setQuizResultId] = useState<string | null>(null);
  const [taskTimes, setTaskTimes] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
    quizTopic?: string;
  } | null>(null);
  const focusCheckpoint = selected && data.personal.taskCheckpoints[selected.id];
  const focusJourney = focusCheckpoint && data.personal.journeys.find(
    (journey) => journey.id === focusCheckpoint.journeyId && journey.sections.some(
      (section) => section.modules.some((module) => module.id === focusCheckpoint.moduleId),
    ),
  );
  const focusPractice = focusJourney && focusCheckpoint && findCheckpoint(focusJourney.divisionId, focusCheckpoint.moduleId);
  const [minutes, setMinutes] = useState(25),
    [block, setBlock] = useState(25),
    [breakMinutes, setBreakMinutes] = useState(5);
  const [left, setLeft] = useState(25 * 60),
    [totalLeft, setTotalLeft] = useState(25 * 60);
  const [deadline, setDeadline] = useState<number | null>(null),
    [phase, setPhase] = useState<"focus" | "break">("focus");
  const [finished, setFinished] = useState(false),
    [saved, setSaved] = useState(false);
  const [message, setMessage] = useState(""),
    [sending, setSending] = useState(false);
  const [chat, setChat] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [chatError, setChatError] = useState("");
  const moodRequest = useRef<AbortController | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const fullFocus = visible && page === "pomodoro";
  const miniFocus = !fullFocus && sessionStarted;
  const toggleTimer = () => {
    if (deadline) {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining > 0) setDeadline(null);
    } else {
      setSessionStarted(true);
      setDeadline(Date.now() + left * 1000);
    }
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const updateDay = () => {
      clearTimeout(timer);
      const next = new Date();
      setNow((previous) =>
        dayKey(previous) === dayKey(next) ? previous : next,
      );
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      const midnight = new Date(next);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(
        updateDay,
        Math.min(60000, midnight.getTime() - next.getTime()),
      );
    };
    updateDay();
    document.addEventListener("visibilitychange", updateDay);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", updateDay);
    };
  }, []);
  useEffect(() => {
    setMood(entry?.mood || 3);
    setJournal(entry?.journal || "");
    setChat([]);
    setChatError("");
  }, [date]);
  useEffect(() => {
    if (visible && page === "journal")
      return () => moodRequest.current?.abort();
    setChat([]);
    setMessage("");
    setChatError("");
  }, [visible, page, date]);
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(
      () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      200,
    );
    return () => clearInterval(id);
  }, [deadline]);
  useEffect(() => {
    if (deadline && left === 0) {
      setDeadline(null);
      if (phase === "break") {
        setPhase("focus");
        setLeft(Math.min(block * 60, totalLeft));
      } else {
        const remaining = Math.max(
          0,
          totalLeft - Math.min(block * 60, totalLeft),
        );
        setTotalLeft(remaining);
        if (!remaining) setFinished(true);
        else {
          setPhase("break");
          setLeft(breakMinutes * 60);
        }
      }
    }
  }, [left, deadline, phase, block, totalLeft, breakMinutes]);
  useEffect(() => {
    const read = () => {
      const value = new URL(location.href).searchParams.get("planner") as Page;
      if (["tasks", "habits", "journal", "pomodoro"].includes(value))
        setPage(value);
      if (value === "tasks") {
        const practice = sessionStorage.getItem("skillswap.task-draft");
        if (practice) {
          sessionStorage.removeItem("skillswap.task-draft");
          try {
            const { title, topic, minutes, checkpoint } = JSON.parse(practice);
            if (typeof title !== "string" || typeof topic !== "string") return;
            setDraft(title.slice(0, 200));
            setQuizTopic(topic);
            setQuizEnabled(false);
            setTaskCheckpoint(
              typeof checkpoint?.journeyId === "string" && typeof checkpoint?.moduleId === "string" ? checkpoint : undefined,
            );
            if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 120)
              setBudget(minutes);
          } catch {
            // Ignore a malformed handoff and leave the planner usable.
          }
        }
      }
    };
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("skillswap:planner", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("skillswap:planner", read);
    };
  }, []);
  const go = (next: Page) => {
    setPage(next);
    const url = new URL(location.href);
    url.searchParams.set("planner", next);
    history.pushState({}, "", url);
    window.dispatchEvent(new Event("skillswap:planner"));
    window.scrollTo(0, 0);
  };
  const reset = (n = minutes) => {
    setQuizOpen(false);
    setQuizResultId(null);
    setSessionStarted(false);
    setDeadline(null);
    setPhase("focus");
    setTotalLeft(n * 60);
    setLeft(Math.min(n, block) * 60);
    setFinished(false);
    setSaved(false);
  };
  const startTask = (task: { id: string; title: string }) => {
    const n = taskTimes[task.id] || data.personal.taskMinutes[task.id] || 25;
    setSelected({ ...task, quizTopic: data.personal.taskQuizTopics[task.id] });
    setMinutes(n);
    reset(n);
    go("pomodoro");
  };
  const tabs = [
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "habits", label: "Habits", icon: Sprout },
    { id: "journal", label: "Mood & journal", icon: Heart },
    { id: "pomodoro", label: "Pomodoro", icon: Timer },
  ] as const;
  return (
    <div
      className={`planner-shell ${fullFocus ? "is-focus-room" : ""} ${visible ? "" : "planner-away"}`}
      data-tour={visible ? "planner" : undefined}
    >
      <nav className="planner-tabs" aria-label="Planner pages" hidden>
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={page === t.id ? "page" : undefined}
            onClick={() => go(t.id)}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </nav>
      {visible && !fullFocus && (
        <header className="planner-meta">
          {navigationTrigger}
          <div className="planner-date">
            <time dateTime={today}>
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </time>
            <span>{zone}</span>
          </div>
          {workspaceTools}
        </header>
      )}
      {notice && (
        <p role="status" className="planner-notice">
          {notice}
        </p>
      )}
      {page === "tasks" && (
        <section className="panel planner-page">
          <div className="planner-title">
            <div>
              <span className="planner-eyebrow">ONE THING AT A TIME</span>
              <h2>Your tasks</h2>
              <p>Plan the time. Pick a task. Give it your attention.</p>
            </div>
            <span>
              {data.tasks.filter((t) => t.done).length}/{data.tasks.length}{" "}
              complete
            </span>
          </div>
          <form
            className="planner-task-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  {
                    type: "task.add",
                    title: draft,
                    minutes: budget,
                    quizTopic: quizEnabled ? quizTopic : undefined,
                    checkpoint: taskCheckpoint,
                  },
                  "Task added",
                )
              ) {
                setDraft("");
                setQuizEnabled(false);
                setQuizTopic("");
                setTaskCheckpoint(undefined);
                setNotice(
                  "Task added. Press play beside it to start a focus session.",
                );
              }
            }}
          >
            <label>
              What do you want to work on?
              <input
                required
                minLength={2}
                maxLength={200}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Complete the Python exercise"
              />
            </label>
            <label>
              Focus minutes
              <input
                type="number"
                min={1}
                max={120}
                required
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </label>
            <button className="btn primary" disabled={pending}>
              <Plus size={16} />
              Add task
            </button>
            <div className="task-quiz-setting">
              {taskCheckpoint && <div className="task-quiz-label">
                Follow-up linked to this focus task. <button className="text-link" type="button" onClick={() => setTaskCheckpoint(undefined)}>Remove link</button>
              </div>}
              <label className="task-quiz-toggle">
                <input
                  type="checkbox"
                  checked={quizEnabled}
                  onChange={(event) => setQuizEnabled(event.target.checked)}
                  aria-describedby="task-quiz-help"
                />
                <span>
                  <strong>AI quiz after focus</strong>
                  <small id="task-quiz-help">Get three recall questions about your topic when the timer ends.</small>
                </span>
              </label>
              {quizEnabled && (
                <label className="task-quiz-topic">
                  What exactly are you studying?
                  <input
                    required
                    minLength={8}
                    maxLength={400}
                    value={quizTopic}
                    onChange={(event) => setQuizTopic(event.target.value)}
                    placeholder="e.g. Solve simultaneous equations using substitution"
                  />
                  <small>SkillSwap sends this topic to the AI when you start the quiz.</small>
                </label>
              )}
            </div>
          </form>
          {!data.tasks.length && (
            <p className="planner-empty">
              Your task list is clear. Add your first study task above.
            </p>
          )}
          {data.tasks.map((t) => (
            <div
              className={`planner-task ${t.done ? "is-done" : ""}`}
              key={t.id}
            >
              <button
                className="icon-btn"
                aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
                aria-pressed={t.done}
                disabled={pending}
                onClick={() => mutate({ type: "task.toggle", id: t.id })}
              >
                <Check size={18} />
              </button>
              <b>
                {t.title}
                {data.personal.taskQuizTopics[t.id] && (
                  <small className="muted task-quiz-label">
                    AI quiz after focus
                  </small>
                )}
              </b>
              <label>
                Focus minutes
                <input
                  aria-label={`Focus minutes for ${t.title}`}
                  type="number"
                  min={1}
                  max={120}
                  defaultValue={data.personal.taskMinutes[t.id] || 25}
                  key={`${t.id}-${data.personal.taskMinutes[t.id]}`}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 120)
                      setTaskTimes({ ...taskTimes, [t.id]: n });
                  }}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 120)
                      mutate({ type: "task.budget", id: t.id, minutes: n });
                  }}
                />
              </label>
              <button
                className="btn secondary"
                disabled={t.done}
                onClick={() => startTask(t)}
                aria-label={`Focus on ${t.title}`}
              >
                <Play size={15} />
                Focus
              </button>
              <button
                className="icon-btn"
                disabled={pending}
                aria-label={`Delete ${t.title}`}
                onClick={() => mutate({ type: "task.delete", id: t.id })}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      )}
      {page === "habits" && (
        <div className="planner-habit-columns">
          {(["build", "quit"] as const).map((kind) => (
            <section className={`panel habit-lane ${kind}`} key={kind}>
              <span className="planner-eyebrow">
                {kind === "build"
                  ? "MAKE IT A ROUTINE"
                  : "MAKE ROOM FOR BETTER"}
              </span>
              <h2>
                {kind === "build"
                  ? "Habits to build"
                  : "Habits to leave behind"}
              </h2>
              <div className="habit-lane-summary">
                <Flame size={22} />
                <strong>
                  {Math.max(
                    0,
                    ...data.personal.habits
                      .filter((h) => (h.kind || "build") === kind)
                      .map((h) => habitRun(h, now)),
                  )}
                </strong>
                <span>day best active streak</span>
              </div>
              <p>
                {kind === "build"
                  ? "Tick when you followed through today."
                  : "Tick when you stayed away from this habit today."}
              </p>
              {data.personal.habits
                .filter((h) => (h.kind || "build") === kind)
                .map((h) => {
                  const done = h.completed.includes(today),
                    scheduled = h.days.includes(now.getDay()),
                    run = habitRun(h, now);
                  return (
                    <article className="habit-tile" key={h.id}>
                      <div>
                        <h3>{h.title}</h3>
                        <span className="habit-streak">
                          <Flame size={15} />
                          {run} day streak
                        </span>
                      </div>
                      <button
                        className="habit-tick"
                        disabled={pending || !scheduled}
                        aria-pressed={done}
                        aria-label={`${kind === "build" ? "Completed" : "Avoided"} ${h.title} today`}
                        onClick={() =>
                          mutate({
                            type: "habit.toggle",
                            id: h.id,
                            date: today,
                            timeZone: zone,
                          })
                        }
                      >
                        {done ? <Check size={20} /> : "Tick today"}
                      </button>
                      <p className={done ? "" : "habit-warning"}>
                        {!scheduled
                          ? "Rest day — your streak is safe."
                          : done
                            ? "Today's check-in is saved."
                            : run
                              ? "Check in before midnight to keep your streak."
                              : "No check-in today. A missed scheduled day resets your streak."}
                      </p>
                      <button
                        className="text-link"
                        disabled={pending}
                        onClick={() =>
                          mutate({ type: "habit.delete", id: h.id })
                        }
                      >
                        Remove habit
                      </button>
                    </article>
                  );
                })}
              <form
                className="habit-create"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const title = String(new FormData(form).get("title"));
                  if (
                    await mutate(
                      {
                        type: "habit.add",
                        title,
                        kind,
                        days: [0, 1, 2, 3, 4, 5, 6],
                      },
                      "Daily habit added",
                    )
                  )
                    form.reset();
                }}
              >
                <label>
                  {kind === "build"
                    ? "A good habit to practice"
                    : "A habit you want to stop"}
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder={
                      kind === "build"
                        ? "Read for 15 minutes"
                        : "Late-night scrolling"
                    }
                  />
                </label>
                <button disabled={pending} className="btn secondary">
                  <Plus size={15} />
                  Add daily habit
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
      {page === "journal" && (
        <div className="planner-journal-grid">
          <section className="panel planner-page">
            <span className="planner-eyebrow">YOUR DAILY CHECK-IN</span>
            <h2>How was your day?</h2>
            <p className="habit-streak">
              <Flame size={15} />
              {habitRun(
                {
                  days: [0, 1, 2, 3, 4, 5, 6],
                  completed: data.personal.checkins.map((c) => c.date),
                },
                now,
              )}{" "}
              day check-in streak
            </p>
            <label>
              Journal date
              <input
                type="date"
                max={today}
                value={date}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= today)
                    setDate(e.target.value);
                }}
              />
            </label>
            <div
              className="planner-moods"
              role="group"
              aria-label="Today's mood"
            >
              {moods.map((label, i) => (
                <button
                  key={label}
                  aria-pressed={mood === i + 1}
                  onClick={() => {
                    setMood(i + 1);
                    setChat([]);
                  }}
                >
                  <span>{["☁", "☂", "◐", "☀", "✦"][i]}</span>
                  {label}
                </button>
              ))}
            </div>
            <label>
              Private journal
              <textarea
                rows={8}
                maxLength={6000}
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="What happened today? What would you like to remember?"
              />
            </label>
            <p className="muted">
              Your journal stays private. It is never automatically sent to the
              companion.
            </p>
            <button
              className="btn primary"
              disabled={pending}
              onClick={async () => {
                if (
                  await mutate(
                    {
                      type: "checkin.save",
                      date,
                      timeZone: zone,
                      mood,
                      journal,
                    },
                    "Daily check-in saved",
                  )
                )
                  setNotice("Check-in saved for " + date);
              }}
            >
              Save check-in
            </button>
            <div className="journal-dates">
              {data.personal.checkins.slice(0, 14).map((c) => (
                <button
                  key={c.date}
                  className="btn secondary"
                  onClick={() => setDate(c.date)}
                >
                  {c.date} · {moods[c.mood - 1]}
                </button>
              ))}
            </div>
          </section>
          <section className="panel planner-page mood-companion">
            <span className="planner-eyebrow">A MOMENT TO TALK</span>
            <h2>Your daily companion</h2>
            <p>Talk about your day, or ask for a little encouragement.</p>
            <span className="mood-context">Shared mood: {moods[mood - 1]}</span>
            <div className="mood-chat" aria-live="polite">
              {!chat.length && (
                <p className="planner-empty">
                  You can start wherever you like. What’s on your mind?
                </p>
              )}
              {chat.map((m, i) => (
                <div className={`mood-message ${m.role}`} key={i}>
                  <small>{m.role === "user" ? "You" : "Companion"}</small>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
            {chatError && (
              <p role="alert" className="form-error">
                {chatError}
              </p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                moodRequest.current?.abort();
                const controller = new AbortController();
                moodRequest.current = controller;
                setSending(true);
                setChatError("");
                const text = message;
                try {
                  const r = await fetch("/api/ai", {
                    method: "POST",
                    signal: controller.signal,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      mode: "mood",
                      mood,
                      prompt: text,
                      history: chat.slice(-12),
                    }),
                  });
                  const json = await r.json();
                  if (controller.signal.aborted) return;
                  if (!r.ok) throw new Error(json.error);
                  setChat([
                    ...chat,
                    { role: "user", content: text },
                    { role: "assistant", content: json.answer },
                  ]);
                  setMessage("");
                } catch (err) {
                  if (controller.signal.aborted) return;
                  setChatError(
                    err instanceof Error
                      ? err.message
                      : "Could not connect. Please try again.",
                  );
                } finally {
                  if (moodRequest.current === controller) {
                    moodRequest.current = null;
                    setSending(false);
                  }
                }
              }}
            >
              <label>
                Message your companion
                <textarea
                  required
                  minLength={2}
                  maxLength={4000}
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Today felt…"
                />
              </label>
              <button className="btn primary" disabled={sending}>
                {sending ? "Thinking…" : "Send message"}
                <Send size={14} />
              </button>
            </form>
            <small>
              Only your selected mood and messages you send are shared with AI.
              Conversations here clear when you switch dates or leave Planner.
            </small>
          </section>
        </div>
      )}
      <section
        hidden={!fullFocus && !miniFocus}
        className={`panel planner-page planner-focus ${miniFocus ? "focus-mini" : ""}`}
      >
        <div className="focus-session-heading">
          {fullFocus && navigationTrigger}
          <div>
            <span className="planner-eyebrow">
              {selected ? "TASK FOCUS" : "FOCUS ROOM"}
            </span>
            <h2 title={selected?.title || "Independent study"}>
              {selected?.title || "Independent study"}
            </h2>
          </div>
        </div>
        <div className="focus-options">
          <label>
            Total focus minutes
            <input
              type="number"
              min={1}
              max={120}
              disabled={!!deadline}
              value={minutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= 120) {
                  setMinutes(n);
                  reset(n);
                  if (selected)
                    mutate({
                      type: "task.budget",
                      id: selected.id,
                      minutes: n,
                    });
                }
              }}
            />
          </label>
          <label>
            Focus block
            <input
              type="number"
              min={1}
              max={120}
              disabled={!!deadline}
              value={block}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= 120) {
                  setBlock(n);
                  setDeadline(null);
                  setPhase("focus");
                  setTotalLeft(minutes * 60);
                  setLeft(Math.min(n, minutes) * 60);
                  setFinished(false);
                  setSaved(false);
                }
              }}
            />
          </label>
          <label>
            Break minutes
            <input
              type="number"
              min={1}
              max={60}
              disabled={!!deadline}
              value={breakMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= 60) setBreakMinutes(n);
              }}
            />
          </label>
        </div>
        <div className={`planner-clock ${phase}`}>
          <span>
            {finished
              ? "Session complete"
              : phase === "focus"
                ? "Focus time"
                : "Take a break"}
          </span>
          <strong role="timer" aria-label="Time remaining">
            {String(Math.floor(left / 60)).padStart(2, "0")}:
            {String(left % 60).padStart(2, "0")}
          </strong>
          <small>{minutes} minutes planned · breaks excluded</small>
        </div>
        <div className="focus-controls">
          <button
            className="btn primary"
            disabled={finished}
            onClick={toggleTimer}
          >
            {deadline ? <Pause size={17} /> : <Play size={17} />}{" "}
            {deadline
              ? "Pause"
              : phase === "break"
                ? "Start break"
                : "Start focus"}
          </button>
          <button className="btn secondary" onClick={() => reset()}>
            <RotateCcw size={16} />
            Reset
          </button>
          {finished && (
            <button
              className="btn primary"
              disabled={pending || saved}
              onClick={async () => {
                if (
                  await mutate(
                    {
                      type: "focus.complete",
                      minutes,
                      label: selected?.title || "Independent study",
                    },
                    "Focus session saved",
                  )
                )
                  setSaved(true);
              }}
            >
              {saved ? "Session saved" : "Save completed session"}
            </button>
          )}
          {fullFocus && selected && (
            <div className="task-focus-actions">
              {focusPractice && focusCheckpoint && (
                <details className="focus-checkpoint-guide">
                  <summary>Practice instructions</summary>
                  <p>{focusPractice.practice}</p>
                </details>
              )}
              {finished && focusPractice && focusCheckpoint && (
                <button type="button" className="btn primary" onClick={() => openCheckpoint(focusCheckpoint)}>
                  Return to the learning check
                </button>
              )}
              {selected.quizTopic && (
                <span>
                  {finished
                    ? "Your recall quiz is ready to start."
                    : "AI recall quiz after focus"}
                </span>
              )}
              {finished && selected.quizTopic && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setQuizResultId(quizResultId ?? crypto.randomUUID());
                    setQuizOpen(true);
                  }}
                >
                  Start quiz
                </button>
              )}
              {(!sessionStarted || finished) && (
                <button
                  className="text-link"
                  onClick={() => {
                    setSelected(null);
                    reset(25);
                    setMinutes(25);
                  }}
                >
                  Switch to independent study
                </button>
              )}
            </div>
          )}
        </div>
        {fullFocus &&
          finished &&
          selected?.quizTopic &&
          quizOpen &&
          quizResultId && (
            <TaskQuiz
              topic={selected.quizTopic}
              close={() => setQuizOpen(false)}
              save={(score) =>
                mutate(
                  {
                    type: "memory.add",
                    value: {
                      id: quizResultId,
                      title: selected.title,
                      note: `Post-focus quiz: ${score}/3 on ${selected.quizTopic}`,
                      source: "quiz",
                    },
                  },
                  "Quiz result saved",
                )
              }
            />
          )}
        {miniFocus && (
          <div
            className="focus-mini-actions"
            aria-label="Minimized focus session"
          >
            <button
              className="btn secondary"
              onClick={() => (visible ? go("pomodoro") : restoreFocus())}
            >
              Open focus room
            </button>
            {!finished && (
              <button className="btn primary" onClick={toggleTimer}>
                {deadline ? "Pause" : "Continue"}
              </button>
            )}
          </div>
        )}
        <FocusAtmosphere
          userId={data.userId}
          active={fullFocus || miniFocus}
          showSettings={fullFocus}
          toolbar={fullFocus ? workspaceTools : undefined}
        >
          <details className="focus-recent">
            <summary>Recent sessions</summary>
            {!data.personal.focus.length && <p>No completed sessions yet.</p>}
            {data.personal.focus.slice(0, 5).map((s) => (
              <p key={s.id}>
                {s.label}
                <span>
                  {s.minutes} min · {new Date(s.date).toLocaleDateString()}
                </span>
              </p>
            ))}
          </details>
        </FocusAtmosphere>
      </section>
    </div>
  );
}
