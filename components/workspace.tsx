"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCheck,
  Clock3,
  Code2,
  Compass,
  Copy,
  ExternalLink,
  FileCheck2,
  Film,
  Flame,
  GraduationCap,
  HelpCircle,
  Handshake,
  Heart,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Square,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Waypoints,
  X,
} from "lucide-react";
import Logo from "./logo";
import RewardsPanel from "./rewards";
import { rewardStatus } from "@/lib/rewards";
import StudyNudgeSettings from "./study-nudge-settings";
import CareerExplorer from "./career-explorer";
import WorkspaceAtlas from "./workspace-atlas";
const SocialCircle = dynamic(() => import("./social-circle"));
const StudyFeed = dynamic(() => import("./study-feed"));
const DiscoveryView = dynamic(() => import("./discovery-view"));
const StudyPartners = dynamic(() => import("./study-partners"));
const StudyGroups = dynamic(() => import("./study-groups"), {
  loading: () => (
    <section className="panel" role="status">
      Opening your study circle…
    </section>
  ),
});
const Planner = dynamic(() => import("./planner"), {
  loading: () => <p role="status">Opening your planner…</p>,
});
import CoachResponse from "./coach-response";
import { FirstVisit, WelcomeTour, HelpContact } from "./welcome-journey";
import SkillStudio, { ProfileStudio, StudioSettings } from "./skill-studio";
import { useProfilePicture } from "./profile-picture";
import type { Curriculum } from "@/lib/skill-paths";
import type { CheckpointRef } from "@/lib/checkpoints";
import { learningContext } from "@/lib/learning-context";
import {
  applyLocal,
  dayKey,
  normalizePersonal,
  emptyWorkspace,
  iso,
  learningPaths,
  operationSchema,
  safeLink,
  streak,
  templatePlan,
  uid,
  type ChatMessage,
  type Operation,
  type Personal,
  type Plan,
  type Room,
  type Skill,
  type WorkspaceData,
} from "@/lib/workspace";

type View =
  | "overview"
  | "exchange"
  | "coach"
  | "plans"
  | "classrooms"
  | "ledger"
  | "productivity"
  | "network"
  | "feed"
  | "clips"
  | "partners"
  | "people"
  | "messages"
  | "research"
  | "career"
  | "profile"
  | "settings";
