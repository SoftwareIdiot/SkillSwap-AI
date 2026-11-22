"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Heart,
  Layers,
  ListTodo,
  MessageCircle,
  Search,
  Sparkles,
  Sprout,
  Timer,
  TrendingUp,
  Users,
  Video,
  Waypoints,
} from "lucide-react";
import "./social-circle.css";
const spaces = [
  {
    name: "Learn",
    description: "Your skills, direction, and next step.",
    icon: BookOpen,
    items: [
      ["overview", "My learning", "Continue where you left off", BookOpen],
      ["plans", "Skill studio", "Explore and build skill maps", Waypoints],
      ["coach", "AI coach", "Think through a question", Sparkles],
      [
        "career",
        "Career explorer",
        "Connect skills to possibilities",
        TrendingUp,
      ],
    ],
  },
  {
    name: "Plan",
    description: "Make room for what matters today.",
    icon: Timer,
    items: [
      ["tasks", "Tasks", "Choose your next focus", ListTodo],
      ["habits", "Habits", "Build a daily rhythm", Sprout],
      ["journal", "Mood & journal", "A moment for yourself", Heart],
      ["pomodoro", "Focus room", "Settle into uninterrupted work", Timer],
    ],
  },
  {
    name: "Discover",
    description: "Useful material, ready to explore.",
    icon: Compass,
    items: [
      ["research", "Research desk", "Find material for a topic", Search],
      ["feed", "Learning feed", "Long lessons and community posts", Layers],
      ["clips", "Veels", "Short learning moments", Video],
    ],
  },
  {
    name: "Circle",
    description: "People to learn alongside.",
    icon: Users,
    items: [
      ["network", "Communities", "Join a shared study space", Users],
      ["people", "People", "Follow learners and build connections", Compass],
      [
        "messages",
        "Conversations",
        "Private rooms and shared progress",
        MessageCircle,
      ],
      ["partners", "Skill partners", "Find complementary skills", Waypoints],
    ],
  },
] as const;
export default function WorkspaceAtlas({
  view,
  planner,
  go,
}: {
  view: string;
  planner: string;
  go: (view: string, planner?: string) => void;
}) {
  const active = spaces.findIndex((s) =>
    s.items.some((i) => i[0] === (view === "productivity" ? planner : view)),
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const index = chosen ?? Math.max(0, active),
    space = spaces[index];
  return (
    <div className="workspace-atlas">
      <div className="atlas-spaces" aria-label="Workspaces">
        {spaces.map((s, i) => (
          <button
            key={s.name}
            aria-pressed={index === i}
            onClick={() => setChosen(i)}
          >
            <s.icon size={21} />
            <span>{s.name}</span>
            {active === i && <i aria-label="Current workspace" />}
          </button>
        ))}
      </div>
      <div className="atlas-destinations">
        <span className="eyebrow">
          {space.name.toUpperCase()} / YOUR WORKSPACE
        </span>
        <h2>{space.description}</h2>
        <nav aria-label={space.name}>
          {space.items.map(([id, label, description, Icon]) => (
            <button
              key={id}
              aria-current={
                (view === "productivity" ? planner : view) === id
                  ? "page"
                  : undefined
              }
              onClick={() => {
                go(
                  space.name === "Plan" ? "productivity" : id,
                  space.name === "Plan" ? id : undefined,
                );
                setChosen(null);
              }}
            >
              <Icon size={18} />
              <span>
                <b>{label}</b>
                <small>{description}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </nav>
        <p className="atlas-footnote">
          One workspace. Room for your next idea.
        </p>
      </div>
    </div>
  );
}
