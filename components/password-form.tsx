"use client";
import { useActionState } from "react";
import { updatePassword } from "@/app/auth/update-password/submit";
export default function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <div className="auth-card">
      <h2>Choose a fresh password.</h2>
      <p>
        Use at least 8 characters. A longer, unique password helps protect your
        learning account.
      </p>
      <form action={action}>
        <label>
          New password
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirm password
          <input
            name="confirmation"
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
          />
        </label>
        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}
        <button className="btn primary" disabled={pending}>
          {pending ? "Updating password…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
