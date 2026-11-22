import { Check, LockKeyhole, Play } from "lucide-react";
import { modulesOf, type Enrollment } from "@/lib/skill-paths";
import type { CheckpointAttempt } from "@/lib/checkpoints";

export default function SkillMap({
  journey,
  active,
  choose,
  attempts = [],
}: {
  journey: Enrollment;
  active: string;
  choose: (id: string) => void;
  attempts?: CheckpointAttempt[];
}) {
  const modules = modulesOf(journey);
  const next = modules.find((module) => !journey.completed.includes(module.id));
  return (
    <nav className="skill-map" aria-label="Skill map">
      <h3>Skill map</h3>
      <p>
        {journey.completed.length} of {modules.length} checkpoints completed
      </p>
      <div
        className="skill-map-progress"
        role="progressbar"
        aria-label="Skill progress"
        aria-valuenow={journey.completed.length}
        aria-valuemin={0}
        aria-valuemax={modules.length}
      >
        <span
          style={{
            width: `${modules.length ? (journey.completed.length / modules.length) * 100 : 0}%`,
          }}
        />
      </div>
      {next && (
        <p>
          Next checkpoint: <strong>{next.title}</strong>
        </p>
      )}
      {journey.sections.map((section) => (
        <section key={section.id}>
          <h4>
            {section.title}
            <span className="skill-map-section-count">
              {
                section.modules.filter((m) => journey.completed.includes(m.id))
                  .length
              }
              /{section.modules.length}
            </span>
          </h4>
          <ol>
            {section.modules.map((module) => {
              const done = journey.completed.includes(module.id);
              const lastCheck = attempts.filter((attempt) => attempt.moduleId === module.id).at(-1);
              const status = done
                ? "Completed"
                : module.id === next?.id
                  ? "Ready to practice"
                  : "Prerequisite required";
              const icon = done ? (
                <Check size={15} />
              ) : module.id === next?.id ? (
                <Play size={15} />
              ) : (
                <LockKeyhole size={15} />
              );
              return (
                <li
                  key={module.id}
                  data-complete={done}
                  data-ready={module.id === next?.id}
                >
                  <button
                    className={active === module.id ? "active" : ""}
                    aria-current={active === module.id ? "step" : undefined}
                    onClick={() => choose(module.id)}
                  >
                    <span className="skill-map-node">{icon}</span>
                    <span>
                      <strong>{module.title}</strong>
                      <small>
                        {status} · {module.minutes} min
                      </small>
                      {lastCheck && <small className="skill-map-check" data-correct={lastCheck.correct}>
                        {lastCheck.correct ? "Learning check passed" : "Practice recommended"}
                      </small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </nav>
  );
}
