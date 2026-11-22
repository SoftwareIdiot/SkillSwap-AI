"use client";

import { useEffect, useRef, useState } from "react";
import { studyQuizSchema, type StudyQuiz } from "@/lib/study-quiz";

export default function TaskQuiz({
  topic,
  close,
  save,
}: {
  topic: string;
  close: () => void;
  save: (score: number) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [quiz, setQuiz] = useState<StudyQuiz>();
  const [answers, setAnswers] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "task-quiz", prompt: topic }),
          signal: abort.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Quiz unavailable.");
        const parsed = studyQuizSchema.parse(payload.quiz);
        if (!abort.signal.aborted) setQuiz(parsed);
      } catch (cause) {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Quiz unavailable.",
          );
      }
    })();
    return () => abort.abort();
  }, [topic, attempt]);

  const question = quiz?.questions[answers.length];
  const score =
    quiz?.questions.filter((item, i) => item.correct === answers[i]).length ??
    0;
  return (
    <dialog
      ref={dialog}
      className="study-quiz-dialog"
      aria-labelledby="study-quiz-title"
      onClose={close}
    >
      <header>
        <h2 id="study-quiz-title">Post-focus quiz</h2>
        <button
          className="btn secondary"
          onClick={() => dialog.current?.close()}
        >
          Close quiz
        </button>
      </header>
      <p>{topic}</p>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="btn secondary"
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Retry quiz
          </button>
        </>
      )}
      {!quiz && !error && <p role="status">Preparing three questions?</p>}
      {question && (
        <fieldset key={answers.length}>
          <legend>Question {answers.length + 1} of 3</legend>
          <p>{question.prompt}</p>
          {question.choices.map((choice, i) => (
            <button
              key={choice}
              className="btn secondary"
              onClick={() => setAnswers([...answers, i])}
            >
              {choice}
            </button>
          ))}
        </fieldset>
      )}
      {quiz && !question && (
        <>
          <h3>{score} of 3 correct</h3>
          {saveError && <p role="alert">{saveError}</p>}
          <ol className="study-quiz-results">
            {quiz.questions.map((item, i) => (
              <li key={i}>
                <strong>{item.prompt}</strong>
                <p>Your answer: {item.choices[answers[i]]}</p>
                <p>Correct answer: {item.choices[item.correct]}</p>
                <p>{item.explanation}</p>
              </li>
            ))}
          </ol>
          <button
            className="btn primary"
            disabled={saving || saved}
            onClick={async () => {
              setSaving(true);
              try {
                setSaveError("");
              const success = await save(score);
              setSaved(success);
              if (!success) setSaveError("Could not save the result. Try again.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saved
              ? "Saved to learning memory"
              : saving
                ? "Saving?"
                : "Save result to learning memory"}
          </button>
        </>
      )}
    </dialog>
  );
}
