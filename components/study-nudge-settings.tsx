"use client";

import { useEffect, useState } from "react";
import type { Operation, Personal } from "@/lib/workspace";

export default function StudyNudgeSettings({
  value,
  mutate,
  pending,
}: {
  value: Personal["studyNudges"];
  mutate: (operation: Operation, message?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const [channel, setChannel] = useState(value.channel);
  const [phone, setPhone] = useState(value.phone);
  const [preview, setPreview] = useState<{
    topic: string;
    fact: string;
    question: string;
    answer: string;
  }>();
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  async function generatePreview() {
    setLoading(true);
    setPreview(undefined);
    setPreviewError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "nudge-preview",
          prompt: "Preview my study message",
        }),
      });
      const message = await response.json();
      if (!response.ok)
        throw new Error(message.error || "Could not generate the preview.");
      setPreview(message);
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Could not generate the preview.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setChannel(value.channel);
    setPhone(value.phone);
  }, [value.channel, value.phone]);

  return (
    <section className="panel study-nudge-settings">
      <h2>Study messages</h2>
      <p>
        Get a fact and a recall question based on your next skill checkpoint.
        Messages arrive up to once a week when delivery is available.
      </p>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate(
            {
              type: "nudges.settings",
              value: {
                channel,
                phone: channel === "whatsapp" ? phone.trim() : "",
              },
            },
            "Study message preference saved",
          );
        }}
      >
        <label>
          Delivery
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as typeof channel)
            }
          >
            <option value="off">Off</option>
            <option value="email">Verified account email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        {channel === "whatsapp" && (
          <>
            <label>
              Your WhatsApp number with country code
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+919876543210"
                pattern="[+][1-9][0-9]{7,14}"
                required
              />
            </label>
            <label>
              <input
                key={phone}
                type="checkbox"
                required
                defaultChecked={
                  value.channel === "whatsapp" && phone === value.phone
                }
              />{" "}
              I own this number and agree to receive SkillSwap study messages
              here.
            </label>
          </>
        )}
        <button className="btn secondary" disabled={pending}>
          Save study message preference
        </button>
      </form>
      <button
        className="btn secondary"
        type="button"
        onClick={generatePreview}
        disabled={loading}
      >
        {loading ? "Preparing preview?" : "Preview a study message"}
      </button>
      {previewError && <p role="alert">{previewError}</p>}
      {preview && (
        <article>
          <h3>{preview.topic}</h3>
          <p>{preview.fact}</p>
          <p>
            <strong>Try this</strong> ? {preview.question}
          </p>
          <details>
            <summary>Reveal answer</summary>
            <p>{preview.answer}</p>
          </details>
        </article>
      )}
    </section>
  );
}
