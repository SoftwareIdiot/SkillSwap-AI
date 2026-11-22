"use client";
import type { WorkspaceData } from "@/lib/workspace";
import { careerEvidence } from "@/lib/career-evidence";
import { recommend } from "@/lib/recommendations";
import { starterDivisions } from "@/lib/skill-catalog";
import { ArrowRight, Compass } from "lucide-react";
const careers = [
  {
    title: "Software developer",
    tags: "CSE computer software engineering frontend programming",
    skills: ["Programming", "Testing", "Web interfaces"],
    project: "Build and test a small accessible web application.",
    starter: "starter-web",
  },
  {
    title: "Data analyst",
    tags: "data science mathematics statistics Python SQL",
    skills: ["Python", "SQL", "Data interpretation"],
    project:
      "Answer a real question with a cleaned dataset and a clear report.",
    starter: "starter-python",
  },
  {
    title: "Product designer",
    tags: "UI design Figma research arts",
    skills: ["User research", "UI design", "Prototyping"],
    project: "Research an everyday problem and test an accessible prototype.",
    starter: "starter-design",
  },
  {
    title: "Cybersecurity analyst",
    tags: "cyber security CSE networking computer",
    skills: ["Networking", "Security fundamentals", "Incident analysis"],
    project:
      "Investigate logs from a legal practice lab and write an incident report.",
    starter: "starter-research",
  },
  {
    title: "Technical communicator",
    tags: "writing communication research teaching presentation",
    skills: ["Research", "Clear writing", "Presentation"],
    project: "Explain a difficult concept with a short guide and examples.",
    starter: "starter-speaking",
  },
];
export default function CareerExplorer({
  data,
  explore,
  coach,
  planPractice,
}: {
  data: WorkspaceData;
  explore: (title: string) => void;
  coach: (prompt: string) => void;
  planPractice: (title: string, topic: string) => void;
}) {
  return (
    <div className="career-explorer">
      <section className="panel career-intro">
        <div>
          <span className="eyebrow">
            <Compass size={14} /> CAREER DIRECTIONS
          </span>
          <h2>Find a direction worth trying</h2>
          <p>
            Explore roles based on your study programme, interests, goals, and
            enrolled skills.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() =>
            coach(
              "Compare three career directions using my programme, goals, enrolled skills, completed modules and study routine. Explain the fit, gaps, and one practical next step for each.",
            )
          }
        >
          Discuss my options with AI <ArrowRight size={15} />
        </button>
      </section>
      <div className="career-directory">
        {recommend(careers, (c) => c.tags, data).map((career, index) => {
          const starter = starterDivisions.find(
            (skill) => skill.id === career.starter,
          );
          const evidence = careerEvidence(data, career.skills);
          return (
            <article className="panel career-direction" key={career.title}>
              <span className="career-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{career.title}</h3>
                <div className="career-direction-skills">
                  {career.skills.map((skill) => (
                    <span className="badge" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="career-direction-project">
                <h4>Your learning evidence</h4>
                <ul>
                  {evidence.map(({ skill, title }) => (
                    <li key={skill}>
                      <strong>{skill}</strong> ?{" "}
                      {title
                        ? `Completed ?${title}?`
                        : "No matching completed module yet"}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="career-direction-project">
                <span className="eyebrow">PRACTICE PROJECT</span>
                <p>{career.project}</p>
              </div>
              <div className="career-direction-actions">
                {starter && (
                  <button
                    className="btn secondary"
                    onClick={() => explore(starter.title)}
                  >
                    Explore a starting skill <ArrowRight size={14} />
                  </button>
                )}
                <button
                  className="btn secondary"
                  onClick={() =>
                    planPractice(
                      `Try ${career.title}: ${career.project}`,
                      career.skills.join(", "),
                    )
                  }
                >
                  Plan practice project
                </button>
                <button
                  className="text-link"
                  onClick={() =>
                    coach(
                      `Help me evaluate ${career.title}. Compare my current learning with these skills: ${career.skills.join(", ")}. Suggest a realistic practice plan.`,
                    )
                  }
                >
                  Discuss this role with AI
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
