"use client";

import { useState } from "react";
import type { Operation, WorkspaceData } from "@/lib/workspace";

export default function LearningMemory({
  data,
  mutate,
  pending,
}: {
  data: WorkspaceData;
  mutate: (operation: Operation, message?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  return (
    <section className="panel learning-memory">
      <h2>Private learning memory</h2>
      <p>
        Save insights, quiz results, or project notes. You can choose individual
        entries for AI coaching.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            await mutate(
              {
                type: "memory.add",
                value: { id: crypto.randomUUID(), title, note, source: "note" },
              },
              "Learning note saved",
            )
          ) {
            setTitle("");
            setNote("");
          }
        }}
      >
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          What did you learn?
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
            minLength={5}
            maxLength={1500}
          />
        </label>
        <button className="btn primary" disabled={pending}>
          Save learning note
        </button>
      </form>
      {data.personal.learningMemory.length === 0 && (
        <p>No saved learning notes yet.</p>
      )}
      {data.personal.learningMemory.map((entry) => (
        <article key={entry.id}>
          <div>
            <h3>{entry.title}</h3>
            <p>{entry.note}</p>
            <small>{new Date(entry.date).toLocaleDateString()}</small>
          </div>
          <label>
            <input
              type="checkbox"
              checked={entry.share}
              disabled={pending}
              onChange={(event) =>
                void mutate({
                  type: "memory.share",
                  id: entry.id,
                  share: event.target.checked,
                })
              }
            />{" "}
            Use with AI
            {!data.personal.shareContext && " when AI context sharing is on"}
          </label>
          <button
            className="btn secondary"
            disabled={pending}
            onClick={() =>
              void mutate(
                { type: "memory.delete", id: entry.id },
                "Learning note removed",
              )
            }
          >
            Remove note
          </button>
        </article>
      ))}
    </section>
  );
}
