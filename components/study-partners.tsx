"use client";

import { useState } from "react";
import { ArrowRight, Handshake, Plus } from "lucide-react";
import {
  matchScore,
  type Operation,
  type Skill,
  type WorkspaceData,
} from "@/lib/workspace";
import "./study-circle.css";

export default function StudyPartners({
  data,
  connected,
  pending,
  add,
  invite,
  remove,
  mutate,
}: {
  data: WorkspaceData;
  connected: boolean;
  pending: boolean;
  add: () => void;
  invite: (skill: Skill) => void;
  remove: (id: string) => void;
  mutate: (operation: Operation, message?: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"teach" | "learn">("teach");
  const names = new Map(
    data.people.map((person) => [
      person.id,
      person.full_name || person.username,
    ]),
  );
  const mine = data.skills.filter((skill) => skill.student_id === data.userId);
  const teaching = mine.some((skill) => skill.kind === "teach");
  const keyword = query.trim().toLowerCase();
  const results = data.skills
    .filter(
      (skill) =>
        skill.student_id !== data.userId &&
        skill.kind === filter &&
        `${skill.name} ${names.get(skill.student_id) || ""}`
          .toLowerCase()
          .includes(keyword),
    )
    .map((skill) => ({
      skill,
      score: filter === "teach" ? matchScore(skill, data) : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  return (
    <div className="study-partners">
      <section className="panel circle-intro">
        <div>
          <span className="eyebrow">STUDY CIRCLE</span>
          <h2>Find someone to learn with</h2>
          <p>
            List what you can teach or want to learn. Find people whose skills
            complement yours.
          </p>
        </div>
        <button className="btn primary" type="button" onClick={add}>
          <Plus size={16} /> List a skill
        </button>
      </section>
      {!connected && (
        <p className="muted">Sign in to find partners and send invitations.</p>
      )}
      <section className="panel circle-own-skills">
        <h2>Your skill listings</h2>
        {mine.length ? (
          <ul>
            {mine.map((skill) => (
              <li key={skill.id}>
                <b>{skill.name}</b>
                <span className="badge">
                  {skill.kind === "teach" ? "Can teach" : "Want to learn"} ·{" "}
                  {skill.level}
                </span>
                <button
                  className="text-link"
                  onClick={() => remove(skill.id)}
                  disabled={pending}
                  aria-label={`Remove ${skill.name} listing`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            List a skill to improve your partner suggestions.
          </p>
        )}
      </section>
      {connected && (
        <>
          <section className="circle-directory">
            <header className="circle-section-heading">
              <h2>Partner directory</h2>
              <input
                type="search"
                aria-label="Search skills or learners"
                placeholder="Search skills or learners…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </header>
            <div className="tabs" role="group" aria-label="Listing type">
              {(
                [
                  ["teach", "Can teach"],
                  ["learn", "Want to learn"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!teaching && filter === "teach" && (
              <p className="muted">
                List a skill you can teach to send an exchange invitation.
              </p>
            )}
            <div className="community-directory">
              {results.map(({ skill, score }) => {
                const waiting = data.exchanges.some(
                  (exchange) =>
                    exchange.sender_id === data.userId &&
                    exchange.receiver_id === skill.student_id &&
                    exchange.skill_name === skill.name &&
                    exchange.status === "pending",
                );
                return (
                  <article
                    key={skill.id}
                    className="panel community-list-card circle-partner"
                  >
                    <Handshake size={20} className="mint-text" />
                    <h3>{skill.name}</h3>
                    <p>{names.get(skill.student_id) || "Learner"}</p>
                    <span className="badge">
                      {skill.level}
                      {score === 3
                        ? " · Mutual match"
                        : score === 2
                          ? " · Skill you want"
                          : ""}
                    </span>
                    {filter === "teach" && (
                      <button
                        className="btn secondary"
                        onClick={() => invite(skill)}
                        disabled={pending || !teaching || waiting}
                      >
                        {waiting ? "Invitation pending" : "Invite to exchange"}{" "}
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            {!results.length && (
              <p className="panel muted">No matching learners in this view.</p>
            )}
          </section>
          <section className="panel circle-requests">
            <h2>Exchange invitations</h2>
            {!data.exchanges.length && (
              <p className="muted">
                Incoming and sent invitations will appear here.
              </p>
            )}
            {data.exchanges.map((exchange) => {
              const sent = exchange.sender_id === data.userId;
              const other = sent ? exchange.receiver_id : exchange.sender_id;
              return (
                <article className="circle-request" key={exchange.id}>
                  <div>
                    <span className="badge">
                      {sent ? "Sent" : "Received"} · {exchange.status}
                    </span>
                    <h3>
                      {exchange.skill_name} for {exchange.offering}
                    </h3>
                    <p>
                      {sent ? "To" : "From"} {names.get(other) || "Learner"}
                    </p>
                    <p className="exchange-plan">{exchange.message}</p>
                  </div>
                  {exchange.status === "accepted" && (
                    <details>
                      <summary>Finish this exchange</summary>
                      <ol>
                        <li>
                          Agree on one small deliverable from your session plan.
                        </li>
                        <li>
                          Take turns teaching, then try the task without help.
                        </li>
                        <li>
                          Review the result together and record what you
                          learned.
                        </li>
                      </ol>
                      <form
                        className="form-stack"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const form = event.currentTarget;
                          const note = String(
                            new FormData(form).get("note") ?? "",
                          );
                          if (
                            await mutate(
                              {
                                type: "memory.add",
                                value: {
                                  id: crypto.randomUUID(),
                                  title: `Skill exchange: ${exchange.skill_name}`,
                                  note,
                                  source: "exchange",
                                },
                              },
                              "Exchange reflection saved",
                            )
                          )
                            form.reset();
                        }}
                      >
                        <label>
                          What did you make or learn?
                          <textarea
                            name="note"
                            required
                            minLength={5}
                            maxLength={1500}
                            placeholder="Add a result, a private project link, or feedback to revisit."
                          />
                        </label>
                        <button className="btn secondary" disabled={pending}>
                          Save private reflection
                        </button>
                      </form>
                    </details>
                  )}
                  {exchange.status === "pending" && (
                    <div className="button-row">
                      {(sent
                        ? (["cancelled"] as const)
                        : (["accepted", "declined"] as const)
                      ).map((status) => (
                        <button
                          key={status}
                          className={`btn ${status === "accepted" ? "primary" : "secondary"}`}
                          disabled={pending}
                          onClick={() =>
                            void mutate(
                              {
                                type: "exchange.respond",
                                id: exchange.id,
                                status,
                              },
                              `Invitation ${status}`,
                            )
                          }
                        >
                          {
                            {
                              accepted: "Accept",
                              declined: "Decline",
                              cancelled: "Cancel",
                            }[status]
                          }
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
