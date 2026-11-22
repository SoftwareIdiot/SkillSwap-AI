"use client";

import { useRef, useState } from "react";
import { ArrowRight, Clock3, MessageCircle, Sparkles } from "lucide-react";
import {
  nextCheckpointQuestion,
  type Checkpoint,
  type CheckpointAttempt,
} from "@/lib/checkpoints";

export default function CheckpointReview({
  check,
  attempts,
  pending,
  save,
  planPractice,
  askCoach,
  askPeers,
}: {
  check: Checkpoint;
  attempts: CheckpointAttempt[];
  pending: boolean;
  save: (
    id: string,
    question: number,
    choice: number,
    reasoning: string,
  ) => Promise<boolean>;
  planPractice: () => void;
  askCoach: (question: string) => void;
  askPeers?: () => void;
}) {
  const questionIndex = attempts.length;
  const question = nextCheckpointQuestion(check, attempts);
  const last = attempts.at(-1);
  const previous = last && check.questions[last.question];
  const [openQuestion, setOpenQuestion] = useState(0);
  const [choice, setChoice] = useState<number>();
  const [reasoning, setReasoning] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const submission = useRef<string | null>(null);

  return (
    <section className="checkpoint-review" aria-label="Learning check">
      <h3>Learning check</h3>
      <p className="muted">{check.concept}</p>
      {last && previous && (
        <div
          className="checkpoint-feedback"
          role="status"
          data-correct={last.correct}
        >
          <strong>
            {last.correct
              ? last.question
                ? "Follow-up correct"
                : "Checked today"
              : "Needs practice"}
          </strong>
          <p>{previous.feedback[last.choice]}</p>
          {!last.correct && (
            <p>
              <b>Try this</b> {check.practice}
            </p>
          )}
          {attempts.length > 1 && (
            <small>
              {attempts
                .map(
                  (item, i) =>
                    `${i ? `Follow-up ${i}` : "First check"} ${item.correct ? "correct" : "missed"}`,
                )
                .join(" · ")}
            </small>
          )}
        </div>
      )}
      {question && openQuestion === questionIndex ? (
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || choice === undefined) return;
            setSaveFailed(false);
            submission.current ??= crypto.randomUUID();
            if (
              await save(submission.current, questionIndex, choice, reasoning)
            ) {
              setChoice(undefined);
              setReasoning("");
              submission.current = null;
            } else setSaveFailed(true);
          }}
        >
          <fieldset>
            <legend>{question.prompt}</legend>
            {question.choices.map((answer, i) => (
              <label className="checkpoint-choice" key={answer}>
                <input
                  type="radio"
                  name="checkpoint-choice"
                  checked={choice === i}
                  onChange={() => setChoice(i)}
                  disabled={pending}
                />
                <span>{answer}</span>
              </label>
            ))}
          </fieldset>
          <label>
            How did you decide? <span className="muted">Optional</span>
            <textarea
              maxLength={600}
              rows={2}
              value={reasoning}
              onChange={(event) => setReasoning(event.target.value)}
              disabled={pending}
            />
          </label>
          <button
            className="btn primary"
            disabled={pending || choice === undefined}
          >
            Check my answer <ArrowRight size={15} />
          </button>
          {saveFailed && (
            <p role="alert">Your answer couldn’t be saved. Try again.</p>
          )}
        </form>
      ) : last && previous && !last.correct ? (
        <div className="button-row">
          {question && (
            <button
              className="btn primary"
              type="button"
              onClick={() => setOpenQuestion(questionIndex)}
            >
              Try a new question <ArrowRight size={15} />
            </button>
          )}
          <button
            className="btn secondary"
            type="button"
            onClick={planPractice}
          >
            <Clock3 size={15} /> Plan 5 minutes of practice
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              askCoach(
                `Help me understand ${check.concept}. The checkpoint asked: ${previous.prompt} I chose: ${previous.choices[last.choice]}. ${last.reasoning ? `My reasoning: ${last.reasoning}\n` : ""}Checkpoint feedback: ${previous.feedback[last.choice]} Explain why my answer didn't work, and give me one small example to try.`,
              )
            }
          >
            <Sparkles size={15} /> Ask AI coach
          </button>
          {askPeers && (
            <button className="btn secondary" type="button" onClick={askPeers}>
              <MessageCircle size={15} /> Ask Study Circle
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
