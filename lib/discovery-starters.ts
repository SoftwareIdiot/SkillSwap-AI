import type { LearningResource } from "./discovery.ts";
import { recommend } from "./recommendations.ts";
import type { WorkspaceData } from "./workspace.ts";

type Starter = LearningResource & { keywords: string };

function video(
  id: string,
  title: string,
  source: string,
  note: string,
  keywords: string,
  short = false,
): Starter {
  return {
    url: "https://www.youtube.com/" + (short ? "shorts/" : "watch?v=") + id,
    kind: "video",
    title,
    source,
    note,
    keywords,
    short,
  };
}

const clips = [
  video(
    "XNLL6j-P61A",
    "Predict a Python loop with break",
    "Learn with Yasir",
    "Work out when the loop stops before checking the answer.",
    "programming python computer science coding",
    true,
  ),
  video(
    "8-lhr5aLyU0",
    "Network traffic analysis with Wireshark",
    "Learn Cybersecurity",
    "See the basics of inspecting captured network traffic.",
    "security cybersecurity computer networking packets",
    true,
  ),
  video(
    "DBC5-ZYoGXI",
    "Python string output quiz",
    "Learn with Yasir",
    "Pause and predict the output before the reveal.",
    "programming python development coding strings",
    true,
  ),
  video(
    "pjcB5NyKN2o",
    "Getting started with Wireshark",
    "RedBlue Labs",
    "See a packet capture and start recognizing fields in the interface.",
    "security cybersecurity networking packets analysis",
    true,
  ),
  video(
    "lxs0n7SyZXQ",
    "Tools for inspecting network traffic",
    "The Linux Point",
    "Compare a few tools used in authorized network analysis labs.",
    "security cybersecurity linux networking packets computer",
    true,
  ),
];

const lessons: Starter[] = [
  video(
    "qiQR5rTSshw",
    "Computer networking: from packets to network design",
    "freeCodeCamp.org",
    "Follow a complete Network+ course and practice the concepts in a lab.",
    "security cybersecurity computer networking protocols packets linux",
  ),
  video(
    "rfscVS0vtbw",
    "Python foundations with practical exercises",
    "freeCodeCamp.org",
    "Build your first programs with variables, functions, loops, and files.",
    "python programming computer software coding",
  ),
  video(
    "W6NZfCO5SIk",
    "Start building with JavaScript",
    "Programming with Mosh",
    "Learn the language basics and try each example in your browser.",
    "javascript frontend web software coding development",
  ),
  video(
    "pQN-pnXPaVg",
    "Build your first website with HTML",
    "freeCodeCamp.org",
    "Create a real page while learning structure, links, forms, and semantic HTML.",
    "html frontend website design ui ux development",
  ),
  video(
    "OXGznpKZ_sA",
    "CSS layouts and responsive design",
    "freeCodeCamp.org",
    "Style pages with flexible layouts and follow along with the examples.",
    "css frontend design ui ux website development",
  ),
  video(
    "HXV3zeQKqGY",
    "SQL and databases from the beginning",
    "freeCodeCamp.org",
    "Write queries and practice joining, filtering, and organizing data.",
    "sql data database business analysis programming",
  ),
  video(
    "xxpc-HPKN28",
    "Statistics for understanding data",
    "freeCodeCamp.org",
    "Explore probability, distributions, and inference with worked examples.",
    "statistics math economics data research science probability business medical",
  ),
  video(
    "8mAITcNt710",
    "Explore computer science with Harvard CS50",
    "freeCodeCamp.org",
    "Work through algorithms, memory, and problem solving at your own pace.",
    "computer cse programming software algorithms security",
  ),
  video(
    "E7CwqNHn_Ns",
    "Taking notes that are useful later",
    "Crash Course",
    "Compare note-taking methods and try one in your next class.",
    "learning study notes school education",
  ),
  video(
    "jfREWvtd_DM",
    "Retrieval practice for students",
    "The Learning Scientists",
    "Practice recalling what you studied before opening your notes again.",
    "education learning exam memory study",
  ),
  video(
    "nLRL_NcnK-4",
    "Harvard CS50’s Python course",
    "freeCodeCamp",
    "Work through the university course, from functions to object-oriented programming.",
    "python software coding programming computer data",
  ),
  {
    url: "https://www.wireshark.org/docs/wsug_html_chunked/",
    kind: "article",
    title: "Wireshark user guide",
    source: "Wireshark",
    note: "Follow the official guide to capture, filter, and inspect network traffic.",
    keywords:
      "security cybersecurity computer networking protocols packets linux",
  },
  {
    url: "https://developer.mozilla.org/en-US/docs/Learn_web_development",
    kind: "article",
    title: "Learn web development",
    source: "MDN",
    note: "Work through a structured curriculum for HTML, CSS, JavaScript, and accessibility.",
    keywords:
      "frontend design software coding website development ui ux computer programming",
  },
  {
    url: "https://openstax.org/details/books/introductory-statistics-2e",
    kind: "article",
    title: "Introductory statistics",
    source: "OpenStax",
    note: "Read an open textbook with worked examples and exercises.",
    keywords:
      "statistics math economics data research science probability business",
  },
  {
    url: "https://openstax.org/details/books/anatomy-and-physiology-2e",
    kind: "article",
    title: "Anatomy and physiology",
    source: "OpenStax",
    note: "Study human anatomy and physiology with diagrams and review questions.",
    keywords:
      "medicine medical nursing biology health anatomy physiology science",
  },
];

export function starterResources(
  mode: "veels" | "feed",
  workspace?: WorkspaceData,
) {
  const items = mode === "veels" ? clips : lessons;
  const ordered = workspace?.personal.shareContext
    ? recommend(items, (item) => item.keywords, workspace)
    : items;
  return ordered.map(
    ({ keywords: _keywords, ...resource }): LearningResource => ({
      ...resource,
      starter: true,
    }),
  );
}
