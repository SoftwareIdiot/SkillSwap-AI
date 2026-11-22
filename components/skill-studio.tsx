"use client";

import SkillMap from "./skill-map";
import CheckpointReview from "./checkpoint-review";
import LearningMemory from "./learning-memory";
import { findCheckpoint, type CheckpointAttempt, type CheckpointRef } from "@/lib/checkpoints";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Edit3,
  Flag,
  Globe,
  Layers3,
  LockKeyhole,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import type { Operation, WorkspaceData } from "@/lib/workspace";
import { safeLink, streak, uid } from "@/lib/workspace";
import { starterDivisions } from "@/lib/skill-catalog";
import {
  ProfilePictureControls,
  type useProfilePicture,
} from "./profile-picture";
import {
  curriculumSchema,
  fromAiCurriculum,
  modulesOf,
  type Curriculum,
  type Division,
  type Enrollment,
} from "@/lib/skill-paths";
import "./skill-studio.css";
import { recommend } from "@/lib/recommendations";
type Mutate = (op: Operation, message?: string) => Promise<boolean>;
type Props = {
  searchTerm?: string;
  openCheckpoint?: CheckpointRef;
  data: WorkspaceData;
  mutate: Mutate;
  pending: boolean;
  connected: boolean;
  aiReady: boolean;
  aiBusy: boolean;
  aiError: string;
  ask: (
    mode: "division",
    prompt: string,
    curriculum?: Curriculum,
  ) => Promise<string | null>;
  go: (
    view:
      "overview" | "plans" | "coach" | "productivity" | "settings" | "profile" | "feed",
    planner?: string,
  ) => void;
};
function Action({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${secondary ? "secondary" : "primary"}`}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="studio-dialog-head">
        <div>
          <span className="eyebrow">SKILLSWAP · SKILL STUDIO</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <div className="studio-dialog-body">{children}</div>
    </dialog>
  );
}
function PathMark({ category }: { category: string }) {
  return (
    <span
      className={`path-mark category-${category.startsWith("D") ? "violet" : category.startsWith("C") ? "peach" : "mint"}`}
    >
      <Layers3 size={25} />
    </span>
  );
}
function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="journey-progress">
      <div>
        <span>
          {done} / {total} modules
        </span>
        <b>{total ? Math.round((done / total) * 100) : 0}%</b>
      </div>
      <progress
        value={done}
        max={Math.max(1, total)}
        aria-label="Module completion"
      />
    </div>
  );
}
export default function SkillStudio({
  view,
  ...props
}: Props & { view: "overview" | "plans" }) {
  const {
    data,
    mutate,
    pending,
    connected,
    aiReady,
    aiBusy,
    aiError,
    searchTerm,
    openCheckpoint,
    ask,
    go,
  } = props;
  const p = data.personal;
  const openingJourney = openCheckpoint && p.journeys.find((journey) => journey.id === openCheckpoint.journeyId && modulesOf(journey).some((module) => module.id === openCheckpoint.moduleId));
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All skills"),
    [tab, setTab] = useState("all"),
    [activeId, setActiveId] = useState<string | null>(openingJourney?.divisionId ?? null);
  const [preview, setPreview] = useState<Division | null>(null),
    [wizard, setWizard] = useState(0),
    [goal, setGoal] = useState(""),
    [minutes, setMinutes] = useState(p.minutes),
    [days, setDays] = useState(p.weeklyGoal);
  const [editor, setEditor] = useState<{
      curriculum: Curriculum;
      id: string;
      source: "user" | "ai";
      visibility: "private" | "public";
      journeyId?: string;
      draft?: boolean;
    } | null>(null),
    [editorError, setEditorError] = useState(""),
    [aiPrompt, setAiPrompt] = useState("");
  const [reviewModule, setReviewModule] = useState(openingJourney ? openCheckpoint?.moduleId : undefined);
  const [publishing, setPublishing] = useState<Division | null>(null);
  const draftRequest = useRef(0);
  const [creation, setCreation] = useState<"choose" | "ai" | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState<Division | null>(null);
  useEffect(() => {
    if (view === "plans") setActiveId(null);
  }, [view]);
  useEffect(() => {
    if (!searchTerm) return;
    if (view === "overview") {
      const enrollment = p.journeys.find((j) => j.title === searchTerm);
      if (enrollment) setActiveId(enrollment.divisionId);
    } else {
      setQuery(searchTerm);
      setCategory("All skills");
      setTab("all");
    }
  }, [searchTerm, view]);
  const active = p.journeys.find((j) => j.divisionId === activeId);
  const communityDivisions = data.communityDivisions || [];
  const ownedIds = new Set(p.divisions.map((division) => division.id));
  const base =
    tab === "mine"
      ? p.divisions
      : tab === "community"
        ? communityDivisions
        : tab === "starter"
          ? starterDivisions
          : [...starterDivisions, ...communityDivisions, ...p.divisions];
  const keyword = query.trim().toLowerCase();
  const results = recommend(
    base.filter(
      (d) =>
        (category === "All skills" || d.category === category) &&
        `${d.title} ${d.category} ${d.summary}`.toLowerCase().includes(keyword),
    ),
    (d) => `${d.title} ${d.summary} ${d.category}`,
    data,
  );
  const next = p.journeys.find((j) => j.completed.length < modulesOf(j).length);
  const nextModule =
    next &&
    modulesOf(next).find((module) => !next.completed.includes(module.id));
  const needsReview = [...p.checkpointAttempts].reverse().find((attempt) => {
    if (attempt.correct || p.checkpointAttempts.some((other) =>
      other.correct && other.journeyId === attempt.journeyId && other.moduleId === attempt.moduleId,
    )) return false;
    const journey = p.journeys.find((item) => item.id === attempt.journeyId);
    return journey && modulesOf(journey).some((module) => module.id === attempt.moduleId);
  });
  const reviewJourney = p.journeys.find((journey) => journey.id === needsReview?.journeyId);
  const reviewCheck = reviewJourney && needsReview && findCheckpoint(reviewJourney.divisionId, needsReview.moduleId);
  const planPractice = (concept: string, checkpoint: CheckpointRef) => {
    sessionStorage.setItem("skillswap.task-draft", JSON.stringify({ title: `Practice ${concept.toLowerCase()}`, topic: concept, minutes: 5, checkpoint }));
    go("productivity", "tasks");
  };
  const completedModules = p.journeys.reduce(
    (sum, j) => sum + j.completed.length,
    0,
  );
  const open = (d: Division) => {
    setPreview(d);
    setGoal(p.goal || `Learn ${d.title.toLowerCase()} through practical work.`);
    setWizard(0);
  };
  const edit = (
    curriculum: Curriculum,
    id = uid(),
    source: "user" | "ai" = "user",
    visibility: "private" | "public" = "private",
    journeyId?: string,
    draft = false,
  ) => {
    draftRequest.current++;
    setEditor({
      curriculum: structuredClone(curriculum),
      id,
      source,
      visibility,
      journeyId,
      draft,
    });
    setEditorError("");
    setAiPrompt("");
  };
  const startCreation = () => {
    setAiPrompt("");
    setEditorError("");
    setCreation("choose");
  };
  const saveDraft = (id: string, curriculum: Curriculum) =>
    mutate(
      {
        type: "division.save",
        value: {
          id,
          curriculum,
          visibility: "private",
          source: "ai",
          draft: true,
        },
      },
      "Draft saved to My creations",
    );
  const pathCard = (d: Division) => {
    const enrolled = p.journeys.some((j) => j.divisionId === d.id);
    return (
      <article className="studio-card" key={d.id}>
        <div className="studio-card-top">
          <PathMark category={d.category} />
          <span className="studio-tag">
            {d.source === "starter"
              ? "STARTER SKILL"
              : d.draft
                ? "SAVED DRAFT"
                : d.visibility.toUpperCase()}
          </span>
        </div>
        <span className="studio-category">{d.category}</span>
        <h3>{d.title}</h3>
        <p>{d.summary}</p>
        <div className="studio-card-meta">
          <span>
            <Layers3 size={13} />
            {d.sections.length} sections
          </span>
          <span>
            <BookOpen size={13} />
            {modulesOf(d).length} modules
          </span>
        </div>
        <div className="studio-card-footer">
          <span>
            {d.author || "Created by you"} · {d.level}
          </span>
          <button
            onClick={() =>
              d.draft
                ? edit(d, d.id, "ai", "private", undefined, true)
                : enrolled
                  ? (setActiveId(d.id), go("overview"))
                  : open(d)
            }
            aria-label={`${d.draft ? "Open draft" : enrolled ? "Continue" : "Explore"} ${d.title}`}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        {view === "plans" && ownedIds.has(d.id) && (
          <div className="studio-manage">
            <button
              onClick={() =>
                edit(
                  d,
                  d.id,
                  d.source === "ai" ? "ai" : "user",
                  d.visibility,
                  undefined,
                  d.draft,
                )
              }
            >
              <Edit3 size={13} />
              {d.draft ? "Edit draft" : "Edit skill"}
            </button>
            {d.draft && (
              <button onClick={() => setDeleteDraft(d)} disabled={pending}>
                <Trash2 size={13} /> Delete draft
              </button>
            )}
            <button
              disabled={pending || !connected}
              title={!connected ? "Connect an account to publish" : undefined}
              onClick={() =>
                d.visibility === "public"
                  ? mutate(
                      {
                        type: "division.visibility",
                        id: d.id,
                        visibility: "private",
                      },
                      "Skill is now private. Existing enrollments keep their own copy.",
                    )
                  : setPublishing(d)
              }
            >
              {d.visibility === "public" ? (
                <LockKeyhole size={13} />
              ) : (
                <Globe size={13} />
              )}
              {d.visibility === "public" ? "Make private" : "Publish"}
            </button>
          </div>
        )}
      </article>
    );
  };
  const player =
    active && view === "overview" ? (
      <ModulePlayer
        key={active.id}
        journey={active}
        attempts={p.checkpointAttempts.filter((attempt) => attempt.journeyId === active.id)}
        initialCheck={reviewModule}
        pending={pending}
        mutate={mutate}
        back={() => { setActiveId(null); setReviewModule(undefined); }}
        planPractice={planPractice}
        askCheckpointCoach={(question) => {
          sessionStorage.setItem("skillswap.coach-question", question);
          go("coach");
        }}
        askPeers={connected ? (concept) => {
          sessionStorage.setItem("skillswap.study-question", JSON.stringify({
            title: `Can someone explain ${concept.toLowerCase()}?`,
            body: `I'm practicing ${concept.toLowerCase()}. Could someone walk me through a small example and give me a different one to try?`,
          }));
          go("feed");
        } : undefined}
        edit={() => edit(active, uid(), "user", "private", active.id)}
        addPrerequisite={(module, topic) =>
          mutate(
            {
              type: "journey.prerequisite",
              id: active.id,
              moduleId: module.id,
              topic,
            },
            "Practice checkpoint added",
          )
        }
        coach={(module) => {
          go("coach");
          sessionStorage.setItem(
            "skillswap.coach-question",
            `Help me get unstuck on ${module.title}. Ask one diagnostic question, then suggest a small prerequisite exercise based on my answer. My goal: ${active.goal}. Explain using ${p.style.toLowerCase()}. Current module: ${module.lesson}`,
          );
        }}
      />
    ) : null;
  return (
    <div className="skill-studio">
      {player ? (
        player
      ) : view === "overview" ? (
        <>
          {reviewJourney && reviewCheck && needsReview && (
            <section className="checkpoint-next" aria-label="Recommended practice">
              <div>
                <span className="eyebrow">RECOMMENDED PRACTICE · 5 MIN</span>
                <h2>{reviewCheck.concept}</h2>
                <p>Based on your last answer in {reviewJourney.title}.</p>
              </div>
              <Action onClick={() => {
                setReviewModule(needsReview.moduleId);
                setActiveId(reviewJourney.divisionId);
              }}>
                Review and try again <ArrowRight size={15} />
              </Action>
            </section>
          )}
          <div className="learning-dashboard-hero" data-tour="dashboard">
            <div>
              <span className="eyebrow">
                <span className="live-dot" />
                {next ? "NEXT UP" : "GET STARTED"}
              </span>
              <h2>
                {next?.title ||
                  (p.journeys.length
                    ? "Choose your next skill"
                    : "Choose your first skill")}
              </h2>
              <p>
                {nextModule ? (
                  <>
                    Next module <strong>{nextModule.title}</strong>
                  </>
                ) : (
                  "Pick a guided curriculum and work through short lessons, exercises, and checkpoints."
                )}
              </p>
              <div className="button-row">
                <Action
                  onClick={() =>
                    next ? setActiveId(next.divisionId) : go("plans")
                  }
                >
                  {next ? "Continue learning" : "Explore skills"}
                  <ArrowRight size={16} />
                </Action>
                <Action secondary onClick={() => go("productivity")}>
                  Open planner
                </Action>
              </div>
            </div>
            <div className="learning-orbit" aria-hidden="true">
              <span className="orbit-one" />
              <span className="orbit-two" />
              <div>
                <Layers3 size={38} />
              </div>
              <i className="orbit-node node-one">
                <BookOpen size={18} />
              </i>
              <i className="orbit-node node-two">
                <Check size={18} />
              </i>
              <i className="orbit-node node-three">
                <Target size={18} />
              </i>
            </div>
          </div>
          <div className="learning-stat-grid">
            <div>
              <BookOpen size={18} />
              <b>{p.journeys.length}</b>
              <span>enrolled skills</span>
            </div>
            <div>
              <Check size={18} />
              <b>{completedModules}</b>
              <span>modules completed</span>
            </div>
            <div>
              <Trophy size={18} />
              <b>
                {
                  p.journeys.filter(
                    (j) => j.completed.length === modulesOf(j).length,
                  ).length
                }
              </b>
              <span>skills completed</span>
            </div>
            <div>
              <Clock3 size={18} />
              <b>{p.minutes} min</b>
              <span>daily study preference</span>
            </div>
          </div>
          <div className="studio-section-title">
            <div>
              <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
              <h2>
                My enrolled skills <span>{p.journeys.length}</span>
              </h2>
            </div>
            <button className="text-link" onClick={() => go("plans")}>
              Explore skills <ArrowRight size={15} />
            </button>
          </div>
          {p.journeys.length ? (
            <div className="enrolled-grid">
              {p.journeys.map((j) => (
                <article className="enrolled-card" key={j.id}>
                  <div className="studio-card-top">
                    <PathMark category={j.category} />
                    <span className="studio-tag">
                      {j.completed.length === modulesOf(j).length
                        ? "COMPLETED"
                        : "IN PROGRESS"}
                    </span>
                  </div>
                  <h3>{j.title}</h3>
                  <p>{j.goal}</p>
                  <Progress
                    done={j.completed.length}
                    total={modulesOf(j).length}
                  />
                  <div className="enrolled-bottom">
                    <span>
                      {j.minutes} min · {j.days} days/week
                    </span>
                    <Action secondary onClick={() => setActiveId(j.divisionId)}>
                      {j.completed.length === modulesOf(j).length
                        ? "Review skill"
                        : "Continue"}
                      <ArrowRight size={14} />
                    </Action>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="studio-empty">
              <Compass size={30} />
              <h3>Your learning starts with a choice.</h3>
              <p>
                Preview a starter skill below, or visit Skill studio to make
                your own.
              </p>
            </div>
          )}
          <div className="studio-section-title">
            <div>
              <span className="eyebrow">A CLEAR PLACE TO START</span>
              <h2>Starter skills</h2>
            </div>
            <span className="muted">Guided practice · no enrollment fee</span>
          </div>
          <div className="studio-grid">
            {starterDivisions.slice(0, 3).map(pathCard)}
          </div>
        </>
      ) : (
        <>
          <section className="studio-explore-hero" data-tour="studio">
            <div>
              <h2>Build your own curriculum</h2>
              <p>
                Write it from scratch or start with an AI draft you can edit.
              </p>
            </div>
            <div className="button-row">
              <Action onClick={startCreation}>
                <Plus size={16} />
                Create a skill
              </Action>
            </div>
          </section>
          <div className="studio-filterbar">
            <div className="tabs" role="group" aria-label="Skill sources">
              {[
                ["all", "All sources"],
                ["starter", "Starter skills"],
                ["community", "Community"],
                ["mine", "My creations"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={tab === id}
                  className={tab === id ? "active" : ""}
                  onClick={() => {
                    setTab(id);
                    setCategory("All skills");
                  }}
                >
                  {label}
                  {id === "mine" ? ` (${p.divisions.length})` : ""}
                </button>
              ))}
            </div>
            <div className="studio-search">
              <Search size={16} />
              <input
                type="search"
                aria-label="Search skill divisions"
                placeholder="Search skill divisions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Skill category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["All skills", ...new Set(base.map((d) => d.category))].map(
                (c) => (
                  <option key={c} value={c}>
                    {c === "All skills" ? "All categories" : c}
                  </option>
                ),
              )}
            </select>
          </div>
          {tab === "community" && (!connected || data.communityNotice) && (
            <div className="studio-notice">
              <Globe size={18} />
              <p>
                {!connected
                  ? "Sign in with a connected account to explore skills published by other learners. Starter skills and private creation work on this device."
                  : data.communityNotice}
              </p>
              <button onClick={() => go("settings")}>
                Connection settings <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="studio-results-heading">
            <b>
              {results.length}{" "}
              {tab === "mine" ? "created skills" : "skills to explore"}
            </b>
            <span>Preview the sections before you enroll</span>
          </div>
          {results.length ? (
            <div className="studio-grid">{results.map(pathCard)}</div>
          ) : (
            <div className="studio-empty">
              <Layers3 size={30} />
              <h3>
                {keyword
                  ? "No matching skill divisions."
                  : tab === "mine"
                    ? "Your own curriculum, your own pace."
                    : "No skills found here yet."}
              </h3>
              <p>
                {keyword
                  ? "Try a different keyword, source, or category."
                  : tab === "mine"
                    ? "Create a private skill from scratch or ask AI to draft its sections and modules."
                    : "Try another search or start with a ready-made skill."}
              </p>
              <Action onClick={startCreation}>
                Create a skill <Plus size={15} />
              </Action>
            </div>
          )}
        </>
      )}
      {preview && (
        <Modal
          title={wizard ? "Make this skill yours" : preview.title}
          close={() => setPreview(null)}
          wide
        >
          <div className="enrollment-steps">
            <span className="active">01 Preview</span>
            <span className={wizard >= 1 ? "active" : ""}>02 Your pace</span>
            <span className={wizard >= 2 ? "active" : ""}>
              03 Start learning
            </span>
          </div>
          {wizard === 0 ? (
            <>
              <div className="curriculum-preview-intro">
                <PathMark category={preview.category} />
                <div>
                  <h3>{preview.title}</h3>
                  <p>{preview.summary}</p>
                  <span>
                    {preview.level} · {preview.sections.length} sections ·{" "}
                    {modulesOf(preview).length} modules · self-guided practice
                  </span>
                </div>
              </div>
              <CurriculumOutline curriculum={preview} />
              <div className="studio-modal-footer">
                <span>Learn → practice → explain what you learned.</span>
                <Action onClick={() => setWizard(1)}>
                  Set my study pace <ArrowRight size={15} />
                </Action>
              </div>
            </>
          ) : wizard === 1 ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                setWizard(2);
              }}
            >
              <label>
                What do you want to be able to do?
                <textarea
                  required
                  minLength={3}
                  maxLength={400}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </label>
              <div className="studio-form-two">
                <label>
                  Minutes per study day
                  <select
                    value={minutes}
                    onChange={(e) => setMinutes(+e.target.value)}
                  >
                    {[10, 15, 25, 45, 60, 90, 120].map((n) => (
                      <option value={n} key={n}>
                        {n} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Study days per week
                  <select
                    value={days}
                    onChange={(e) => setDays(+e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option value={n} key={n}>
                        {n} days
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="studio-notice">
                <Target size={18} />
                <p>
                  This sets your schedule, not a deadline. Modules can take
                  several sessions; completion is based on practice, not time
                  spent.
                </p>
              </div>
              <div className="studio-modal-footer">
                <Action secondary onClick={() => setWizard(0)}>
                  Back to preview
                </Action>
                <Action type="submit">
                  Review enrollment <ArrowRight size={15} />
                </Action>
              </div>
            </form>
          ) : (
            <>
              <div className="enrollment-summary">
                <span className="spark-icon">
                  <Flag size={25} />
                </span>
                <h3>You're ready to begin.</h3>
                <p>{goal}</p>
                <div>
                  <span>{preview.sections.length} sections</span>
                  <span>{modulesOf(preview).length} modules</span>
                  <span>
                    {minutes} min × {days} days/week
                  </span>
                </div>
              </div>
              <div className="studio-notice">
                <LockKeyhole size={18} />
                <p>
                  Your progress and reflections stay private. You'll start with{" "}
                  <b>{modulesOf(preview)[0].title}</b>. You can reforge your own
                  copy at any time.
                </p>
              </div>
              <div className="studio-modal-footer">
                <Action secondary onClick={() => setWizard(1)}>
                  Adjust my pace
                </Action>
                <Action
                  disabled={pending}
                  onClick={async () => {
                    const d = preview;
                    if (
                      await mutate(
                        {
                          type: "journey.enroll",
                          divisionId: d.id,
                          curriculum: d,
                          goal,
                          minutes,
                          days,
                        },
                        "Skill enrolled. Your first module is ready.",
                      )
                    ) {
                      setPreview(null);
                      setActiveId(d.id);
                      go("overview");
                    }
                  }}
                >
                  Enroll and start <ArrowRight size={15} />
                </Action>
              </div>
            </>
          )}
        </Modal>
      )}
      {creation && (
        <Modal
          title="Create a skill"
          close={() => {
            if (!creating) setCreation(null);
          }}
        >
          {creation === "choose" ? (
            <div className="studio-create-choices">
              <button
                onClick={() => {
                  setCreation(null);
                  edit({
                    title: "",
                    category: "",
                    summary: "",
                    level: "beginner",
                    sections: [
                      { id: uid(), title: "", modules: [emptyModule()] },
                    ],
                  });
                }}
              >
                <Edit3 size={20} />
                <strong>Create manually</strong>
                <span>
                  Write each lesson, exercise, and completion check yourself.
                </span>
              </button>
              <button disabled={!aiReady} onClick={() => setCreation("ai")}>
                <Sparkles size={20} />
                <strong>Create with AI</strong>
                <span>
                  {aiReady
                    ? "Describe the skill and get a complete draft to edit."
                    : "Connect your AI service to generate drafts."}
                </span>
              </button>
            </div>
          ) : (
            <form
              className="studio-create-prompt"
              onSubmit={async (event) => {
                event.preventDefault();
                if (creating || aiBusy || aiPrompt.trim().length < 3) return;
                setCreating(true);
                setEditorError("");
                try {
                  const answer = await ask("division", aiPrompt.trim());
                  if (!answer) return;
                  const curriculum = fromAiCurriculum(JSON.parse(answer));
                  const id = uid();
                  const saved = await saveDraft(id, curriculum);
                  setTab("mine");
                  setQuery("");
                  setCategory("All skills");
                  setCreation(null);
                  edit(curriculum, id, "ai", "private", undefined, true);
                  if (!saved)
                    setEditorError(
                      "The draft is open for review. Use Save draft to retry saving it.",
                    );
                } catch {
                  setEditorError(
                    "The AI did not return a complete curriculum. Try a more specific prompt.",
                  );
                } finally {
                  setCreating(false);
                }
              }}
            >
              <label>
                What should this skill teach?
                <textarea
                  autoFocus
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={5}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="For example, teach Python through three small projects for a beginner."
                />
              </label>
              <p>
                Your generated curriculum is saved under My creations for
                review.
              </p>
              {(editorError || aiError) && (
                <p role="alert" className="form-error">
                  {editorError || aiError}
                </p>
              )}
              <div className="button-row">
                <Action
                  secondary
                  disabled={creating}
                  onClick={() => setCreation("choose")}
                >
                  Back
                </Action>
                <Action
                  type="submit"
                  disabled={creating || aiBusy || aiPrompt.trim().length < 3}
                >
                  <Sparkles size={15} />
                  {creating ? "Preparing draft…" : "Generate draft"}
                </Action>
              </div>
            </form>
          )}
        </Modal>
      )}
      {deleteDraft && (
        <Modal title="Delete this draft?" close={() => setDeleteDraft(null)}>
          <p>
            Delete the saved draft for <b>{deleteDraft.title}</b>?
          </p>
          <div className="button-row">
            <Action secondary onClick={() => setDeleteDraft(null)}>
              Cancel
            </Action>
            <Action
              disabled={pending}
              onClick={async () => {
                if (
                  await mutate(
                    { type: "division.delete", id: deleteDraft.id },
                    "Draft deleted",
                  )
                )
                  setDeleteDraft(null);
              }}
            >
              Delete draft
            </Action>
          </div>
        </Modal>
      )}
      {editor && (
        <Modal
          title={
            editor.journeyId
              ? "Reforge my learning path"
              : editor.draft
                ? "Review skill draft"
                : "Edit curriculum"
          }
          close={() => {
            draftRequest.current++;
            setEditor(null);
          }}
          wide
        >
          <div className="editor-intro">
            <p>
              {editor.journeyId
                ? "Edit your enrolled copy. Progress is kept for the unchanged completed prefix; changed or reordered modules need a fresh check-in. The original shared skill is unaffected."
                : "Build a curriculum with sections and practical modules. It stays private until you choose to publish it."}
            </p>
            <span className="studio-tag">
              <LockKeyhole size={12} />
              {editor.visibility === "public"
                ? "PUBLISHED CURRICULUM"
                : "PRIVATE WORKSPACE"}
            </span>
          </div>
          {(editor.source === "ai" || editor.journeyId) && (
            <div className="ai-reforge">
              <label>
                Describe what AI should change
                <textarea
                  maxLength={2000}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Make this project-based for a beginner, with 15-minute exercises…"
                />
              </label>
              <div>
                <small>
                  {aiReady
                    ? "Uses your model selection and allowed learning preferences. Review before saving."
                    : "AI needs a connected service. You can build and edit every module manually."}
                </small>
                <Action
                  disabled={
                    !aiReady || aiBusy || pending || aiPrompt.trim().length < 3
                  }
                  onClick={async () => {
                    const request = ++draftRequest.current;
                    const result = await ask(
                      "division",
                      aiPrompt,
                      editor.curriculum,
                    );
                    if (request !== draftRequest.current) return;
                    if (result)
                      try {
                        const curriculum = fromAiCurriculum(JSON.parse(result));
                        setEditor({ ...editor, curriculum, source: "ai" });
                        setEditorError("");
                        setAiPrompt("");
                        if (
                          editor.draft &&
                          !(await saveDraft(editor.id, curriculum))
                        )
                          setEditorError(
                            "Use Save draft to retry saving this revision.",
                          );
                      } catch {
                        setEditorError(
                          "The AI curriculum was incomplete. Your previous draft is unchanged. Try a smaller request.",
                        );
                      }
                  }}
                >
                  <Sparkles size={15} />
                  {aiBusy ? "Revising curriculum…" : "Revise with AI"}
                </Action>
              </div>
              {!aiReady && (
                <button
                  className="text-link"
                  onClick={() => {
                    setEditor(null);
                    go("settings");
                  }}
                >
                  AI connection settings <ArrowRight size={13} />
                </button>
              )}
              {aiError && (
                <p role="alert" className="form-error">
                  {aiError}
                </p>
              )}
            </div>
          )}
          <CurriculumEditor
            value={editor.curriculum}
            change={(curriculum) => setEditor({ ...editor, curriculum })}
            disabled={aiBusy}
          />
          {editorError && (
            <p role="alert" className="form-error">
              {editorError}
            </p>
          )}
          <div className="studio-modal-footer">
            <span>
              {modulesOf(editor.curriculum).length} modules ·{" "}
              {editor.journeyId ? "Your enrolled copy" : "Your authored skill"}
            </span>
            <div className="button-row">
              {editor.draft && (
                <Action
                  secondary
                  disabled={pending || aiBusy}
                  onClick={async () => {
                    const result = curriculumSchema.safeParse(
                      editor.curriculum,
                    );
                    if (!result.success) {
                      setEditorError(
                        result.error.issues[0]?.message ||
                          "Review the curriculum fields.",
                      );
                      return;
                    }
                    if (await saveDraft(editor.id, result.data))
                      setEditorError("");
                  }}
                >
                  Save draft
                </Action>
              )}
              <Action
                disabled={pending || aiBusy}
                onClick={async () => {
                  const result = curriculumSchema.safeParse(editor.curriculum);
                  if (!result.success) {
                    setEditorError(
                      result.error.issues[0]?.message ||
                        "Review the curriculum fields.",
                    );
                    return;
                  }
                  const ok = await mutate(
                    editor.journeyId
                      ? {
                          type: "journey.reforge",
                          id: editor.journeyId,
                          curriculum: result.data,
                        }
                      : {
                          type: "division.save",
                          value: {
                            id: editor.id,
                            curriculum: result.data,
                            visibility: editor.visibility,
                            source: editor.source,
                          },
                        },
                    "Skill curriculum saved",
                  );
                  if (ok) {
                    setEditor(null);
                    if (!editor.journeyId) {
                      setTab("mine");
                      go("plans");
                    }
                  }
                }}
              >
                Save{" "}
                {editor.journeyId
                  ? "my changes"
                  : editor.draft
                    ? "as private skill"
                    : "skill"}
                <Check size={15} />
              </Action>
            </div>
          </div>
        </Modal>
      )}
      {publishing && (
        <Modal title="Publish this skill?" close={() => setPublishing(null)}>
          <p>
            Other signed-in learners will be able to preview and enroll in{" "}
            <b>{publishing.title}</b>.
          </p>
          <div className="studio-notice">
            <Globe size={20} />
            <p>
              Only the curriculum and your profile name are shared. Your
              enrollments, progress, reflections, AI conversations, habits,
              mood, and journal remain private. Making a skill private later
              removes discovery; existing learners keep their enrolled copy.
            </p>
          </div>
          <Action
            disabled={pending}
            onClick={async () => {
              if (
                await mutate(
                  {
                    type: "division.visibility",
                    id: publishing.id,
                    visibility: "public",
                  },
                  "Skill published to community discovery",
                )
              )
                setPublishing(null);
            }}
          >
            Publish curriculum <Globe size={15} />
          </Action>
        </Modal>
      )}
    </div>
  );
}
function CurriculumOutline({ curriculum }: { curriculum: Curriculum }) {
  return (
    <div className="curriculum-outline">
      {curriculum.sections.map((s, i) => (
        <details key={s.id} open={i === 0}>
          <summary>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <b>{s.title}</b>
            <small>{s.modules.length} modules</small>
            <ChevronDown size={16} />
          </summary>
          <ol>
            {s.modules.map((m) => (
              <li key={m.id}>
                <BookOpen size={14} />
                <span>{m.title}</span>
                <small>{m.minutes} min</small>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
function ModulePlayer({
  journey: j,
  attempts,
  initialCheck,
  pending,
  mutate,
  back,
  edit,
  coach,
  addPrerequisite,
  planPractice,
  askCheckpointCoach,
  askPeers,
}: {
  journey: Enrollment;
  attempts: CheckpointAttempt[];
  initialCheck?: string;
  pending: boolean;
  mutate: Mutate;
  back: () => void;
  edit: () => void;
  coach: (module: ReturnType<typeof modulesOf>[number]) => void;
  addPrerequisite: (
    module: ReturnType<typeof modulesOf>[number],
    topic: string,
  ) => Promise<boolean>;
  planPractice: (concept: string, checkpoint: CheckpointRef) => void;
  askCheckpointCoach: (question: string) => void;
  askPeers?: (concept: string) => void;
}) {
  const mods = modulesOf(j),
    next = mods.findIndex((m) => !j.completed.includes(m.id));
  const [chosen, setChosen] = useState(initialCheck ?? (next < 0 ? mods[0].id : mods[next].id)),
    [stage, setStage] = useState(initialCheck ? 2 : 0),
    [reflection, setReflection] = useState(""),
    [practiced, setPracticed] = useState(false);
  const [prerequisite, setPrerequisite] = useState("");
  const m = mods.find((m) => m.id === chosen) || mods[0],
    index = mods.indexOf(m),
    locked = mods.slice(0, index).some((x) => !j.completed.includes(x.id)),
    done = j.completed.includes(m.id);
  const check = !locked && findCheckpoint(j.divisionId, m.id);
  const choose = (id: string) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setChosen(id);
    setStage(0);
    setReflection(j.reflections[id] || "");
    setPracticed(false);
    setPrerequisite("");
  };
  return (
    <div className="skill-player">
      <div className="player-top">
        <button className="text-link" onClick={back}>
          ← My learning
        </button>
        <button className="btn secondary" onClick={edit}>
          <Sparkles size={14} />
          Reforge my path
        </button>
      </div>
      <div className="player-heading">
        <PathMark category={j.category} />
        <div>
          <span className="eyebrow">MY ENROLLED SKILL</span>
          <h2>{j.title}</h2>
          <p>{j.goal}</p>
        </div>
      </div>
      <div className="player-layout">
        <aside className="player-curriculum">
          <Progress done={j.completed.length} total={mods.length} />
          <span className="player-pace">
            {j.minutes} minutes · {j.days} days/week
          </span>
          <SkillMap journey={j} active={m.id} choose={choose} attempts={attempts} />
        </aside>
        <article className="module-content" data-tour="module">
          <div className="module-meta">
            <span>
              MODULE {index + 1} OF {mods.length}
            </span>
            <span>
              <Clock3 size={13} />
              {m.minutes} min suggested
            </span>
          </div>
          <h2>{m.title}</h2>
          {!done && !locked && (
            <details className="checkpoint-recovery">
              <summary>Need a smaller step?</summary>
              <form
                className="form-stack"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (await addPrerequisite(m, prerequisite))
                    setPrerequisite("");
                }}
              >
                <label>
                  Concept to practice first
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    value={prerequisite}
                    onChange={(event) => setPrerequisite(event.target.value)}
                    placeholder="e.g. Choosing a variable to isolate"
                  />
                </label>
                <div className="button-row">
                  <button className="btn secondary" disabled={pending}>
                    Add practice checkpoint
                  </button>
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => coach(m)}
                  >
                    Ask the coach for help
                  </button>
                </div>
              </form>
            </details>
          )}
          <div className="module-tabs" role="group" aria-label="Module steps">
            {["Learn", "Practice", "Check & reflect"].map((s, i) => (
              <button
                key={s}
                className={stage === i ? "active" : ""}
                aria-pressed={stage === i}
                onClick={() => setStage(i)}
              >
                <span>{i + 1}</span>
                {s}
              </button>
            ))}
          </div>
          {locked && (
            <div className="studio-notice">
              <LockKeyhole size={18} />
              <p>
                You can preview this module. Complete the preceding modules to
                record progress here.
              </p>
            </div>
          )}
          {stage === 0 ? (
            <>
              <span className="eyebrow">UNDERSTAND THE IDEA</span>
              <div className="module-lesson">
                {m.lesson.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <div className="module-tip">
                <Sparkles size={20} />
                <div>
                  <b>Make it click.</b>
                  <p>
                    Try explaining the idea in your own words before moving on.
                    Ask your AI coach for another example if you need one.
                  </p>
                </div>
                <button className="text-link" onClick={() => coach(m)}>
                  Ask coach <ArrowRight size={14} />
                </button>
              </div>
              <Action onClick={() => setStage(1)}>
                Try the practice <ArrowRight size={15} />
              </Action>
            </>
          ) : stage === 1 ? (
            <>
              <span className="eyebrow">LEARN BY DOING</span>
              <h3>Your practice task</h3>
              <p className="module-lesson">{m.exercise}</p>
              <div className="module-check-goal">
                <Target size={20} />
                <div>
                  <b>What success looks like</b>
                  <p>{m.check}</p>
                </div>
              </div>
              <p className="muted">
                Work in your preferred editor, notebook, or tool. SkillSwap
                records your reflection, not an independently verified
                assessment.
              </p>
              <Action onClick={() => setStage(2)}>
                Review my practice <ArrowRight size={15} />
              </Action>
            </>
          ) : (
            <>
              <span className="eyebrow">NOTICE WHAT YOU CAN DO NOW</span>
              <h3>{done ? "Module completed" : "Check your understanding"}</h3>
              <p className="module-lesson">{m.check}</p>
              {check && (
                <CheckpointReview
                  key={m.id}
                  check={check}
                  attempts={attempts.filter((attempt) => attempt.moduleId === m.id)}
                  pending={pending}
                  save={(id, question, choice, reasoning) => mutate({
                    type: "checkpoint.answer",
                    id,
                    journeyId: j.id,
                    moduleId: m.id,
                    question,
                    choice,
                    reasoning,
                  })}
                  planPractice={() => planPractice(check.concept, { journeyId: j.id, moduleId: m.id })}
                  askCoach={askCheckpointCoach}
                  askPeers={askPeers ? () => askPeers(check.concept) : undefined}
                />
              )}
              {done ? (
                <>
                  <div className="saved-reflection">
                    <Check size={18} />
                    <p>
                      {j.reflections[m.id] ||
                        "Progress preserved from your previous learning plan."}
                    </p>
                  </div>
                  <Action
                    onClick={() => {
                      const following = mods[index + 1];
                      if (following) choose(following.id);
                      else back();
                    }}
                  >
                    {index + 1 < mods.length
                      ? "Next module"
                      : "Return to my learning"}
                    <ArrowRight size={15} />
                  </Action>
                </>
              ) : (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await mutate(
                        {
                          type: "journey.complete",
                          id: j.id,
                          moduleId: m.id,
                          reflection,
                        },
                        "Module completed. Your progress is saved.",
                      )
                    ) {
                      setPracticed(false);
                    }
                  }}
                >
                  <label className="practice-confirm">
                    <input
                      type="checkbox"
                      required
                      checked={practiced}
                      onChange={(e) => setPracticed(e.target.checked)}
                    />
                    I completed the practice and checked the result.
                  </label>
                  <label>
                    What did you learn or produce?
                    <textarea
                      minLength={8}
                      maxLength={2000}
                      required
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                      placeholder="Describe your result, what you understand, or what you would improve…"
                    />
                  </label>
                  <Action
                    type="submit"
                    disabled={
                      pending ||
                      locked ||
                      !practiced ||
                      reflection.trim().length < 8
                    }
                  >
                    Complete module <Check size={15} />
                  </Action>
                </form>
              )}
            </>
          )}
          {j.completed.length === mods.length && (
            <div className="skill-finished">
              <Trophy size={25} />
              <div>
                <h3>Skill path completed.</h3>
                <p>
                  Your completion milestone is now on your profile. Keep
                  practicing and revisit any module.
                </p>
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
function emptyModule() {
  return {
    id: uid(),
    title: "",
    lesson: "",
    exercise: "",
    check: "",
    minutes: 25,
  };
}
function CurriculumEditor({
  value,
  change,
  disabled,
}: {
  value: Curriculum;
  change: (v: Curriculum) => void;
  disabled: boolean;
}) {
  const update = (s: number, m: number, field: string, v: string | number) => {
    const next = structuredClone(value);
    Object.assign(next.sections[s].modules[m], { [field]: v });
    change(next);
  };
  return (
    <fieldset
      className="curriculum-editor"
      disabled={disabled}
      aria-label="Curriculum"
    >
      <div className="studio-form-two">
        <label>
          Skill title
          <input
            value={value.title}
            placeholder="e.g. Python for data analysis"
            maxLength={160}
            onChange={(e) => change({ ...value, title: e.target.value })}
          />
        </label>
        <label>
          Category
          <input
            value={value.category}
            placeholder="e.g. Data science"
            maxLength={60}
            onChange={(e) => change({ ...value, category: e.target.value })}
          />
        </label>
      </div>
      <label>
        Summary
        <textarea
          maxLength={1000}
          value={value.summary}
          placeholder="What will learners be able to do?"
          onChange={(e) => change({ ...value, summary: e.target.value })}
        />
      </label>
      <label>
        Starting level
        <select
          value={value.level}
          onChange={(e) =>
            change({ ...value, level: e.target.value as Curriculum["level"] })
          }
        >
          {["beginner", "intermediate", "advanced"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {value.sections.map((s, si) => (
        <div key={s.id} className="editor-section">
          <div className="editor-section-head">
            <span>SECTION {si + 1}</span>
            <button
              className="text-link"
              disabled={value.sections.length === 1}
              onClick={() =>
                change({
                  ...value,
                  sections: value.sections.filter((x) => x.id !== s.id),
                })
              }
            >
              <Trash2 size={13} />
              Remove section
            </button>
          </div>
          <label>
            Section title
            <input
              maxLength={160}
              value={s.title}
              placeholder="e.g. Working with datasets"
              onChange={(e) => {
                const sections = structuredClone(value.sections);
                sections[si].title = e.target.value;
                change({ ...value, sections });
              }}
            />
          </label>
          {s.modules.map((m, mi) => (
            <details
              className="editor-module"
              key={m.id}
              open={s.modules.length === 1}
            >
              <summary>
                <b>
                  {mi + 1}. {m.title || "Untitled module"}
                </b>
                <ChevronDown size={15} />
              </summary>
              <div>
                <label>
                  Module title
                  <input
                    maxLength={160}
                    value={m.title}
                    placeholder="Name this module"
                    onChange={(e) => update(si, mi, "title", e.target.value)}
                  />
                </label>
                <label>
                  Explanation
                  <textarea
                    maxLength={6000}
                    value={m.lesson}
                    placeholder="Explain the concept in your own words."
                    onChange={(e) => update(si, mi, "lesson", e.target.value)}
                  />
                </label>
                <label>
                  Practice exercise
                  <textarea
                    maxLength={2000}
                    value={m.exercise}
                    placeholder="Give learners a specific activity to try."
                    onChange={(e) => update(si, mi, "exercise", e.target.value)}
                  />
                </label>
                <label>
                  Completion check
                  <textarea
                    maxLength={1000}
                    value={m.check}
                    placeholder="How can learners tell they completed the exercise?"
                    onChange={(e) => update(si, mi, "check", e.target.value)}
                  />
                </label>
                <label>
                  Suggested minutes
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={m.minutes}
                    onChange={(e) => update(si, mi, "minutes", +e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="btn secondary"
                    disabled={mi === 0}
                    onClick={() => {
                      const next = structuredClone(value);
                      [
                        next.sections[si].modules[mi - 1],
                        next.sections[si].modules[mi],
                      ] = [
                        next.sections[si].modules[mi],
                        next.sections[si].modules[mi - 1],
                      ];
                      change(next);
                    }}
                  >
                    <ChevronUp size={14} />
                    Move up
                  </button>
                  <button
                    className="text-link"
                    disabled={s.modules.length === 1}
                    onClick={() => {
                      const next = structuredClone(value);
                      next.sections[si].modules.splice(mi, 1);
                      change(next);
                    }}
                  >
                    <Trash2 size={13} />
                    Remove module
                  </button>
                </div>
              </div>
            </details>
          ))}
          <Action
            secondary
            disabled={s.modules.length >= 12}
            onClick={() => {
              const next = structuredClone(value);
              next.sections[si].modules.push(emptyModule());
              change(next);
            }}
          >
            <Plus size={14} />
            Add module
          </Action>
        </div>
      ))}
      <Action
        secondary
        disabled={value.sections.length >= 8}
        onClick={() =>
          change({
            ...value,
            sections: [
              ...value.sections,
              {
                id: uid(),
                title: "",
                modules: [emptyModule()],
              },
            ],
          })
        }
      >
        <Plus size={15} />
        Add section
      </Action>
    </fieldset>
  );
}

export function ProfileStudio({
  data,
  mutate,
  pending,
  connected,
  picture,
}: {
  data: WorkspaceData;
  mutate: Mutate;
  pending: boolean;
  connected: boolean;
  picture: ReturnType<typeof useProfilePicture>;
}) {
  const p = data.personal,
    extra = p.profileExtras;
  const [headline, setHeadline] = useState(extra.headline),
    [links, setLinks] = useState(extra.links),
    [achievement, setAchievement] = useState({
      title: "",
      description: "",
      url: "",
    });
  useEffect(() => {
    setHeadline(extra.headline);
    setLinks(extra.links);
  }, [extra.headline, extra.links]);
  const milestones = [
    ...(p.journeys.some((j) => j.completed.length > 0)
      ? [
          {
            title: "First module",
            description: "Completed a guided learning module.",
            icon: BookOpen,
          },
        ]
      : []),
    ...p.journeys
      .filter((j) => j.completed.length === modulesOf(j).length)
      .map((j) => ({
        title: j.title,
        description: `Completed ${modulesOf(j).length} modules · self-reported practice`,
        icon: Trophy,
      })),
    ...(streak(p.activity) >= 7
      ? [
          {
            title: "Seven-day consistency",
            description:
              "Recorded learning activity for at least seven consecutive days.",
            icon: Flag,
          },
        ]
      : []),
    ...(p.focus.length
      ? [
          {
            title: "Focused learner",
            description: `${p.focus.length} completed focus sessions`,
            icon: Target,
          },
        ]
      : []),
  ];
  return (
    <div className="profile-studio">
      <section className="profile-cover" data-tour="profile">
        <div className="profile-cover-art" />
        <span className="avatar profile-avatar">
          {picture.url ? (
            <img
              className="avatar-image"
              src={picture.url}
              alt="Your profile picture"
            />
          ) : (
            (
              p.onboarding.answers?.displayName ||
              data.profile.full_name ||
              "You"
            )
              .split(" ")
              .slice(0, 2)
              .map((s) => s[0])
              .join("")
          )}
        </span>
        <div>
          <span className="eyebrow">MY SKILLSWAP PROFILE</span>
          <h2>
            {p.onboarding.answers?.displayName ||
              data.profile.full_name ||
              "Your learning profile"}
          </h2>
          <p>
            {headline ||
              "Add a headline to introduce yourself and your interests."}
          </p>
          <span className="muted">
            {data.profile.username
              ? `@${data.profile.username}`
              : "Choose a username below"}
            {data.profile.institution ? ` · ${data.profile.institution}` : ""}
          </span>
          <ProfilePictureControls picture={picture} />
        </div>
        <div className="profile-counts">
          <span>
            <b>{p.journeys.length}</b>enrolled skills
          </span>
          <span>
            <b>{p.journeys.reduce((n, j) => n + j.completed.length, 0)}</b>
            modules completed
          </span>
        </div>
      </section>
      <div className="profile-studio-grid">
        <div>
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>About & social links</h2>
                <p>
                  {data.profile.bio ||
                    "Tell people about your interests, projects, and experience."}
                </p>
              </div>
            </div>
            <div className="profile-socials">
              {extra.links.map((l, i) => (
                <a
                  key={i}
                  href={safeLink(l.url) || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe size={15} />
                  {l.label}
                  <ArrowRight size={13} />
                </a>
              ))}
            </div>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                await mutate(
                  {
                    type: "profile.extras",
                    value: { ...extra, headline, links },
                  },
                  "Profile links saved",
                );
              }}
            >
              <label>
                Profile headline
                <input
                  value={headline}
                  maxLength={160}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Computer science student · building accessible apps"
                />
              </label>
              {links.map((l, i) => (
                <div className="profile-link-editor" key={i}>
                  <input
                    aria-label={`Link ${i + 1} label`}
                    maxLength={50}
                    required
                    value={l.label}
                    placeholder="e.g. GitHub"
                    onChange={(e) =>
                      setLinks(
                        links.map((v, n) =>
                          n === i ? { ...v, label: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Link ${i + 1} URL`}
                    type="url"
                    required
                    maxLength={1500}
                    value={l.url}
                    placeholder="https://…"
                    onChange={(e) =>
                      setLinks(
                        links.map((v, n) =>
                          n === i ? { ...v, url: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove link ${i + 1}`}
                    onClick={() => setLinks(links.filter((_, n) => n !== i))}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <div className="button-row">
                <Action
                  secondary
                  disabled={links.length >= 8}
                  onClick={() => setLinks([...links, { label: "", url: "" }])}
                >
                  <Plus size={14} />
                  Add social link
                </Action>
                <Action type="submit" disabled={pending}>
                  Save links & headline
                </Action>
              </div>
            </form>
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Profile details</h2>
                <p>
                  {connected
                    ? "Your name, bio, and institution are visible to signed-in learners. Extra links and achievements stay in your workspace for now."
                    : "Saved on this device until an account is connected."}
                </p>
              </div>
            </div>
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget));
                await mutate(
                  {
                    type: "profile",
                    value: {
                      full_name: String(v.full_name),
                      username: String(v.username),
                      bio: String(v.bio),
                      institution: String(v.institution),
                    },
                  },
                  "Profile details updated",
                );
              }}
            >
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  name="full_name"
                  defaultValue={data.profile.full_name}
                />
              </label>
              <label>
                Username
                <input
                  required
                  pattern="[a-z0-9_]{3,24}"
                  title="3–24 lowercase letters, numbers, or underscores"
                  name="username"
                  defaultValue={data.profile.username}
                />
              </label>
              <label className="full-width">
                Institution
                <input
                  maxLength={150}
                  name="institution"
                  defaultValue={data.profile.institution}
                />
              </label>
              <label className="full-width">
                Bio
                <textarea
                  maxLength={400}
                  name="bio"
                  defaultValue={data.profile.bio}
                />
              </label>
              <div className="full-width">
                <Action type="submit" disabled={pending}>
                  Save profile <Check size={15} />
                </Action>
              </div>
            </form>
          </section>
        </div>
        <div>
          <section className="panel profile-milestones">
            <span className="eyebrow">EARNED THROUGH YOUR ACTIVITY</span>
            <h2>SkillSwap milestones</h2>
            <p className="muted">
              Learning milestones, not verified qualifications.
            </p>
            {milestones.length ? (
              milestones.map((m, i) => (
                <div className="milestone-card" key={i}>
                  <span>
                    <m.icon size={21} />
                  </span>
                  <div>
                    <h3>{m.title}</h3>
                    <p>{m.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="milestone-empty">
                <Trophy size={34} />
                <h3>Your first milestone is ahead.</h3>
                <p>
                  Complete a module or a focus session to begin your collection.
                </p>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Outside SkillSwap</h2>
            <p className="muted">
              Add projects, awards, courses, or other accomplishments. These are
              self-reported.
            </p>
            {[
              ...extra.achievements,
              ...data.proofs
                .filter((x) => x.author_id === data.userId)
                .map((x) => ({
                  id: x.id,
                  title: x.title,
                  description: x.description,
                  url: x.evidence_url,
                })),
            ].map((a) => (
              <article className="external-achievement" key={a.id}>
                <Trophy size={18} />
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.description}</p>
                  {safeLink(a.url) && (
                    <a
                      className="text-link"
                      href={safeLink(a.url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View evidence <ArrowRight size={13} />
                    </a>
                  )}
                </div>
              </article>
            ))}
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate(
                    {
                      type: "profile.extras",
                      value: {
                        ...extra,
                        achievements: [
                          ...extra.achievements,
                          { ...achievement, id: uid() },
                        ],
                      },
                    },
                    "Achievement added",
                  )
                )
                  setAchievement({ title: "", description: "", url: "" });
              }}
            >
              <label>
                Achievement title
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={achievement.title}
                  onChange={(e) =>
                    setAchievement({ ...achievement, title: e.target.value })
                  }
                />
              </label>
              <label>
                What did you accomplish?
                <textarea
                  maxLength={1000}
                  value={achievement.description}
                  onChange={(e) =>
                    setAchievement({
                      ...achievement,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Evidence or project link (optional)
                <input
                  type="url"
                  maxLength={1500}
                  value={achievement.url}
                  onChange={(e) =>
                    setAchievement({ ...achievement, url: e.target.value })
                  }
                />
              </label>
              <Action
                type="submit"
                secondary
                disabled={pending || extra.achievements.length >= 30}
              >
                Add achievement <Plus size={15} />
              </Action>
            </form>
          </section>
        </div>
      </div>
      <LearningMemory data={data} mutate={mutate} pending={pending} />
    </div>
  );
}
export function StudioSettings({
  data,
  mutate,
  pending,
  models,
}: {
  data: WorkspaceData;
  mutate: Mutate;
  pending: boolean;
  models: { id: string; label: string }[];
}) {
  const settings = data.personal.experience;
  return (
    <section className="panel" data-tour="settings">
      <div className="section-head">
        <div>
          <h2>Your colors & AI model</h2>
          <p>
            Choose an accent for your workspace and a model made available by
            the app owner.
          </p>
        </div>
        <Sparkles size={21} />
      </div>
      <div className="setting-row">
        <div>
          <h3>Interface accent</h3>
          <p>Applied to actions, navigation, progress, and learning cards.</p>
        </div>
        <div
          className="accent-picker"
          role="group"
          aria-label="Interface accent"
        >
          {(["mint", "violet", "blue", "peach", "rose"] as const).map(
            (color) => (
              <button
                className={`accent-swatch ${color}`}
                key={color}
                aria-label={`${color} accent`}
                aria-pressed={settings.accent === color}
                disabled={pending}
                onClick={() =>
                  mutate(
                    {
                      type: "experience.settings",
                      value: { ...settings, accent: color },
                    },
                    "Workspace color updated",
                  )
                }
              >
                {settings.accent === color && <Check size={16} />}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="setting-row">
        <div>
          <h3>AI model</h3>
          <p>
            {models.length
              ? "Used for coach conversations, new skills, and AI reforging."
              : "Connect AI and configure the allowed models to enable this choice. No model is simulated."}
          </p>
        </div>
        <select
          aria-label="AI model"
          disabled={pending || !models.length}
          value={
            models.some((m) => m.id === settings.aiModel)
              ? settings.aiModel
              : ""
          }
          onChange={(e) =>
            mutate(
              {
                type: "experience.settings",
                value: { ...settings, aiModel: e.target.value },
              },
              "AI model preference saved",
            )
          }
        >
          <option value="">Service default</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
