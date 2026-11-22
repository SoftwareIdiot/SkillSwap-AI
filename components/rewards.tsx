"use client";
import { Flame, ShieldCheck, Sparkles, Check } from "lucide-react";
import type { Personal, Operation } from "@/lib/workspace";
import { rewardItems, rewardStatus } from "@/lib/rewards";
import "./rewards.css";
export default function RewardsPanel({
  personal,
  busy,
  save,
}: {
  personal: Personal;
  busy: boolean;
  save: (op: Operation, message?: string) => Promise<boolean>;
}) {
  const r = personal.rewards;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const s = rewardStatus(personal.activity, r, new Date(), zone);
  return (
    <div className="rewards-panel">
      <div className="rewards-summary">
        <div>
          <Sparkles />
          <strong>{s.balance}</strong>
          <span>Sparks available</span>
        </div>
        <div>
          <Flame />
          <strong>{s.streak}</strong>
          <span>day learning streak</span>
        </div>
      </div>
      <section className="reward-daily">
        <div>
          <h3>
            {r.days.includes(s.today)
              ? "Today's Sparks are collected"
              : "A little learning earns 10 Sparks"}
          </h3>
          <p>
            Finish a task, module, study checkpoint, or five minutes of focus.
            One reward per day, however much you do.
          </p>
        </div>
        <button
          className="btn"
          disabled={busy || !s.eligible}
          onClick={() =>
            void save({ type: "reward.collect", zone }, "10 Sparks added.")
          }
        >
          {r.days.includes(s.today)
            ? "Collected"
            : s.eligible
              ? "Collect 10 Sparks"
              : "Learn to collect"}
        </button>
      </section>
      <section>
        <h3>Your milestones</h3>
        <div className="reward-milestones">
          {[
            [1, "First step"],
            [7, "Finding a rhythm"],
            [30, "Steady learner"],
          ].map(([n, title]) => (
            <div key={n} data-earned={r.days.length >= Number(n)}>
              <Check size={16} />
              <b>{title}</b>
              <small>
                {Math.min(r.days.length, Number(n))}/{n} rewarded days
              </small>
            </div>
          ))}
        </div>
        <p className="field-hint">
          Milestones stay earned, even if your streak ends. Your learning
          progress always stays yours.
        </p>
      </section>
      <section className="reward-save">
        <ShieldCheck />
        <div>
          <h3>Save a missed day</h3>
          <p>
            Protect yesterday for 30 Sparks if you studied the day before. A
            protected day keeps your streak but earns no Sparks.
          </p>
        </div>
        <button
          className="btn secondary"
          disabled={busy || !s.canSave || s.balance < 30}
          onClick={() =>
            void save(
              { type: "reward.buy", item: "save" },
              "Yesterday is protected.",
            )
          }
        >
          Use 30 Sparks
        </button>
      </section>
      <section>
        <h3>Make this space yours</h3>
        <div className="reward-shop">
          {Object.entries(rewardItems).map(([key, item]) => {
            const id = key as keyof typeof rewardItems,
              owned = r.owned.includes(id),
              equipped = id === "orbit" ? r.frame : r.theme === id;
            return (
              <article key={id}>
                <div className={`reward-preview reward-${id}`}>
                  <Sparkles />
                </div>
                <h4>{item.name}</h4>
                <p>{item.description}</p>
                <button
                  className="btn secondary"
                  disabled={
                    busy || equipped || (!owned && s.balance < item.cost)
                  }
                  onClick={() =>
                    void save(
                      owned
                        ? { type: "reward.equip", item: id }
                        : { type: "reward.buy", item: id },
                      owned
                        ? "Reward applied."
                        : "Reward unlocked. Apply it whenever you like.",
                    )
                  }
                >
                  {equipped
                    ? "Applied"
                    : owned
                      ? "Apply"
                      : `${item.cost} Sparks`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <div className="reward-reset">
        <button
          className="btn secondary"
          disabled={busy || r.theme === "default"}
          onClick={() => void save({ type: "reward.equip", item: "default" })}
        >
          Default background
        </button>
        <button
          className="btn secondary"
          disabled={busy || !r.frame}
          onClick={() => void save({ type: "reward.equip", item: "no-frame" })}
        >
          Remove frame
        </button>
      </div>
      <p className="field-hint">
        Your reward day follows {s.zone}. Sparks are personal learning rewards
        with no cash value. Themes respect your light or dark appearance.
        Existing profile and social features stay available.
      </p>
    </div>
  );
}
