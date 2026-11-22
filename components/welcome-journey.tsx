"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Compass,
  Flag,
  GraduationCap,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Play,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import Logo from "./logo";
import type { Operation, WorkspaceData } from "@/lib/workspace";
import { modulesOf } from "@/lib/skill-paths";
import {
  studyStyles,
  suggestedStarters,
  tourSteps,
  supportEmail,
  supportLinks,
  type WelcomeAnswers,
  type TourView,
} from "@/lib/welcome";
import "./welcome-journey.css";
type Save = (op: Operation, message?: string) => Promise<boolean>;
const styleLabels = [
  {
    title: "Learn by doing",
    detail: "Practical examples and small projects",
    icon: Target,
  },
  {
    title: "Guide me step by step",
    detail: "Clear explanations, one concept at a time",
    icon: Layers3,
  },
  {
    title: "Ask me questions",
    detail: "Reason through ideas and test my understanding",
    icon: MessageCircle,
  },
  {
    title: "Keep it concise",
    detail: "Short explanations I can build on",
    icon: BookOpen,
  },
];
export function FirstVisit({
  data,
  save,
  pending,
  error,
  done,
}: {
  data: WorkspaceData;
  save: Save;
  pending: boolean;
  error: string;
  done: () => void;
}) {
  const p = data.personal;
  const [step, setStep] = useState(
      p.onboarding.status === "pending" ? p.onboarding.step : 0,
    ),
    [answers, setAnswers] = useState<WelcomeAnswers>(
      (p.onboarding.answers
        ? {
            ...p.onboarding.answers,
            style:
              p.onboarding.status === "pending"
                ? p.onboarding.answers.style
                : p.style,
            minutes:
              p.onboarding.status === "pending"
                ? p.onboarding.answers.minutes
                : p.minutes,
          }
        : null) || {
        displayName: data.profile.full_name || "",
        studying: p.interests || "",
        age: null,
        gender: "",
        style: p.style,
        minutes: p.minutes,
      },
    );
  const [selected, setSelected] = useState(""),
    [days, setDays] = useState(p.weeklyGoal),
    [goal, setGoal] = useState(p.goal),
    [customGender, setCustomGender] = useState(
      !["", "Woman", "Man", "Non-binary"].includes(answers.gender),
    ),
    [localError, setLocalError] = useState("");
  const recommendations = suggestedStarters(answers.studying),
    division = recommendations.find((r) => r.skill.id === selected)?.skill;
  const advance = async () => {
    if (
      await save({
        type: "welcome.answers",
        value: answers,
        step: Math.min(2, step + 1),
      })
    ) {
      setLocalError("");
      setStep(Math.min(2, step + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  return (
    <main
      className="first-visit"
      aria-label="Personalize your SkillSwap workspace"
    >
      <div className="welcome-top">
        <Logo />
        <span>
          <LockKeyhole size={13} />
          {data.userId === "local-learner"
            ? "Saved on this device"
            : "Saved privately to your account"}
        </span>
        <button
          disabled={pending}
          onClick={async () => {
            await save({ type: "welcome.skip" });
            done();
          }}
        >
          Set up later <ArrowRight size={13} />
        </button>
      </div>
      <div className="welcome-layout">
        <aside className="welcome-intro">
          <span className="eyebrow">WELCOME TO SKILLSWAP</span>
          <h1>
            A good start.
            <br />
            <em>Your own pace.</em>
          </h1>
          <p>
            Tell us what you're studying and how you learn. We'll help you
            choose a useful first skill.
          </p>
          <ol className="welcome-steps">
            {[
              "A little about you",
              "How you like to study",
              "Choose your first skill",
            ].map((title, i) => (
              <li
                className={i === step ? "active" : i < step ? "complete" : ""}
                key={title}
              >
                <span>
                  {i < step ? (
                    <Check size={15} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  <small>STEP {i + 1}</small>
                  <b>{title}</b>
                </div>
              </li>
            ))}
          </ol>
          <div className="welcome-privacy">
            <LockKeyhole size={17} />
            <p>
              Age and gender are optional. They stay private and aren't sent to
              the AI coach or used to rank skills.
            </p>
          </div>
        </aside>
        <section className="welcome-form-panel" key={step}>
          <div className="welcome-panel-title">
            <span className="eyebrow">
              {String(step + 1).padStart(2, "0")} / LET'S MAKE THIS USEFUL
            </span>
            <h2>
              {
                [
                  "What are you learning?",
                  "How do you study best?",
                  "Pick a skill to begin.",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "A few details will help this workspace feel familiar.",
                  "Choose the support and session length that fit your day.",
                  "All six starters are available. Suggestions use your study interests, and you can explore more skills later.",
                ][step]
              }
            </p>
          </div>
          {step === 0 ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                advance();
              }}
            >
              <label>
                Display name
                <input
                  autoComplete="nickname"
                  autoFocus
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="What should we call you?"
                  value={answers.displayName}
                  onChange={(e) =>
                    setAnswers({ ...answers, displayName: e.target.value })
                  }
                />
              </label>
              <label>
                What are you studying?
                <input
                  required
                  minLength={2}
                  maxLength={180}
                  placeholder="e.g. Computer science, business, design, or self-directed learning"
                  value={answers.studying}
                  onChange={(e) =>
                    setAnswers({ ...answers, studying: e.target.value })
                  }
                />
              </label>
              <div className="study-suggestions">
                {[
                  "Computer science",
                  "Design",
                  "Business",
                  "School subjects",
                  "Self-directed learning",
                ].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setAnswers({ ...answers, studying: value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="welcome-two">
                <label>
                  Age <span className="optional">optional</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    placeholder="Prefer not to say"
                    value={answers.age ?? ""}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        age:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Gender <span className="optional">optional</span>
                  <select
                    value={customGender ? "custom" : answers.gender}
                    onChange={(e) => {
                      setCustomGender(e.target.value === "custom");
                      setAnswers({
                        ...answers,
                        gender:
                          e.target.value === "custom" ? "" : e.target.value,
                      });
                    }}
                  >
                    <option value="">Prefer not to say</option>
                    <option>Woman</option>
                    <option>Man</option>
                    <option>Non-binary</option>
                    <option value="custom">Self-describe</option>
                  </select>
                </label>
              </div>
              {customGender && (
                <label>
                  How would you describe your gender?
                  <input
                    maxLength={60}
                    value={answers.gender}
                    onChange={(e) =>
                      setAnswers({ ...answers, gender: e.target.value })
                    }
                  />
                </label>
              )}
              <p className="welcome-field-note">
                Your display name is used in this workspace. You control what
                you add to your community profile. Age and gender are optional,
                private, and excluded from AI requests.
              </p>
              <div className="welcome-actions">
                <span>Change these answers later from Help.</span>
                <button
                  className="btn primary"
                  type="submit"
                  disabled={pending}
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </form>
          ) : step === 1 ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                advance();
              }}
            >
              <fieldset className="study-methods">
                <legend>My preferred learning style</legend>
                {styleLabels.map((style, i) => (
                  <label
                    className={
                      answers.style === studyStyles[i] ? "selected" : ""
                    }
                    key={style.title}
                  >
                    <input
                      type="radio"
                      name="study-style"
                      checked={answers.style === studyStyles[i]}
                      onChange={() =>
                        setAnswers({ ...answers, style: studyStyles[i] })
                      }
                    />
                    <span>
                      <style.icon size={21} />
                    </span>
                    <div>
                      <b>{style.title}</b>
                      <small>{style.detail}</small>
                    </div>
                    <i>
                      {answers.style === studyStyles[i] && <Check size={14} />}
                    </i>
                  </label>
                ))}
              </fieldset>
              <label>
                Time for a typical study session
                <select
                  value={answers.minutes}
                  onChange={(e) =>
                    setAnswers({ ...answers, minutes: Number(e.target.value) })
                  }
                >
                  {[
                    ...new Set([
                      answers.minutes,
                      5,
                      10,
                      15,
                      20,
                      25,
                      30,
                      45,
                      60,
                      90,
                      120,
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} minutes
                      </option>
                    ))}
                </select>
              </label>
              <p className="welcome-field-note">
                The coach can use your study interests, style, and time budget
                when personalization is enabled. You can turn it off in
                Settings.
              </p>
              <div className="welcome-actions">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setStep(0)}
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={pending}
                >
                  Find starter skills <Compass size={15} />
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="welcome-skill-grid">
                {recommendations.map(({ skill, score }, index) => (
                  <button
                    key={skill.id}
                    className={`welcome-skill ${selected === skill.id ? "selected" : ""}`}
                    aria-pressed={selected === skill.id}
                    onClick={() => {
                      setSelected(skill.id);
                      if (!p.goal)
                        setGoal(
                          `Learn ${skill.title.toLowerCase()} through practical work.`,
                        );
                    }}
                  >
                    <div>
                      <span className="welcome-skill-icon">
                        <Layers3 size={21} />
                      </span>
                      <i>{selected === skill.id && <Check size={15} />}</i>
                    </div>
                    <small>
                      {skill.category}
                      {score > 0 && index < 2 ? " · Suggested for you" : ""}
                    </small>
                    <h3>{skill.title}</h3>
                    <p>{skill.summary}</p>
                    <span>
                      {skill.sections.length} sections ·{" "}
                      {modulesOf(skill).length} modules
                    </span>
                  </button>
                ))}
              </div>
              {division && (
                <section className="welcome-selection">
                  <div className="welcome-selected-head">
                    <Flag size={20} />
                    <div>
                      <h3>{division.title}</h3>
                      <p>You'll start with “{modulesOf(division)[0].title}”.</p>
                    </div>
                  </div>
                  <ol>
                    {division.sections.map((section, i) => (
                      <li key={section.id}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <b>{section.title}</b>
                        <small>{section.modules.length} modules</small>
                      </li>
                    ))}
                  </ol>
                  <div className="welcome-two">
                    <label>
                      Days per week
                      <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option value={n} key={n}>
                            {n} days
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="welcome-pace">
                      <Clock3 size={17} />
                      <span>
                        {answers.minutes} minutes per study day
                        <small>Adjust your pace whenever you need.</small>
                      </span>
                    </div>
                  </div>
                  <label>
                    My first learning goal
                    <textarea
                      value={goal}
                      maxLength={400}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                  </label>
                  <p className="welcome-field-note">
                    Your own enrolled copy is editable. Practice and reflections
                    record progress; time estimates aren't deadlines.
                  </p>
                </section>
              )}
              <div className="welcome-actions">
                <button className="text-link" onClick={() => setStep(1)}>
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  className="btn primary"
                  disabled={pending || !selected || goal.trim().length < 3}
                  onClick={async () => {
                    if (!division) {
                      setLocalError("Choose a starter skill.");
                      return;
                    }
                    if (
                      await save(
                        {
                          type: "welcome.finish",
                          value: answers,
                          divisionId: division.id,
                          goal,
                          days,
                        },
                        "Your first skill is ready. Let's look around.",
                      )
                    )
                      done();
                  }}
                >
                  Enroll & take a quick tour <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
          {(error || localError) && (
            <p className="form-error" role="alert">
              {localError || error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export function WelcomeTour({
  data,
  save,
  error,
  dismiss,
  navigate,
}: {
  data: WorkspaceData;
  save: Save;
  pending: boolean;
  error: string;
  dismiss: () => void;
  navigate: (view: TourView, focus?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    nav = useRef(navigate);
  nav.current = navigate;
  const [localStep, setLocalStep] = useState(data.personal.tour.step);
  const saves = useRef(Promise.resolve(true));
  const saveRevision = useRef(0);
  const persist = (
    status: "active" | "completed" | "skipped",
    index: number,
  ) => {
    const revision = ++saveRevision.current;
    saves.current = saves.current.then(() =>
      revision === saveRevision.current
        ? save({ type: "tour.progress", status, step: index })
        : true,
    );
    return saves.current;
  };
  const step = Math.max(0, Math.min(tourSteps.length - 1, localStep)),
    guide = tourSteps[step];
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLButtonElement>(".tour-actions .btn")
      ?.focus();
    return () => {
      ref.current?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const title =
      guide.target === "module" ? data.personal.journeys[0]?.title : undefined;
    nav.current(guide.view, title);
    const measure = () => {
      const target =
        document.querySelector(`[data-tour="${guide.target}"]`) ||
        document.querySelector("#main .page-heading");
      if (!target) return;
      const r = target.getBoundingClientRect();
      const left = Math.max(10, r.left - 7),
        top = Math.max(10, r.top - 7);
      const next = {
        left,
        top,
        width: Math.min(r.width + 14, innerWidth - left - 10),
        height: Math.min(r.height + 14, innerHeight - top - 14),
      };
      setRect((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] ===
            next[key as keyof typeof next],
        )
          ? previous
          : next,
      );
    };
    let frame = 0;
    const scheduleMeasure = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    scheduleMeasure();
    const main = document.getElementById("main"),
      observer = new MutationObserver(scheduleMeasure);
    if (main) observer.observe(main, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [step]);
  const move = (index: number) => {
    setLocalStep(index);
    persist("active", index);
  };
  const skip = async () => {
    dismiss();
    await persist("skipped", step);
  };
  return (
    <dialog
      ref={ref}
      className="welcome-tour"
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
      onCancel={(e) => {
        e.preventDefault();
        skip();
      }}
    >
      {rect && (
        <div className="tour-spotlight" style={rect} aria-hidden="true" />
      )}
      <section className="tour-card" key={step}>
        <div className="tour-card-top">
          <span>
            <Sparkles size={14} />
            SKILLSWAP QUICK TOUR
          </span>
          <button
            className="icon-btn"
            aria-label="Skip welcome tour"
            onClick={skip}
          >
            <X size={17} />
          </button>
        </div>
        <div className="tour-counter">
          {String(step + 1).padStart(2, "0")}{" "}
          <span>/ {String(tourSteps.length).padStart(2, "0")}</span>
        </div>
        <h2 id="tour-title">{guide.title}</h2>
        <p id="tour-description">{guide.text}</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div
          className="tour-dots"
          aria-label={`Step ${step + 1} of ${tourSteps.length}`}
        >
          {tourSteps.map((s, i) => (
            <i
              key={s.target}
              className={i === step ? "active" : i < step ? "done" : ""}
            />
          ))}
        </div>
        <div className="tour-actions">
          <button
            className="text-link"
            onClick={step ? () => move(step - 1) : skip}
          >
            {step ? (
              <>
                <ArrowLeft size={13} />
                Back
              </>
            ) : (
              "Skip tour"
            )}
          </button>
          <button
            autoFocus
            className="btn primary"
            onClick={
              step === tourSteps.length - 1
                ? () => {
                    dismiss();
                    persist("completed", step);
                  }
                : () => move(step + 1)
            }
          >
            {step === tourSteps.length - 1 ? "Start learning" : "Next"}
            {step === tourSteps.length - 1 ? (
              <Check size={14} />
            ) : (
              <ArrowRight size={14} />
            )}
          </button>
        </div>
      </section>
    </dialog>
  );
}

export function HelpContact({
  tour,
  personalize,
}: {
  tour: () => void;
  personalize: () => void;
}) {
  return (
    <section className="help-contact">
      <span className="eyebrow">A LITTLE SUPPORT, WHEN YOU NEED IT</span>
      <h3>Contact me</h3>
      <p>
        Have a question, found a problem, or need help getting started? Choose
        how you'd like to reach the creator.
      </p>
      <div className="help-contact-links">
        <a href={supportLinks.email}>
          <MessageCircle size={17} />
          <span>
            Email me<small>{supportEmail}</small>
          </span>
          <ArrowRight size={14} />
        </a>
        <a
          href={supportLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} />
          <span>
            Chat on WhatsApp<small>+91 76790 27976</small>
          </span>
          <ArrowRight size={14} />
        </a>
      </div>
      <small className="support-note">
        These open your email or WhatsApp app. You review and send the message
        yourself.
      </small>
      <div className="help-welcome-actions">
        <button className="btn secondary" onClick={tour}>
          <Play size={14} />
          Replay welcome tour
        </button>
        <button className="text-link" onClick={personalize}>
          Update personalization <GraduationCap size={14} />
        </button>
      </div>
    </section>
  );
}
