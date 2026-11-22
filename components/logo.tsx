export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <svg viewBox="0 0 34 40" aria-hidden="true">
        <path
          d="M21 2 7 16a6 6 0 0 0 0 8l7 7 6-6-7-7L27 4Z"
          fill="currentColor"
          opacity=".95"
        />
        <path
          d="m13 38 14-14a6 6 0 0 0 0-8l-7-7-6 6 7 7L7 36Z"
          fill="currentColor"
          opacity=".5"
        />
      </svg>
      <span>
        SkillSwap<span className="brand-ai">AI</span>
      </span>
    </span>
  );
}