type Role = "Student" | "Teacher" | "Recruiter";
const nav = [
  { id: "overview", label: "My learning", icon: LayoutDashboard },
  { id: "plans", label: "Skill studio", icon: Compass },
  { id: "coach", label: "AI coach", icon: Sparkles },
  { id: "research", label: "Research desk", icon: Search },
  { id: "productivity", label: "Planner", icon: Clock3 },
  { id: "career", label: "Career explorer", icon: TrendingUp },
] as const;
const studyNav = [
  { id: "people", label: "People", icon: Compass },
  { id: "messages", label: "Conversations", icon: MessageSquare },
  { id: "network", label: "Study groups", icon: GraduationCap },
  { id: "feed", label: "Learning feed", icon: MessageSquare },
  { id: "clips", label: "Veels", icon: Film },
  { id: "partners", label: "Skill partners", icon: Handshake },
] as const;
const aliases: Record<string, View> = {
  skills: "plans",
  exchange: "partners",
  classrooms: "network",
  ledger: "profile",
  achievements: "feed",
  veels: "clips",
  focus: "productivity",
};
const STORAGE = "skillswap.workspace.v2";
const preferenceValue = (p: Personal) => ({
  goal: p.goal,
  interests: p.interests,
  level: p.level,
  style: p.style,
  minutes: p.minutes,
  memory: p.memory,
  shareContext: p.shareContext,
  weeklyGoal: p.weeklyGoal,
});
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<
    string,
    string
  >;
}
function Empty({
  icon: Icon = BookOpen,
  title,
  children,
  action,
}: {
  icon?: typeof BookOpen;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${secondary ? "secondary" : "primary"} ${className}`}
    >
      {children}
    </button>
  );
}
function Dialog({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closer = useRef(onClose);
  closer.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        ) || [],
      ).filter((e) => e.offsetParent !== null);
    (focusable().find((e) => e.tagName === "INPUT") || focusable()[0])?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") closer.current();
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Heatmap({
  activity,
  clientReady,
  compact = false,
}: {
  activity: Personal["activity"];
  clientReady: boolean;
  compact?: boolean;
}) {
  const today = clientReady ? dayKey() : null;
  const days = useMemo(() => {
    // Wait for the browser's locale and time zone before grouping activity.
    // Keep the grid the same size during hydration.
    if (!today) return [];
    const counts = new Map<string, number>();
    activity.forEach((a) => {
      const key = dayKey(a.date);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from({ length: 91 }, (_, i) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - 90 + i);
      const key = dayKey(d);
      return {
        key,
        label: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        count: counts.get(key) || 0,
      };
    });
  }, [activity, today]);
  return (
    <span className={`heatmap-wrap ${compact ? "compact" : ""}`}>
      <span
        className="heatmap"
        role="img"
        aria-label={
          today
            ? `${days.reduce((total, day) => total + day.count, 0)} learning activities over the last 91 days`
            : "Loading learning activity"
        }
      >
        {!today &&
          Array.from({ length: 91 }, (_, i) => (
            <span key={i} className="heat-cell heat-0" />
          ))}
        {days.map((d) => (
          <span
            key={d.key}
            className={`heat-cell heat-${Math.min(d.count, 4)}`}
            title={`${d.label}: ${d.count} ${d.count === 1 ? "activity" : "activities"}`}
          />
        ))}
      </span>
      <span className="heatmap-caption">
        <span>Last 91 days</span>
        <span>
          Less <i className="heat-cell" />
          <i className="heat-cell heat-2" />
          <i className="heat-cell heat-4" /> More
        </span>
      </span>
    </span>
  );
}
function Mark({ type, className = "" }: { type: string; className?: string }) {
  const Icon =
    type === "code"
      ? Code2
      : type === "design"
        ? Square
        : type === "data"
          ? BrainCircuit
          : AudioLines;
  return (
    <div className={`path-art ${type} ${className}`}>
      <span className="art-orbit orbit-one" />
      <span className="art-orbit orbit-two" />
      <span className="art-dot" />
      <Icon strokeWidth={1.2} />
      <span className="art-grid" />
    </div>
  );
}

export default function Workspace({
  initialData,
  connected = false,
  initialError = "",
  initialRole = "Student",
}: {
  initialData?: WorkspaceData;
  connected?: boolean;
  initialError?: string;
  initialRole?: Role;
}) {
  const [data, setData] = useState<WorkspaceData>(
    () => initialData || emptyWorkspace(),
  );
  const current = useRef(data);
  current.current = data;
  const [ready, setReady] = useState(connected),
    [view, setView] = useState<View>("overview"),
    [role] = useState<Role>(initialRole),
    [accountOpen, setAccountOpen] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  const profilePicture = useProfilePicture(
    ready ? data.userId : null,
    connected,
  );
  const [modal, setModal] = useState<string | null>(null),
    [selectedSkill, setSelectedSkill] = useState<Skill | null>(null),
    [selectedProof] = useState<string | null>(null),
    [deleteOp, setDeleteOp] = useState<Operation | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(initialError),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState({
      configured: false,
      localAllowed: false,
      models: [] as { id: string; label: string }[],
    }),
    [aiBusy, setAiBusy] = useState(false),
    [coachMode, setCoachMode] = useState<
      "coach" | "quiz" | "review" | "career"
    >("coach"),
    [prompt, setPrompt] = useState(""),
    [aiError, setAiError] = useState("");
  const [theme, setTheme] = useState("dark");
  const [plannerPage, setPlannerPage] = useState("tasks");
  const [plannerVisited, setPlannerVisited] = useState(false);
  const [checkpointToOpen, setCheckpointToOpen] = useState<CheckpointRef>();
  useEffect(() => {
    if (view === "productivity") setPlannerVisited(true);
  }, [view]);
  const [clientReady, setClientReady] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false),
    [welcomeDismissed, setWelcomeDismissed] = useState(false),
    [tourHidden, setTourHidden] = useState(false);
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    setClientReady(true);
    if (!connected) {
      try {
        setHasLocalBackup(!!localStorage.getItem(STORAGE + ".backup"));
        const stored = localStorage.getItem(STORAGE);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.version === 2 && parsed.data?.userId === "local-learner")
            setData({
              ...emptyWorkspace(),
              ...parsed.data,
              personal: normalizePersonal(parsed.data.personal),
            });
        }
      } catch {
        setError(
          "Your saved local workspace could not be read. Export a backup before clearing browser data.",
        );
      }
      setReady(true);
    }
    setTheme(localStorage.getItem("skillswap.theme") || "dark");
    const restore = () => {
      const params = new URLSearchParams(location.search);
      const tab = params.get("tab");
      if (
        tab &&
        (nav.some((n) => n.id === tab) ||
          studyNav.some((n) => n.id === tab) ||
          ["profile", "settings"].includes(tab))
      )
        setView(tab as View);
      else if (tab && aliases[tab]) setView(aliases[tab]);
      setSelectedRoom(params.get("room"));
      setPlannerPage(params.get("planner") || "tasks");
    };
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener("skillswap:planner", restore);
    const shortcut = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    fetch("/api/ai")
      .then((r) => r.json())
      .then(setAiStatus)
      .catch(() => {});
    const sync = (e: StorageEvent) => {
      if (!connected && e.key === STORAGE && e.newValue) {
        try {
          const incoming = JSON.parse(e.newValue).data;
          setData({
            ...incoming,
            personal: normalizePersonal(incoming.personal),
          });
        } catch {}
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("skillswap:planner", restore);
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener("storage", sync);
    };
  }, [connected]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("skillswap.theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [data.personal.chat, aiBusy]);
  useEffect(() => {
    document.documentElement.dataset.accent = data.personal.experience.accent;
    return () => {
      delete document.documentElement.dataset.accent;
    };
  }, [data.personal.experience.accent]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".account-dropdown"))
        setAccountOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  useEffect(() => {
    if (view === "coach") {
      const question = sessionStorage.getItem("skillswap.coach-question");
      if (question) {
        setPrompt(question);
        sessionStorage.removeItem("skillswap.coach-question");
      }
    }
  }, [view]);
  const go = (target: View, planner?: string) => {
    target = aliases[target] || target;
    if (target !== "overview") setCheckpointToOpen(undefined);
    navigation.current?.hidePopover();
    setAccountOpen(false);
    window.scrollTo(0, 0);
    setView(target);
    setQuery("");
    const url = new URL(location.href);
    url.searchParams.set("tab", target);
    if (planner) url.searchParams.set("planner", planner);
    if (target !== "classrooms") url.searchParams.delete("room");
    history.pushState({}, "", url);
    if (planner) window.dispatchEvent(new Event("skillswap:planner"));
  };
  const workspaceRevision = useRef(0);
  const refreshRequest = useRef<{
    room: string | null;
    promise: Promise<void>;
  } | null>(null);
  const refresh = useCallback(() => {
    if (!connected || busy.current) return Promise.resolve();
    if (refreshRequest.current?.room === selectedRoom)
      return refreshRequest.current.promise;
    const request = {
      room: selectedRoom,
      promise: Promise.resolve(),
    };
    request.promise = (async () => {
      const revision = workspaceRevision.current;
      const r = await fetch(
        "/api/workspace" +
          (selectedRoom ? "?room=" + encodeURIComponent(selectedRoom) : ""),
        { cache: "no-store" },
      );
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      // Ignore stale reads and avoid rerendering every screen for unchanged data.
      if (
        busy.current ||
        revision !== workspaceRevision.current ||
        refreshRequest.current !== request
      )
        return;
      if (JSON.stringify(current.current) !== JSON.stringify(json)) {
        current.current = json;
        setData(json);
      }
    })().finally(() => {
      if (refreshRequest.current === request) refreshRequest.current = null;
    });
    refreshRequest.current = request;
    return request.promise;
  }, [connected, selectedRoom]);
  useEffect(() => {
    if (!connected) return;
    const sync = () => {
      if (document.visibilityState === "visible" && !busy.current)
        refresh().catch(() => {});
    };
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    // Cross-device updates can wait; foreground and reconnect still refresh immediately.
    const interval = setInterval(sync, 120000);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
      clearInterval(interval);
    };
  }, [connected, refresh]);
  const mutate = async (input: Operation, message = "", close = false) => {
    if (busy.current) return false;
    workspaceRevision.current += 1;
    busy.current = true;
    setPending(true);
    setError("");
    const previous = current.current;
    let optimistic = false;
    try {
      const op = operationSchema.parse(input);
      if (connected && ["task.toggle", "habit.toggle"].includes(op.type)) {
        const preview = applyLocal(previous, op);
        current.current = preview;
        setData(preview);
        optimistic = true;
      }
      let next: WorkspaceData;
      if (connected) {
        const r = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        next = op.type === "checkpoint.answer"
          ? { ...previous, personal: { ...previous.personal, checkpointAttempts: json.checkpointAttempts } }
          : json;
      } else {
        let latest = current.current;
        const saved = localStorage.getItem(STORAGE);
        if (saved) {
          try {
            latest = JSON.parse(saved).data;
          } catch {}
        }
        next = applyLocal(latest, op);
        localStorage.setItem(
          STORAGE,
          JSON.stringify({ version: 2, data: next }),
        );
      }
      current.current = next;
      setData(next);
      if (message) setToast(message);
      if (close) setModal(null);
      return true;
    } catch (e) {
      if (optimistic) {
        current.current = previous;
        setData(previous);
      }
      setError(
        e instanceof Error
          ? e.message
          : "Could not save changes. Please try again.",
      );
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Copied to clipboard");
    } catch {
      setError("Clipboard is unavailable. Select and copy the text manually.");
    }
  };
  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 2, exported_at: iso(), data }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `skillswap-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("Workspace exported");
  };
  const confirmDelete = (op: Operation) => {
    setDeleteOp(op);
    setModal("delete");
  };
  const aiReady = aiStatus.configured && (connected || aiStatus.localAllowed);
  const ask = async (
    mode: "coach" | "plan" | "quiz" | "review" | "career" | "division",
    question: string,
    curriculum?: Curriculum,
  ): Promise<string | null> => {
    if (aiBusy) return null;
    setAiBusy(true);
    setAiError("");
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: question,
          history: ["plan", "division"].includes(mode)
            ? []
            : data.personal.chat.slice(-10),
          model: aiStatus.models?.some(
            (m) => m.id === data.personal.experience.aiModel,
          )
            ? data.personal.experience.aiModel
            : undefined,
          curriculum,
          context: learningContext(data),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      return json.answer;
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "The coach is unavailable.");
      return null;
    } finally {
      setAiBusy(false);
    }
  };
  const sendCoach = async (
    e?: FormEvent,
    question = prompt,
    mode = coachMode,
  ) => {
    e?.preventDefault();
    if (question.trim().length < 2) return;
    const history = data.personal.chat;
    const userMessage: ChatMessage = { role: "user", content: question.trim() };
    if (
      !(await mutate({
        type: "chat.save",
        value: [...history, userMessage].slice(-40),
      }))
    )
      return;
    setPrompt("");
    const answer = await ask(mode, question.trim());
    if (answer)
      await mutate({
        type: "chat.save",
        value: [
          ...history,
          userMessage,
          { role: "assistant" as const, content: answer },
        ].slice(-40),
      });
  };
  const createPlan = async (e: FormEvent<HTMLFormElement>) => {
    const v = values(e);
    let plan: Plan;
    if (v.source === "ai") {
      const result = await ask(
        "plan",
        `Build a personalized learning path for: ${v.goal}. I have ${data.personal.minutes} minutes per day.`,
      );
      if (!result) return;
      try {
        const parsed = JSON.parse(
          result.replace(/^```(?:json)?\s*|\s*```$/g, ""),
        );
        plan = {
          id: uid(),
          title: parsed.title,
          source: "ai",
          steps: parsed.steps.map(
            (s: { title: string; description: string }) => ({
              ...s,
              done: false,
            }),
          ),
          created_at: iso(),
        };
      } catch {
        setAiError(
          "The coach returned an unreadable plan. Try again or use the offline planner.",
        );
        return;
      }
    } else plan = templatePlan(v.goal, data.personal.minutes);
    if (
      await mutate(
        { type: "plan.add", value: plan },
        "Your learning path is ready",
        true,
      )
    )
      go("plans");
  };

  const me = data.userId,
    p = data.personal;
  const ownSkills = data.skills.filter((s) => s.student_id === me);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weeklyDays = new Set(
    p.activity
      .filter((a) => new Date(a.date) >= weekStart)
      .map((a) => dayKey(a.date)),
  ).size;
  const incoming = data.exchanges.filter(
    (e) => e.receiver_id === me && e.status === "pending",
  );
  const person = (id: string) =>
    id === me
      ? data.profile.full_name || "You"
      : data.people.find((p) => p.id === id)?.full_name ||
        data.people.find((p) => p.id === id)?.username ||
        "Learner";
  const displayName =
    p.onboarding.answers?.displayName || data.profile.full_name;
  const initial = (displayName || "You")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const circlePage = studyNav.find((entry) => entry.id === view);
  const headingActions: Partial<Record<View, string>> = {
    exchange: "List a skill",
    ledger: "Add proof",
    classrooms: "Create classroom",
    coach: "Personalize coach",
    profile: "Learning preferences",
    settings: "Learning preferences",
    career: "Set your goals",
  };
  const title =
    view === "overview"
      ? "My learning"
      : nav.find((n) => n.id === view)?.label ||
        circlePage?.label ||
        (view === "profile" ? "Your learning identity" : "Make it yours");
  const sub: Record<View, string> = {
    overview: "Your enrolled skills, progress, and next steps in one place.",
    exchange:
      "Your knowledge is your currency. Find your next learning partner.",
    coach:
      "Less searching. More understanding. A learning companion that gets you.",
    plans:
      "Explore ready-made skills or create a curriculum shaped around your goals.",
    classrooms: "Good questions. Shared knowledge. A place to grow together.",
    ledger: "Show what you can do. Keep the work that proves it.",
    productivity:
      "Plan your tasks, build habits, and make room for daily reflection.",
    people: "Build connections around what you want to learn.",
    messages: "Private study conversations and progress with your people.",
    network: "Find your study circle and learn together.",
    feed: "Full lessons, useful web sources, and community learning posts.",
    clips: "Short lessons and field updates picked for your studies.",
    partners: "Find complementary skills and arrange a learning exchange.",
    research: "Search the web for useful learning material on any study topic.",
    career: "Connect what you know to what you could become.",
    profile: "Help the community — and your coach — understand you.",
    settings: "Your preferences, your data, your learning experience.",
  };
  if (!ready)
    return (
      <div className="loading-screen">
        <Logo />
        <LoaderCircle className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (welcomeOpen || (p.onboarding.status === "pending" && !welcomeDismissed))
    return (
      <FirstVisit
        data={data}
        save={mutate}
        pending={pending}
        error={error}
        done={() => {
          setWelcomeOpen(false);
          setWelcomeDismissed(true);
          setTourHidden(false);
          go("overview");
        }}
      />
    );
  const momentum = rewardStatus(
    p.activity,
    p.rewards,
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const learningStreak = momentum.streak;
  const navigationTrigger = (
    <button
      type="button"
      className="icon-btn workspace-menu-trigger"
      popoverTarget="workspace-navigation"
      aria-label="Workspace menu"
      title="Workspace menu"
    >
      <Menu size={19} />
    </button>
  );
  const workspaceTools = (
    <div className="workspace-tools">
      <div className="top-actions">
        <button
          className="icon-btn notification-btn"
          aria-label="View activity and requests"
          onClick={() => setModal("notifications")}
        >
          <Bell size={17} />
          {incoming.length > 0 && <i />}
        </button>
        <div className="account-dropdown">
          <button
            className="avatar small-avatar"
            aria-label="Account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            {profilePicture.url ? (
              <img className="avatar-image" src={profilePicture.url} alt="" />
            ) : (
              initial
            )}
          </button>
          {accountOpen && (
            <div className="account-dropdown-menu">
              <b>{displayName || "Your account"}</b>
              <button onClick={() => go("profile")}>
                <GraduationCap size={15} />
                My profile
              </button>
              <button onClick={() => go("settings")}>
                <Settings2 size={15} />
                Settings
              </button>
              <button
                onClick={() => {
                  setAccountOpen(false);
                  setModal("rewards");
                }}
              >
                <Sparkles size={15} /> Rewards · {momentum.balance} Sparks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return (
    <div
      className="app-shell"
      data-reward-theme={p.rewards.theme}
      data-reward-frame={p.rewards.frame}
      data-tour-step={
        !tourHidden && p.tour.status === "active" ? p.tour.step : undefined
      }
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside
        ref={navigation}
        id="workspace-navigation"
        className="workspace-menu"
        popover="auto"
        aria-label="Workspace navigation"
      >
        <header className="workspace-menu-heading">
          <a href="/" aria-label="SkillSwap home">
            <Logo />
          </a>
          <button
            type="button"
            className="icon-btn"
            popoverTarget="workspace-navigation"
            popoverTargetAction="hide"
            aria-label="Close workspace menu"
          >
            <X size={17} />
          </button>
        </header>
        <WorkspaceAtlas
          view={view}
          planner={plannerPage}
          go={(target, page) => go(target as View, page)}
        />
        <div className="workspace-menu-footer">
          <button
            className="nav-item"
            onClick={() => {
              navigation.current?.hidePopover();
              setModal("help");
            }}
          >
            <HelpCircle size={18} />
            Help & shortcuts
          </button>
        </div>
      </aside>
      <div className="app-body">
        <main
          className={`workspace-main ${view === "productivity" ? "workspace-planner" : ""} ${view === "clips" ? "workspace-veels" : ""}`}
          id="main"
        >
          {view !== "productivity" && (
            <header className="workspace-heading">
              {workspaceTools}
              <div className="page-heading">
                <div className="workspace-page-title">
                  {navigationTrigger}
                  <div>
                    <div className="eyebrow">
                      {view === "overview"
                        ? `${clientReady ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + " · " : ""}YOUR NEXT CHAPTER`
                        : role.toUpperCase() + " WORKSPACE"}
                    </div>
                    <h1>{title}</h1>
                    <p>{sub[view]}</p>
                  </div>
                </div>
                {view === "overview" ? (
                  <button
                    type="button"
                    className="heading-activity"
                    aria-label={`${learningStreak}-day streak. View learning activity`}
                    aria-haspopup="dialog"
                    onClick={() => setModal("streak")}
                  >
                    <span className="heading-activity-title">
                      <Flame size={16} />
                      <b>{learningStreak}-day streak</b>
                      <ArrowUpRight size={14} />
                    </span>
                    <Heatmap
                      activity={p.activity}
                      clientReady={clientReady}
                      compact
                    />
                  </button>
                ) : headingActions[view] ? (
                  <Button
                    onClick={() =>
                      setModal(
                        view === "exchange"
                          ? "skill"
                          : view === "ledger"
                            ? "proof"
                            : view === "classrooms"
                              ? "room"
                              : "personalize",
                      )
                    }
                    secondary={[
                      "coach",
                      "profile",
                      "settings",
                      "career",
                    ].includes(view)}
                  >
                    {["exchange", "ledger", "classrooms", "plans"].includes(
                      view,
                    ) ? (
                      <Plus size={16} />
                    ) : (
                      <Settings2 size={16} />
                    )}
                    {headingActions[view]}
                  </Button>
                ) : null}
              </div>
            </header>
          )}
          {!connected && (
            <div className="local-banner">
              <span>
                <i />
                Your personal workspace <b>·</b> Progress saves in this browser.
              </span>
              <Link href="/auth">
                Connect an account <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {error && (
            <div className="alert error-alert" role="alert">
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                className="icon-btn"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {(["overview", "plans"] as string[]).includes(view) && (
            <SkillStudio
              view={view as "overview" | "plans"}
              searchTerm={query}
              openCheckpoint={checkpointToOpen}
              data={data}
              mutate={mutate}
              pending={pending}
              connected={connected}
              aiReady={aiReady}
              aiBusy={aiBusy}
              aiError={aiError}
              ask={ask}
              go={go}
            />
          )}

          {view === "coach" && (
            <div className="coach-layout">
              <section className="panel coach-chat" data-tour="coach">
                <div className="chat-header">
                  <span className="spark-icon">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <b>Your learning companion</b>
                    <small>
                      {aiReady
                        ? "Connected · tailored to your learning preferences"
                        : "AI connection needed · offline planning available"}
                    </small>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label="Clear conversation"
                    disabled={!p.chat.length || aiBusy}
                    onClick={() => {
                      setDeleteOp({ type: "chat.save", value: [] });
                      setModal("delete");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div
                  className="coach-modes"
                  role="group"
                  aria-label="Learning mode"
                >
                  {(
                    [
                      ["coach", "Learn with me"],
                      ["quiz", "Quiz me"],
                      ["review", "Review my work"],
                      ["career", "Career guidance"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      className={coachMode === id ? "active" : ""}
                      key={id}
                      onClick={() => setCoachMode(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="chat-scroll">
                  {!p.chat.length ? (
                    <div className="coach-welcome">
                      <div className="coach-orb">
                        <Sparkles size={38} strokeWidth={1.2} />
                      </div>
                      <span className="eyebrow">
                        YOUR CURIOSITY. YOUR PACE.
                      </span>
                      <h2>Let’s make it click.</h2>
                      <p>
                        {p.goal
                          ? `You're working toward ${p.goal}. What would help you move forward today?`
                          : "A tricky concept, a big ambition, or a “where do I even start?” — bring it here."}
                      </p>
                      <div className="suggestion-grid">
                        {[
                          {
                            icon: Waypoints,
                            text: "Break my goal into a learning plan",
                            action: () => setModal("plan"),
                          },
                          {
                            icon: BrainCircuit,
                            text: "Explain a concept step by step",
                            action: () => setPrompt("Help me understand "),
                          },
                          {
                            icon: CheckCheck,
                            text: "Test what I really understand",
                            action: () => {
                              setCoachMode("quiz");
                              setPrompt(
                                `Quiz me on ${p.goal || "a skill I’m learning"}. Ask one question at a time.`,
                              );
                            },
                          },
                          {
                            icon: Code2,
                            text: "Give me a project to practice",
                            action: () =>
                              setPrompt(
                                `Suggest a small practice project for ${p.goal || "my interests"}.`,
                              ),
                          },
                        ].map((s) => (
                          <button key={s.text} onClick={s.action}>
                            <s.icon size={17} />
                            <span>{s.text}</span>
                            <ArrowUpRight size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    p.chat.map((m, i) => (
                      <div className={`chat-message ${m.role}`} key={i}>
                        <span
                          className={
                            m.role === "assistant" ? "spark-icon" : "avatar"
                          }
                        >
                          {m.role === "assistant" ? (
                            <Sparkles size={16} />
                          ) : (
                            initial
                          )}
                        </span>
                        <div>
                          <b>
                            {m.role === "assistant" ? "SkillSwap coach" : "You"}
                          </b>
                          <div className="message-content">
                            {m.role === "assistant" ? (
                              <CoachResponse content={m.content} />
                            ) : (
                              m.content
                            )}
                          </div>
                          {m.role === "assistant" && (
                            <button
                              className="chat-copy"
                              onClick={() => copy(m.content)}
                            >
                              <Copy size={12} />
                              Copy response
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {aiBusy && (
                    <div className="coach-thinking" role="status">
                      <Sparkles size={16} />
                      <span>Connecting the dots…</span>
                      <LoaderCircle size={15} className="spin" />
                    </div>
                  )}
                  <div ref={chatEnd} />
                </div>
                {aiError && (
                  <div className="alert error-alert" role="alert">
                    {aiError}
                    <button
                      className="icon-btn"
                      onClick={() => setAiError("")}
                      aria-label="Dismiss coach error"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {!aiReady && (
                  <div className="ai-offline">
                    <Lightbulb size={17} />
                    <span>
                      The conversational coach needs an AI connection. You can
                      build a structured offline plan right now.
                    </span>
                    <button onClick={() => setModal("plan")}>
                      Build a plan <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
                <form className="coach-input" onSubmit={sendCoach}>
                  <textarea
                    aria-label="Message your AI learning coach"
                    placeholder={
                      coachMode === "quiz"
                        ? "What would you like to practice?"
                        : coachMode === "review"
                          ? "Paste your work and tell me what feedback would help…"
                          : "Ask a question. Untangle an idea. Find your next step…"
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={4000}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (aiReady && !aiBusy && prompt.trim().length >= 2)
                          sendCoach();
                      }
                    }}
                  />
                  <button
                    aria-label="Send to AI coach"
                    disabled={
                      !aiReady || aiBusy || pending || prompt.trim().length < 2
                    }
                  >
                    <ArrowRight size={20} />
                  </button>
                </form>
                <div className="coach-disclaimer">
                  AI can make mistakes. Check important details.{" "}
                  <span>Enter to send · Shift + Enter for a new line</span>
                </div>
              </section>
              <aside className="coach-context">
                <section className="panel">
                  <div className="section-head">
                    <h2>Built around you</h2>
                    <button
                      className="icon-btn"
                      aria-label="Edit coach preferences"
                      onClick={() => setModal("personalize")}
                    >
                      <Settings2 size={16} />
                    </button>
                  </div>
                  <div className="context-item">
                    <Target size={17} />
                    <div>
                      <span>YOUR NORTH STAR</span>
                      <p>{p.goal || "A goal worth getting out of bed for."}</p>
                    </div>
                  </div>
                  <div className="context-item">
                    <BrainCircuit size={17} />
                    <div>
                      <span>YOUR STARTING POINT</span>
                      <p className="capitalize">{p.level}</p>
                    </div>
                  </div>
                  <div className="context-item">
                    <Clock3 size={17} />
                    <div>
                      <span>A LITTLE TIME, EVERY DAY</span>
                      <p>
                        {p.minutes} minutes · {p.style.toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <div className="context-note">
                    <ShieldCheck size={16} />
                    <p>
                      {p.shareContext
                        ? "Your saved goals, skills, study progress, and explicit memory can personalize AI replies."
                        : "Personalization is off. Only your messages are shared with the coach."}
                    </p>
                  </div>
                  <Button
                    secondary
                    className="full"
                    onClick={() => setModal("personalize")}
                  >
                    Personalize my coach <ArrowUpRight size={15} />
                  </Button>
                </section>
                <section className="coach-note">
                  <span>✦</span>
                  <h3>Understanding beats memorizing.</h3>
                  <p>
                    Try asking “why does this work?” or “give me a different
                    example.” Your coach can adapt its explanation.
                  </p>
                </section>
              </aside>
            </div>
          )}

          {(view === "productivity" || plannerVisited) && (
            <Planner
              data={data}
              mutate={mutate}
              pending={pending}
              visible={view === "productivity"}
              navigationTrigger={
                view === "productivity" ? navigationTrigger : undefined
              }
              workspaceTools={
                view === "productivity" ? workspaceTools : undefined
              }
              restoreFocus={() => go("productivity", "pomodoro")}
              openCheckpoint={(checkpoint) => {
                setCheckpointToOpen(checkpoint);
                go("overview");
              }}
            />
          )}

          {view === "career" && (
            <CareerExplorer
              data={data}
              planPractice={(title, topic) => {
                sessionStorage.setItem(
                  "skillswap.task-draft",
                  JSON.stringify({ title, topic }),
                );
                go("productivity", "tasks");
              }}
              explore={(title) => {
                go("plans");
                setQuery(title);
              }}
              coach={(question) => {
                go("coach");
                setCoachMode("career");
                setPrompt(question);
              }}
            />
          )}
          {(view === "people" || view === "messages") && (
            <SocialCircle
              key={view}
              connected={connected}
              initialTab={view === "messages" ? "inbox" : "people"}
              navigate={(target) => go(target)}
            />
          )}
          {view === "network" && (
            <StudyGroups data={data} connected={connected} />
          )}
          {view === "research" &&
            (connected ? (
              <DiscoveryView mode="research" />
            ) : (
              <p className="panel muted">
                Sign in to search for learning resources.
              </p>
            ))}
          {(view === "feed" || view === "clips") && (
            <StudyFeed
              key={view}
              data={data}
              connected={connected}
              kind={view === "clips" ? "clip" : "post"}
              refreshWorkspace={refresh}
              shareMilestone={() => setModal("proof")}
              removeMilestone={(id) => {
                setDeleteOp({ type: "proof.delete", id });
                setModal("delete");
              }}
            />
          )}
          {view === "partners" && (
            <StudyPartners
              data={data}
              connected={connected}
              pending={pending}
              mutate={mutate}
              add={() => setModal("skill")}
              invite={(skill) => {
                setSelectedSkill(skill);
                setModal("exchange");
              }}
              remove={(id) => {
                setDeleteOp({ type: "skill.delete", id });
                setModal("delete");
              }}
            />
          )}

          {view === "profile" && (
            <ProfileStudio
              data={data}
              mutate={mutate}
              pending={pending}
              connected={connected}
              picture={profilePicture}
            />
          )}

          {view === "settings" && (
            <div className="settings-stack">
              {connected && (
                <StudyNudgeSettings
                  value={p.studyNudges}
                  mutate={mutate}
                  pending={pending}
                />
              )}
              <StudioSettings
                data={data}
                mutate={mutate}
                pending={pending}
                models={aiStatus.models || []}
              />
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Your learning experience</h2>
                    <p>A few preferences make this space feel more like you.</p>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Appearance</h3>
                    <p>Choose the setting that feels comfortable.</p>
                  </div>
                  <div className="tabs">
                    <button
                      className={theme === "dark" ? "active" : ""}
                      onClick={() => setTheme("dark")}
                    >
                      Dark
                    </button>
                    <button
                      className={theme === "light" ? "active" : ""}
                      onClick={() => setTheme("light")}
                    >
                      Light
                    </button>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Personalized learning</h3>
                    <p>
                      Goals, explanation style, study time, and explicit coach
                      memory.
                    </p>
                  </div>
                  <Button secondary onClick={() => setModal("personalize")}>
                    Edit preferences <Settings2 size={14} />
                  </Button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>AI context sharing</h3>
                    <p>
                      Include your saved preferences, skills, and progress in
                      coach requests. Your conversation is still sent when this
                      is off.
                    </p>
                  </div>
                  <button
                    className={`toggle ${p.shareContext ? "on" : ""}`}
                    role="switch"
                    aria-checked={p.shareContext}
                    aria-label="Share learning context with AI coach"
                    disabled={pending}
                    onClick={() =>
                      mutate(
                        {
                          type: "preferences",
                          value: {
                            ...preferenceValue(p),
                            shareContext: !p.shareContext,
                          },
                        },
                        "Coach personalization updated",
                      )
                    }
                  >
                    <span />
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Your data stays yours.</h2>
                    <p>Know where your progress lives and keep a copy.</p>
                  </div>
                  <ShieldCheck size={21} className="mint-text" />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Workspace storage</h3>
                    <p>
                      {connected
                        ? "Saved to your account. Only deliberately published curricula and basic profile details are shared. Planner records and learning reflections remain private."
                        : "Saved only in this browser on this device. Clearing browser data removes local progress. Local data does not automatically migrate when you sign in."}
                    </p>
                  </div>
                  <Badge tone={connected ? "mint" : "amber"}>
                    {connected ? "CONNECTED" : "LOCAL"}
                  </Badge>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Export your workspace</h3>
                    <p>
                      Download a JSON copy of your current workspace, including
                      your learning preferences and conversation.
                    </p>
                  </div>
                  <Button secondary onClick={exportData}>
                    Export data <ArrowDownToLine size={15} />
                  </Button>
                </div>
                {!connected && (
                  <div className="setting-row">
                    <div>
                      <h3>A fresh local workspace</h3>
                      <p>
                        Start over on this device. We keep one local recovery
                        snapshot so you can restore your previous workspace.
                      </p>
                    </div>
                    <div className="button-row">
                      {hasLocalBackup && (
                        <Button
                          secondary
                          onClick={() => setModal("local-restore")}
                        >
                          Restore snapshot
                        </Button>
                      )}
                      <Button secondary onClick={() => setModal("local-reset")}>
                        Start fresh
                      </Button>
                    </div>
                  </div>
                )}
                <div className="setting-row">
                  <div>
                    <h3>Coach conversation</h3>
                    <p>Clear the conversation saved in your workspace.</p>
                  </div>
                  <Button
                    secondary
                    disabled={!p.chat.length}
                    onClick={() =>
                      confirmDelete({ type: "chat.save", value: [] })
                    }
                  >
                    Clear conversation <Trash2 size={14} />
                  </Button>
                </div>
              </section>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Account & connections</h2>
                    <p>Shared learning starts with a connected account.</p>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>
                      {connected
                        ? "Your account is connected"
                        : "Continue across devices"}
                    </h3>
                    <p>
                      {connected
                        ? "Your account syncs private learning progress and lets you publish skills to the community."
                        : "Sign in to sync progress and discover community-created skills."}
                    </p>
                  </div>
                  {connected ? (
                    <form action="/auth/signout" method="post">
                      <Button type="submit" secondary>
                        <LogOut size={15} />
                        Sign out
                      </Button>
                    </form>
                  ) : (
                    <Link className="btn secondary" href="/auth">
                      Sign in <ArrowUpRight size={15} />
                    </Link>
                  )}
                </div>
                <div className="setting-row">
                  <div>
                    <h3>AI learning coach</h3>
                    <p>
                      {aiReady
                        ? "Your server is configured for AI requests. Preferences are shared only when personalization is enabled."
                        : "Your AI service is not connected yet. Your saved learning paths and planner remain available."}
                    </p>
                  </div>
                  <Badge tone={aiReady ? "mint" : "amber"}>
                    {aiReady ? "CONFIGURED" : "SETUP NEEDED"}
                  </Badge>
                </div>
              </section>
            </div>
          )}

          <footer className="workspace-footer">
            <span>
              <span className="footer-symbol">↔</span> Build skills at your own
              pace.
            </span>
            <span>
              Stay curious. Keep going.<span className="footer-star">✦</span>
            </span>
          </footer>
        </main>
      </div>
      {!tourHidden && p.tour.status === "active" && (
        <WelcomeTour
          data={data}
          save={mutate}
          pending={pending}
          error={error}
          dismiss={() => setTourHidden(true)}
          navigate={(target, focus) => {
            setModal(null);
            navigation.current?.hidePopover();
            setAccountOpen(false);
            if (view !== target) go(target);
            else window.scrollTo({ top: 0, behavior: "instant" });
            if (focus) setQuery(focus);
            else setQuery("");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {toast}
        </div>
      )}

      {modal === "skill" && (
        <Dialog
          title="Your knowledge is worth sharing."
          description="Add something you can teach — or something you’d love to learn."
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              const v = values(e);
              await mutate(
                {
                  type: "skill.add",
                  value: {
                    name: v.name,
                    kind: v.kind as "teach" | "learn",
                    level: v.level as Skill["level"],
                  },
                },
                "Skill added to your exchange profile",
                true,
              );
            }}
          >
            <label>
              Skill name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Python, guitar, public speaking…"
              />
            </label>
            <div className="form-grid">
              <label>
                I’d like to
                <select name="kind">
                  <option value="teach">Teach this skill</option>
                  <option value="learn">Learn this skill</option>
                </select>
              </label>
              <label>
                My current level
                <select name="level">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
            <p className="field-hint">
              Adding both teaching and learning skills helps us find reciprocal
              matches.
            </p>
            <ModalError error={error} />
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              Add skill
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "proof" && (
        <Dialog
          title="Share a learning milestone"
          description="Share an achievement, what you learned, and the work behind it."
          onClose={() => setModal(null)}
          wide
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              const v = values(e);
              await mutate(
                {
                  type: "proof.add",
                  value: {
                    title: v.title,
                    description: v.description,
                    category: v.category,
                    evidence_url: v.evidence_url,
                  },
                },
                "Milestone shared with Study Circle",
                true,
              );
            }}
          >
            <label>
              Project or achievement
              <input
                name="title"
                required
                minLength={3}
                maxLength={140}
                placeholder="I built my first accessible website"
              />
            </label>
            <label>
              Category
              <select name="category">
                {[
                  "Technology",
                  "Academic",
                  "Arts & Creativity",
                  "Music",
                  "Business & Entrepreneurship",
                  "Certifications",
                  "Career",
                  "Community",
                  "Personal Development",
                  "Sports",
                  "Other Achievement",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              What did you do? What did you learn?
              <textarea
                name="description"
                required
                minLength={3}
                maxLength={2500}
                placeholder="Tell the story behind your progress. Include what you contributed and what you would do differently."
                rows={4}
              />
            </label>
            <label>
              Evidence link <span className="optional">optional</span>
              <input
                name="evidence_url"
                type="url"
                maxLength={1500}
                placeholder="https://github.com/you/project"
              />
            </label>
            <p className="field-hint">
              <ShieldCheck size={14} />
              {connected
                ? "Published milestones are visible to signed-in learners."
                : "Local proofs stay on this device."}{" "}
              Links are self-submitted, not independently verified.
            </p>
            <ModalError error={error} />
            <Button type="submit" disabled={pending}>
              <FileCheck2 size={16} />
              Publish milestone
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "proof-detail" &&
        (() => {
          const proof = data.proofs.find((p) => p.id === selectedProof);
          return proof ? (
            <Dialog
              title={proof.title}
              description={`By ${person(proof.author_id)} · ${new Date(proof.created_at).toLocaleDateString()}`}
              onClose={() => setModal(null)}
            >
              <Badge>{proof.category}</Badge>
              <p className="proof-description">{proof.description}</p>
              {safeLink(proof.evidence_url) ? (
                <a
                  className="btn primary"
                  href={safeLink(proof.evidence_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore the work <ExternalLink size={15} />
                </a>
              ) : (
                <p className="field-hint">
                  Self-reported achievement · no evidence link supplied.
                </p>
              )}
            </Dialog>
          ) : null;
        })()}
      {modal === "room" && (
        <Dialog
          title="Make room for learning."
          description="Create a text classroom for a study group, workshop, or skill exchange."
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              const v = values(e);
              await mutate(
                {
                  type: "room.create",
                  value: {
                    name: v.name,
                    topic: v.topic,
                    description: v.description,
                    visibility: v.visibility as Room["visibility"],
                  },
                },
                "Classroom created. Share its code to invite people.",
                true,
              );
            }}
          >
            <label>
              Classroom name
              <input
                name="name"
                minLength={3}
                maxLength={120}
                required
                placeholder="A little Python, together"
              />
            </label>
            <label>
              Topic
              <input
                name="topic"
                minLength={2}
                maxLength={100}
                required
                placeholder="What are we learning?"
              />
            </label>
            <label>
              A short introduction
              <textarea
                name="description"
                maxLength={500}
                placeholder="Who is this for? What will you work on?"
              />
            </label>
            <label>
              Who can discover this space?
              <select name="visibility">
                <option value="public">
                  Public — signed-in learners can discover and join
                </option>
                <option value="private">
                  Private — an invitation code is required
                </option>
              </select>
            </label>
            <p className="field-hint">
              Invite-only rooms can be joined by anyone who has their code.
              Share it thoughtfully.
            </p>
            <ModalError error={error} />
            <Button type="submit" disabled={pending}>
              <Plus size={16} />
              Create classroom
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "personalize" && (
        <Dialog
          title="Your coach. Your way."
          description="Give your learning a direction. You can change any of this whenever you like."
          onClose={() => setModal(null)}
          wide
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              const v = values(e);
              await mutate(
                {
                  type: "preferences",
                  value: {
                    goal: v.goal,
                    interests: v.interests,
                    level: v.level as "beginner",
                    style: v.style as Personal["style"],
                    minutes: Number(v.minutes),
                    memory: v.memory,
                    shareContext: v.shareContext === "on",
                    weeklyGoal: Number(v.weeklyGoal),
                  },
                },
                "Your coach now has a clearer picture of you",
                true,
              );
            }}
          >
            <label>
              What would you love to learn or achieve?
              <input
                name="goal"
                defaultValue={p.goal}
                maxLength={400}
                placeholder="Build a web app, learn guitar, speak confidently…"
              />
            </label>
            <label>
              What are you interested in?
              <input
                name="interests"
                defaultValue={p.interests}
                maxLength={400}
                placeholder="Design, technology, music, entrepreneurship…"
              />
            </label>
            <div className="form-grid">
              <label>
                Current level
                <select name="level" defaultValue={p.level}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label>
                I learn best with
                <select name="style" defaultValue={p.style}>
                  {[
                    "Practical examples",
                    "Step by step",
                    "Socratic questions",
                    "Concise explanations",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Minutes I can give each day
                <input
                  name="minutes"
                  type="number"
                  min={5}
                  max={120}
                  defaultValue={p.minutes}
                  required
                />
              </label>
              <label>
                My weekly active-day goal
                <input
                  name="weeklyGoal"
                  type="number"
                  min={1}
                  max={7}
                  defaultValue={p.weeklyGoal}
                  required
                />
              </label>
            </div>
            <label>
              What should your coach remember?{" "}
              <span className="optional">optional</span>
              <textarea
                name="memory"
                defaultValue={p.memory}
                maxLength={1500}
                placeholder="For example: I know basic HTML. Use examples from music. Give me a hint before revealing an answer."
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="shareContext"
                defaultChecked={p.shareContext}
              />
              <span>
                Use these preferences, my listed skills, and study progress to
                personalize AI replies.
              </span>
            </label>
            <p className="field-hint">
              This memory is private to your workspace. When personalization is
              enabled, it is included with your AI requests. Avoid adding
              sensitive personal information.
            </p>
            <ModalError error={error} />
            <Button type="submit" disabled={pending}>
              <Sparkles size={16} />
              Save my learning preferences
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "plan" && (
        <Dialog
          title="A little structure. A lot of potential."
          description="Start with a goal and turn it into checkpoints you can actually finish."
          onClose={() => {
            setModal(null);
            setAiError("");
          }}
        >
          <form className="form-stack" onSubmit={createPlan}>
            <label>
              What are you working toward?
              <input
                name="goal"
                defaultValue={p.goal}
                required
                minLength={2}
                maxLength={160}
                placeholder="Build my first React app"
              />
            </label>
            <label>
              How should we build your path?
              <select name="source" defaultValue={aiReady ? "ai" : "template"}>
                <option value="template">
                  Offline study framework — ready now
                </option>
                <option value="ai" disabled={!aiReady}>
                  AI personalized plan
                  {!aiReady ? " — needs an AI connection" : ""}
                </option>
              </select>
            </label>
            <div className="plan-explainer">
              <Clock3 size={18} />
              <div>
                <b>Made for your {p.minutes}-minute study sessions.</b>
                <p>
                  The offline framework gives you a practical study structure.
                  AI plans adapt the actual content to your goal and learning
                  preferences.
                </p>
              </div>
            </div>
            <ModalError error={error || aiError} />
            <Button type="submit" disabled={pending || aiBusy}>
              {aiBusy ? (
                <>
                  <LoaderCircle size={16} className="spin" />
                  Building your path…
                </>
              ) : (
                <>
                  <Waypoints size={16} />
                  Build my learning path
                </>
              )}
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "path-preview" &&
        selectedSkill &&
        (() => {
          const path = learningPaths.find(
            (p) => p.skill === selectedSkill.name,
          )!;
          return (
            <Dialog
              title={path.title}
              description={path.description}
              onClose={() => setModal(null)}
            >
              <Mark type={path.icon} className="preview-art" />
              <div className="preview-topics">
                {path.topics.map((t, i) => (
                  <div key={t}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {t}
                  </div>
                ))}
              </div>
              <p className="field-hint">
                A self-guided study framework — no enrollment or paid course
                required.
              </p>
              <Button
                className="full"
                disabled={pending}
                onClick={async () => {
                  if (
                    await mutate(
                      {
                        type: "plan.add",
                        value: templatePlan(path.title, p.minutes, path.topics),
                      },
                      "Your study path is ready",
                      true,
                    )
                  )
                    go("plans");
                }}
              >
                Make this my next chapter <ArrowRight size={16} />
              </Button>
            </Dialog>
          );
        })()}
      {modal === "exchange" && selectedSkill && (
        <Dialog
          title={`A little ${selectedSkill.name}, together.`}
          description={`Invite ${person(selectedSkill.student_id)} to a two-way skill exchange.`}
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              const v = values(e);
              await mutate(
                {
                  type: "exchange.request",
                  value: {
                    receiver_id: selectedSkill.student_id,
                    skill_name: selectedSkill.name,
                    offering: v.offering,
                    message: `We?ll make: ${v.outcome.trim()}\n\n${v.message.trim()}`,
                  },
                },
                "Exchange request sent",
                true,
              );
            }}
          >
            <label>
              What can you teach in return?
              <select name="offering" required defaultValue="">
                <option value="" disabled>
                  Choose one of your teaching skills
                </option>
                {ownSkills
                  .filter((s) => s.kind === "teach")
                  .map((s) => (
                    <option key={s.id}>{s.name}</option>
                  ))}
              </select>
            </label>
            {!ownSkills.some((s) => s.kind === "teach") && (
              <p className="field-hint">
                Add a skill you can teach before suggesting a swap.
              </p>
            )}
            <label>
              What will you make together?
              <input
                name="outcome"
                minLength={5}
                maxLength={180}
                required
                placeholder="e.g. A chart and a short explanation of what it shows"
              />
            </label>
            <label>
              Session plan
              <textarea
                name="message"
                required
                minLength={3}
                maxLength={780}
                placeholder="Agree on a short session. What will each person explain or review?"
              />
            </label>
            <ModalError error={error} />
            <Button
              type="submit"
              disabled={pending || !ownSkills.some((s) => s.kind === "teach")}
            >
              <Send size={15} />
              Send exchange request
            </Button>
          </form>
        </Dialog>
      )}
      {modal === "delete" && deleteOp && (
        <Dialog
          title={
            deleteOp.type === "chat.save"
              ? "A fresh conversation?"
              : "Remove this from your workspace?"
          }
          description={
            deleteOp.type === "chat.save"
              ? "This clears the conversation saved in SkillSwap. Your learning preferences stay in place."
              : "This action removes the selected item. You can export a copy of your workspace first."
          }
          onClose={() => {
            setModal(null);
            setDeleteOp(null);
          }}
        >
          <div className="button-row">
            <Button secondary onClick={() => setModal(null)}>
              Keep it
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                mutate(deleteOp, "Removed from your workspace", true)
              }
            >
              <Trash2 size={15} />
              {deleteOp.type === "chat.save"
                ? "Clear conversation"
                : "Remove item"}
            </Button>
          </div>
          <ModalError error={error} />
        </Dialog>
      )}
      {modal === "streak" && (
        <Dialog
          title="Learning activity"
          description="Your learning activity over the last 91 days. Each square is one day."
          onClose={() => setModal(null)}
        >
          <div className="streak-big">
            <Flame size={38} />
            <strong>{learningStreak}</strong>
            <span>day learning streak</span>
          </div>
          <Heatmap activity={p.activity} clientReady={clientReady} />
          <button
            className="btn secondary reward-entry"
            onClick={() => setModal("rewards")}
          >
            <Sparkles size={16} /> {momentum.balance} Sparks · Rewards & streak
            saves
          </button>
          <p className="field-hint">
            Complete a task, module, checkpoint, or at least five minutes of
            focus to count a learning day. Your reward calendar follows{" "}
            {momentum.zone}. Protected days preserve your streak without earning
            Sparks.
          </p>
          <div className="streak-stats">
            <span>
              <b>
                {weeklyDays}/{p.weeklyGoal}
              </b>{" "}
              active days this week
            </span>
            <span>
              <b>{p.activity.length}</b> learning activities recorded
            </span>
          </div>
        </Dialog>
      )}
      {modal === "rewards" && (
        <Dialog
          title="Your momentum"
          wide
          description="Small steps. Lasting progress. A space that grows with you."
          onClose={() => setModal(null)}
        >
          <RewardsPanel personal={p} busy={pending} save={mutate} />
          <ModalError error={error} />
        </Dialog>
      )}
      {modal === "notifications" && (
        <Dialog
          title="The little things adding up."
          description="Recent learning activity and incoming exchange requests."
          onClose={() => setModal(null)}
        >
          {incoming.length > 0 && (
            <button
              className="activity-request"
              onClick={() => {
                setModal(null);
                go("exchange");
              }}
            >
              <Waypoints size={19} />
              <span>
                {incoming.length} exchange{" "}
                {incoming.length === 1 ? "request is" : "requests are"} waiting
                for you.
              </span>
              <ArrowRight size={15} />
            </button>
          )}
          <div className="activity-list">
            {p.activity.length ? (
              p.activity.slice(0, 15).map((a) => (
                <div key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <b>{a.label}</b>
                    <small>
                      {new Date(a.date).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <Check size={14} />
                </div>
              ))
            ) : (
              <Empty icon={Bell} title="Your story is just getting started.">
                Finish a small task, checkpoint, or focus session. Your progress
                will appear here.
              </Empty>
            )}
          </div>
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog
          title="A little help finding your way."
          description="Guided skills, practical learning, and support when you need it."
          onClose={() => setModal(null)}
        >
          <div className="help-list">
            {[
              [
                "01",
                "Make it yours",
                "Complete your profile and set your goals in learning preferences.",
              ],
              [
                "02",
                "Choose your next skill",
                "Preview sections and modules in Skill studio, then enroll at your own pace.",
              ],
              [
                "03",
                "Learn with a little structure",
                "Work through explanations, practice tasks, and completion checks. Reforge your curriculum when your needs change.",
              ],
              [
                "04",
                "Build a steady routine",
                "Use Planner for tasks, habits, mood, and private journaling. Your profile collects learning milestones.",
              ],
            ].map(([n, t, b]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{b}</p>
                </div>
              </div>
            ))}
          </div>
          <HelpContact
            tour={async () => {
              setModal(null);
              setTourHidden(false);
              await mutate({
                type: "tour.progress",
                status: "active",
                step: 0,
              });
            }}
            personalize={() => {
              setModal(null);
              setError("");
              setWelcomeOpen(true);
              setWelcomeDismissed(false);
            }}
          />
        </Dialog>
      )}
      {!connected && (modal === "local-reset" || modal === "local-restore") && (
        <Dialog
          title={
            modal === "local-reset"
              ? "Room for a fresh start."
              : "Return to your previous workspace?"
          }
          description={
            modal === "local-reset"
              ? "This resets your local learning workspace and timer. A recovery snapshot stays in this browser. Connected accounts are unaffected."
              : "This swaps your current local workspace with the recovery snapshot. Your current progress becomes the new snapshot, so you can switch back."
          }
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              const v = values(e);
              if (v.confirmation !== "RESET") return;
              try {
                const previous =
                  localStorage.getItem(STORAGE) ||
                  JSON.stringify({ version: 2, data });
                const next =
                  modal === "local-reset"
                    ? JSON.stringify({ version: 2, data: emptyWorkspace() })
                    : localStorage.getItem(STORAGE + ".backup");
                if (!next)
                  throw new Error("No recovery snapshot is available.");
                const parsed = JSON.parse(next);
                if (
                  parsed.version !== 2 ||
                  parsed.data?.userId !== "local-learner"
                )
                  throw new Error("This snapshot cannot be restored.");
                localStorage.setItem(STORAGE + ".backup", previous);
                localStorage.setItem(STORAGE, next);
                localStorage.removeItem("skillswap.focus.timer");
                current.current = parsed.data;
                setData({
                  ...parsed.data,
                  personal: normalizePersonal(parsed.data.personal),
                });
                setHasLocalBackup(true);
                setModal(null);
                go("overview");
                setToast(
                  modal === "local-reset"
                    ? "A fresh start. Your previous workspace is recoverable in Settings."
                    : "Workspace restored. You can switch back in Settings.",
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not update the local workspace.",
                );
              }
            }}
          >
            <label>
              Type RESET to confirm
              <input
                name="confirmation"
                pattern="RESET"
                required
                autoComplete="off"
                placeholder="RESET"
              />
            </label>
            <ModalError error={error} />
            <Button type="submit">
              {modal === "local-reset"
                ? "Start a fresh workspace"
                : "Restore snapshot"}
              <ArrowRight size={15} />
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function ModalError({ error }: { error: string }) {
  return error ? (
    <div className="form-error" role="alert">
      {error}
    </div>
  ) : null;
}
