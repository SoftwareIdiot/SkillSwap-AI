import type { WorkspaceData } from "./workspace";

const keywords: Record<string, string[]> = {
  Programming: ["html", "javascript", "python", "programming"],
  Testing: ["test", "debug", "testing"],
  "Web interfaces": ["html", "css", "responsive", "accessibility"],
  "Data interpretation": [
    "interpret",
    "summarize",
    "visualization",
    "findings",
  ],
  "User research": ["interview", "research", "usability"],
  "UI design": ["layout", "visual", "interface"],
  Prototyping: ["prototype", "prototyping", "wireframe"],
  Networking: ["network", "dns", "tcp", "routing"],
  "Security fundamentals": ["authentication", "security", "permissions"],
  "Incident analysis": ["incident", "logs", "triage"],
  "Clear writing": ["editing", "writing", "revision"],
  Presentation: ["present", "presentation", "speaking"],
};

export function careerEvidence(data: WorkspaceData, skills: string[]) {
  const completed = data.personal.journeys.flatMap((journey) =>
    journey.sections.flatMap((section) =>
      section.modules
        .filter((module) => journey.completed.includes(module.id))
        .map((module) => ({
          title: module.title,
          searchable: `${module.title} ${section.title}`,
        })),
    ),
  );
  return skills.map((skill) => ({
    skill,
    title: completed.find((module) => {
      const words: string[] =
        module.searchable.toLowerCase().match(/[a-z0-9]+/g) ?? [];
      return (keywords[skill] ?? [skill.toLowerCase()]).some((term) =>
        words.includes(term),
      );
    })?.title,
  }));
}
