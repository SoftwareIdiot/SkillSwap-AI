"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Circle,
  Clock3,
  FileCheck2,
  MessagesSquare,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Waypoints,
} from "lucide-react";
import Logo from "./logo";
import AuthForm from "./auth-form";
import { chapterEase } from "@/lib/intro-motion";
import "./intro.css";
const Scene = dynamic(() => import("./intro-scene"), { ssr: false });
const chapters = [
  { name: "Overview", label: "OVERVIEW" },
  { name: "Skill studio", label: "SKILL STUDIO" },
  { name: "AI study coach", label: "AI STUDY COACH" },
  { name: "Sign in", label: "YOUR WORKSPACE" },
];
const chapterHashes = ["#welcome", "#exchange", "#coach", "#join"];
function chapterFromHash() {
  return Math.max(0, chapterHashes.indexOf(location.hash));
}
function ExampleTag() {
  return <span className="intro-example-tag">ILLUSTRATIVE EXAMPLE</span>;
}

export default function IntroExperience({
  authReady,
  atAuth = false,
  authError,
}: {
  authReady: boolean;
  atAuth?: boolean;
  authError?: string;
}) {
  const progress = useRef(atAuth ? 3 : 0),
    root = useRef<HTMLElement>(null),
    travel = useRef<(chapter: number) => void>(() => {}),
    motionSettings = useRef({ motion: true, reduced: false });
  const [position, setPosition] = useState(atAuth ? 3 : 0),
    [motion, setMotion] = useState(true),
    [reduced, setReduced] = useState(false),
    [mode, setMode] = useState<"signup" | "login">(atAuth ? "login" : "signup"),
    [mounted, setMounted] = useState(false);
  const active = Math.min(3, Math.round(position));
  motionSettings.current = { motion, reduced };
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReduced(media.matches);
      setMotion(!media.matches);
    };
    updateMotion();
    media.addEventListener("change", updateMotion);
    let frame = 0,
      focusFrame = 0;
    const show = (chapter: number, record = true, focus = true) => {
      const target = Math.max(0, Math.min(3, chapter));
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      setPosition(target);
      if (record && location.hash !== chapterHashes[target])
        history.pushState({}, "", chapterHashes[target]);
      const from = progress.current,
        started = performance.now();
      const duration =
        motionSettings.current.reduced || !motionSettings.current.motion
          ? 0
          : 300;
      const tick = (now: number) => {
        const t = duration ? Math.min(1, (now - started) / duration) : 1;
        progress.current = from + (target - from) * chapterEase(t);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      if (focus)
        focusFrame = requestAnimationFrame(() => {
          const panel = root.current?.querySelector<HTMLElement>(
            '[data-panel="' + target + '"] .intro-chapter',
          );
          if (panel) panel.scrollTop = 0;
          const heading = panel?.querySelector<HTMLElement>("h1, h2");
          heading?.setAttribute("tabindex", "-1");
          heading?.focus({ preventScroll: true });
        });
    };
    travel.current = show;
    const initial = atAuth ? 3 : chapterFromHash();
    progress.current = initial;
    setPosition(initial);
    setMounted(true);
    const pop = () => show(chapterFromHash(), false);
    window.addEventListener("popstate", pop);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      media.removeEventListener("change", updateMotion);
      window.removeEventListener("popstate", pop);
    };
  }, [atAuth]);
  const go = (chapter: number, formMode?: "signup" | "login") => {
    if (formMode) setMode(formMode);
    travel.current(chapter);
  };
  return (
    <main
      ref={root}
      className={`intro-experience ${mounted ? "is-mounted" : ""}`}
      aria-label="Welcome to SkillSwap"
    >
      <div className="intro-sticky">
        <div
          className={`intro-frame ${active === 3 ? "at-login" : ""}`}
          data-chapter={active}
        >
          <div className="intro-backdrop" />
          <Scene progress={progress} reducedMotion={!motion} />
          <div className="intro-scene-shade" />
        </div>
      </div>
      <div className="intro-controls">
        <header className="intro-nav">
          <button
            className="intro-brand"
            aria-label="SkillSwap introduction"
            onClick={() => go(0)}
          >
            <Logo />
          </button>
          <span className="intro-step-status">
            Step {active + 1} of 4 / {chapters[active].name}
          </span>
          <button
            className="intro-motion-toggle"
            onClick={() => setMotion((v) => !v)}
            title={
              reduced && !motion
                ? "Reduced motion is on. Enable page animations."
                : "Pause or resume the background animation"
            }
            aria-label={
              motion ? "Pause ambient animation" : "Resume ambient animation"
            }
            aria-pressed={!motion}
          >
            {motion ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            className="intro-sign-in"
            onClick={() => go(3, "login")}
          >
            Sign in <ArrowUpRight size={14} />
          </button>
        </header>
        <footer className="intro-footer">
          <button
            className="intro-back"
            aria-label="Previous step"
            onClick={() => go(active - 1)}
            disabled={active === 0}
          >
            <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} />
            <span>Back</span>
          </button>
          {active === 3 && !authReady ? (
            <Link href="/student" className="intro-preview-link">
              Open local workspace <ArrowUpRight size={13} />
            </Link>
          ) : (
            <div className="intro-progress">
              <span>{String(active + 1).padStart(2, "0")}</span>
              <div>
                <i style={{ transform: `scaleX(${(active + 1) / 4})` }} />
              </div>
              <span>04</span>
            </div>
          )}
          {active < 3 && (
            <button
              className="intro-button primary-action intro-next"
              onClick={() =>
                go(active + 1, active === 2 ? "signup" : undefined)
              }
            >
              {
                [
                  "Explore SkillSwap",
                  "Explore the AI study coach",
                  "Set up your learning profile",
                ][active]
              }
              <ArrowRight size={16} />
            </button>
          )}
        </footer>
      </div>
      <div className="intro-pages">
        <div className="intro-panel" data-panel="0" hidden={active !== 0}>
          <section
            className="intro-chapter intro-hero"
            aria-hidden={active !== 0}
            inert={active !== 0}
          >
            <div className="intro-hero-copy">
              <span className="intro-eyebrow">
                <span className="intro-status-dot" />
                GUIDED SKILLS + PERSONALIZED AI
              </span>
              <h1>
                Learn new skills.
                <br />
                <em>Build them your way.</em>
              </h1>
              <p>
                Explore structured skills, practice through guided modules, and
                shape your learning with personalized AI support.
              </p>
              <div className="intro-hero-points">
                <span>
                  <Check size={13} />
                  Guided skill curricula
                </span>
                <span>
                  <Check size={13} />
                  Personalized study support
                </span>
              </div>
            </div>
            <div className="intro-hero-visual">
              <div className="intro-visual-caption">
                <span className="intro-status-dot" />
                YOUR NEXT SKILL STARTS HERE
              </div>
              <div className="intro-swap-strip">
                <ExampleTag />
                <div>
                  <span>
                    <small>EXPLORE</small>
                    <b>UI design</b>
                  </span>
                  <Waypoints size={23} />
                  <span>
                    <small>BUILD</small>
                    <b>Frontend skills</b>
                  </span>
                </div>
              </div>
            </div>
            <div className="intro-capabilities">
              <span>
                <Waypoints size={16} />
                Skill studio
              </span>
              <span>
                <MessagesSquare size={16} />
                Daily planner
              </span>
              <span>
                <Sparkles size={16} />
                AI study coach
              </span>
              <span>
                <FileCheck2 size={16} />
                Learning milestones
              </span>
            </div>
          </section>
        </div>
        <div className="intro-panel" data-panel="1" hidden={active !== 1}>
          <section
            className="intro-chapter intro-story exchange-story"
            aria-hidden={active !== 1}
            inert={active !== 1}
          >
            <div className="intro-story-copy">
              <span className="intro-eyebrow">
                <Waypoints size={15} />
                01 / SKILL STUDIO
              </span>
              <h2>
                Find your next
                <br />
                <em>skill to build.</em>
              </h2>
              <p>
                Preview a ready-made skill, choose your study pace, and work
                through clear sections and practical modules. Or create a
                curriculum of your own.
              </p>
              <ol className="intro-workflow">
                <li>
                  <span>01</span>
                  <div>
                    <b>Explore a curriculum</b>
                    <small>
                      Browse starter skills and inspect the sections before
                      enrolling.
                    </small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <b>Make it yours</b>
                    <small>
                      Choose a learning goal and a pace you can maintain.
                    </small>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <b>Learn one module at a time</b>
                    <small>
                      Understand a concept, practice it, and reflect on your
                      result.
                    </small>
                  </div>
                </li>
              </ol>
            </div>
            <div className="intro-plan-example">
              <div className="intro-panel-heading">
                <span>
                  <BookOpen size={16} />
                  Frontend foundations
                </span>
                <ExampleTag />
              </div>
              <div className="intro-plan-goal">
                <span className="intro-eyebrow">GUIDED STARTER SKILL</span>
                <h3>From concepts to practice.</h3>
                <div>
                  <span>3 sections</span>
                  <span>9 modules</span>
                  <span>Your own pace</span>
                </div>
              </div>
              <div className="intro-plan-steps">
                <div>
                  <span>01</span>
                  <div>
                    <b>Structure a web page</b>
                    <small>HTML, forms, and accessible navigation</small>
                  </div>
                </div>
                <div>
                  <span>02</span>
                  <div>
                    <b>Design for every screen</b>
                    <small>CSS, flexible layouts, and readability</small>
                  </div>
                </div>
                <div>
                  <span>03</span>
                  <div>
                    <b>Make the page interactive</b>
                    <small>Events, search, and a complete project</small>
                  </div>
                </div>
              </div>
              <div className="intro-plan-footer">
                <Check size={14} />
                <span>Learn, practice, and check your understanding.</span>
              </div>
            </div>
          </section>
        </div>
        <div className="intro-panel" data-panel="2" hidden={active !== 2}>
          <section
            className="intro-chapter intro-story ai-story"
            aria-hidden={active !== 2}
            inert={active !== 2}
          >
            <div className="intro-story-copy">
              <span className="intro-eyebrow">
                <Sparkles size={15} />
                02 / PERSONALIZED AI LEARNING
              </span>
              <h2>
                A study plan built
                <br />
                <em>around your goals.</em>
              </h2>
              <p>
                Set your goal, current level, study time, and preferred
                explanation style. Your coach can use these preferences and your
                progress to guide your next session.
              </p>
              <div className="intro-ai-features">
                <span>
                  <BookOpen size={17} />
                  <b>Understand a concept</b>
                  <small>Ask for examples and step-by-step explanations.</small>
                </span>
                <span>
                  <Target size={17} />
                  <b>Practice and get feedback</b>
                  <small>
                    Use quizzes, project reviews, and study checkpoints.
                  </small>
                </span>
                <span>
                  <ShieldCheck size={17} />
                  <b>Control personalization</b>
                  <small>
                    Edit the coach’s memory and choose what context it uses.
                  </small>
                </span>
              </div>
            </div>
            <div className="intro-plan-example">
              <div className="intro-panel-heading">
                <span>
                  <Sparkles size={17} />
                  Your learning plan
                </span>
                <ExampleTag />
              </div>
              <div className="intro-plan-goal">
                <span className="intro-eyebrow">LEARNING GOAL</span>
                <h3>Build a React project</h3>
                <div>
                  <span>Beginner</span>
                  <span>
                    <Clock3 size={12} />
                    25 min / day
                  </span>
                  <span>Practical examples</span>
                </div>
              </div>
              <div className="intro-plan-steps">
                {[
                  ["Components & props", "Build a reusable profile card."],
                  ["State & interactions", "Add an interactive skill filter."],
                  ["A complete project", "Build a small skill-exchange page."],
                ].map(([title, description], i) => (
                  <div key={title}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <b>{title}</b>
                      <small>{description}</small>
                    </div>
                    <Circle size={15} />
                  </div>
                ))}
              </div>
              <div className="intro-plan-footer">
                <ShieldCheck size={14} />
                <span>Your preferences shape the plan.</span>
              </div>
            </div>
          </section>
        </div>
        <div className="intro-panel" data-panel="3" hidden={active !== 3}>
          <section
            className="intro-chapter intro-login"
            aria-hidden={active !== 3}
            inert={active !== 3}
          >
            <div className="intro-login-copy">
              <span className="intro-eyebrow">
                03 / YOUR SKILLSWAP WORKSPACE
              </span>
              <h2>
                Manage your learning
                <br />
                <em>in one place.</em>
              </h2>
              <p>
                {mode === "signup"
                  ? "Create your account to set up your learning profile, choose your first skill, and start making progress."
                  : "Sign in to access your enrolled skills, daily planner, personal profile, and AI study tools."}
              </p>
              <div className="intro-login-values">
                <span>
                  <Waypoints size={18} />
                  <div>
                    <b>Your enrolled skills</b>
                    <small>
                      Sections, modules, practice tasks, and saved progress.
                    </small>
                  </div>
                </span>
                <span>
                  <Sparkles size={18} />
                  <div>
                    <b>Your AI learning profile</b>
                    <small>
                      Saved plans, preferences, and coach conversations.
                    </small>
                  </div>
                </span>
                <span>
                  <FileCheck2 size={18} />
                  <div>
                    <b>Your progress and work</b>
                    <small>
                      Tasks, habits, daily reflections, and learning milestones.
                    </small>
                  </div>
                </span>
              </div>
              <div className="intro-login-detail">
                <ShieldCheck size={15} />
                <span>Your learning preferences stay under your control.</span>
              </div>
            </div>
            <div className="intro-login-form">
              {authError && (
                <p className="intro-auth-error" role="alert">
                  {authError === "recovery"
                    ? "Your recovery session has expired. Request a new password reset email."
                    : authError === "google-setup"
                      ? "Google sign-in needs the account service connected. You can use the local workspace below."
                      : authError === "google-provider"
                        ? "Google sign-in is not available yet. Please use email or the local workspace."
                        : authError === "google-connection"
                          ? "Google sign-in could not connect. Please try again later."
                          : authError === "google-cancelled"
                            ? "Google sign-in was cancelled. You can try again or use email."
                            : authError === "google"
                              ? "Google sign-in could not finish. Try again, or use email."
                              : "That verification link could not be used. Request a new email or sign in again."}
                </p>
              )}
              <AuthForm
                configured={authReady}
                initialMode={mode}
                variant="gateway"
              />
              <p className="intro-form-foot">
                <ShieldCheck size={12} />
                SkillSwap accounts connect your learning across devices.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
