"use client";
import { useActionState, useState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  signIn,
  signUp,
  resetPassword,
  verifyEmail,
  resendEmail,
} from "@/app/auth/actions";
export default function AuthForm({
  configured = true,
  initialMode = "signup",
  variant = "default",
}: {
  configured?: boolean;
  initialMode?: "signup" | "login";
  variant?: "default" | "gateway";
}) {
  const passwordId = useId();
  const googleStarted = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  useEffect(() => {
    const restore = () => {
      googleStarted.current = false;
      setGooglePending(false);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  const [mode, setMode] = useState<"login" | "signup" | "reset">(initialMode),
    [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    setMode(initialMode);
    setShowPassword(false);
  }, [initialMode]);
  const [inState, inAction, inPending] = useActionState(signIn, {}),
    [upState, upAction, upPending] = useActionState(signUp, {}),
    [resetState, resetAction, resetPending] = useActionState(resetPassword, {}),
    [verifyState, verifyAction, verifyPending] = useActionState(
      verifyEmail,
      {},
    ),
    [resendState, resendAction, resendPending] = useActionState(
      resendEmail,
      {},
    );
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [resendAfter, setResendAfter] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (upState.needsVerification && upState.email) {
      setVerificationEmail(upState.email);
      setResendAfter(Date.now() + 60000);
    }
  }, [upState]);
  useEffect(() => {
    if (resendState.success) setResendAfter(Date.now() + 60000);
  }, [resendState]);
  useEffect(() => {
    if (resendAfter <= Date.now()) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((resendAfter - Date.now()) / 1000));
      setRemaining(left);
      if (!left) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [resendAfter]);
  const state =
    mode === "login" ? inState : mode === "signup" ? upState : resetState;
  const pending = inPending || upPending || resetPending;
  if (verificationEmail)
    return (
      <div
        className={`auth-card ${variant === "gateway" ? "gateway-card" : ""}`}
      >
        <div className="gateway-eyebrow">
          <ShieldCheck size={17} />
          VERIFY YOUR EMAIL
        </div>
        <h2>Check your inbox</h2>
        <p>
          Enter the verification code sent to{" "}
          <strong>{verificationEmail}</strong> to finish creating your SkillSwap
          account.
        </p>
        <form action={verifyAction}>
          <input type="hidden" name="email" value={verificationEmail} />
          <label>
            Email verification code
            <input
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              minLength={6}
              maxLength={10}
              required
              autoFocus
              placeholder="Enter your code"
            />
          </label>
          {verifyState.error && (
            <p role="alert" className="form-error">
              {verifyState.error}
            </p>
          )}
          <button
            className="btn primary full"
            disabled={verifyPending || resendPending}
          >
            {verifyPending ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            Verify & enter SkillSwap
          </button>
        </form>
        <p className="gateway-password-note">
          Check your spam folder too. Use the newest code if you request
          another.
        </p>
        <form action={resendAction}>
          <input type="hidden" name="email" value={verificationEmail} />
          <button
            className="btn secondary full"
            disabled={remaining > 0 || resendPending || verifyPending}
          >
            {resendPending
              ? "Requesting code…"
              : remaining
                ? `Resend code in ${remaining}s`
                : "Resend verification code"}
          </button>
        </form>
        {resendState.error && (
          <p role="alert" className="form-error">
            {resendState.error}
          </p>
        )}
        {resendState.success && (
          <p role="status" className="form-success">
            {resendState.success}
          </p>
        )}
        <div className="auth-bottom">
          <button
            disabled={verifyPending || resendPending}
            onClick={() => setVerificationEmail(null)}
          >
            Use another email
          </button>
          <button
            disabled={verifyPending || resendPending}
            onClick={() => {
              setVerificationEmail(null);
              setMode("login");
            }}
          >
            Already verified? Sign in
          </button>
        </div>
      </div>
    );
  return (
    <div className={`auth-card ${variant === "gateway" ? "gateway-card" : ""}`}>
      {variant === "gateway" && (
        <div className="gateway-eyebrow">
          <span>SKILLSWAP ACCOUNT</span>
          <span>✦</span>
        </div>
      )}
      <div className="segmented" role="group" aria-label="Account access">
        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          aria-pressed={mode === "signup"}
          onClick={() => setMode("signup")}
        >
          Create an account
        </button>
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          aria-pressed={mode === "login"}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
      </div>
      <h2>
        {mode === "signup"
          ? "Create a SkillSwap account"
          : mode === "login"
            ? "Sign in to SkillSwap"
            : "Reset your password"}
      </h2>
      <p>
        {mode === "signup"
          ? "Save your skills, learning plans, and study progress."
          : mode === "login"
            ? "Access your enrolled skills, planner, and profile."
            : "We’ll email you a link to reset your password."}
      </p>
      {mode !== "reset" && (
        <>
          <form
            action="/auth/google"
            method="post"
            className="google-auth-form"
            onSubmit={(event) => {
              if (googleStarted.current) {
                event.preventDefault();
                return;
              }
              googleStarted.current = true;
              setGooglePending(true);
            }}
          >
            <button
              type="submit"
              className="google-auth-button"
              disabled={googlePending || pending}
              aria-busy={googlePending}
            >
              <img
                src="/google-sign-in.svg"
                alt=""
                width={18}
                height={18}
              />
              {googlePending ? (
                <>
                  <LoaderCircle size={16} className="spin" /> Opening Google…
                </>
              ) : (
                "Continue with Google"
              )}
            </button>
          </form>
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
        </>
      )}
      <form
        action={
          mode === "signup"
            ? upAction
            : mode === "login"
              ? inAction
              : resetAction
        }
      >
        <label>
          Email address
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        {mode !== "reset" && (
          <div className="auth-password-field">
            <label htmlFor={passwordId}>Password</label>
            <span className="password-input-wrap">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={
                  mode === "signup"
                    ? "Create a strong password"
                    : "Enter your password"
                }
                minLength={8}
                maxLength={72}
                required
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </div>
        )}
        {mode === "signup" && (
          <>
            <label>
              Confirm password
              <input
                name="confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                placeholder="Enter your password again"
              />
            </label>
            <span className="gateway-password-note">
              Use at least 8 characters.
            </span>
          </>
        )}
        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="form-success" role="status">
            {state.success}
          </div>
        )}
        <button className="btn primary full" disabled={!configured || pending}>
          {pending ? <LoaderCircle size={15} className="spin" /> : null}
          {mode === "signup"
            ? "Create free account"
            : mode === "login"
              ? "Sign in to SkillSwap"
              : "Send reset link"}
          <ArrowUpRight size={16} />
        </button>
      </form>
      <div className="auth-bottom">
        {mode === "login" && (
          <button type="button" onClick={() => setMode("reset")}>
            Forgot your password?
          </button>
        )}
        {mode === "reset" && (
          <button type="button" onClick={() => setMode("login")}>
            Back to sign in
          </button>
        )}
      </div>
      {!configured ? (
        <div className="gateway-local">
          <p>
            <ShieldCheck size={14} />
            <span>
              Shared accounts aren’t connected in this preview. Your local
              learning workspace is ready.
            </span>
          </p>
          <Link href="/student" className="gateway-local-link">
            Explore on this device <ArrowUpRight size={15} />
          </Link>
        </div>
      ) : (
        <p className="gateway-free-note">
          Skill exchange, AI study tools, and your learning progress.
        </p>
      )}
    </div>
  );
}
