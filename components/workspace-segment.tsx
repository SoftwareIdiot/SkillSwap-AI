"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function WorkspaceSegment({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = pinned || hovered || focused;
  return (
    <section
      className="workspace-segment"
      data-active={active || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="workspace-segment-toggle"
        aria-controls={id}
        aria-expanded={expanded}
        onClick={() => {
          if (pinned) setHovered(false);
          setPinned(!pinned);
        }}
      >
        {label}
        <ChevronDown size={14} />
      </button>
      <div
        className="workspace-segment-body"
        id={id}
        data-expanded={expanded}
        inert={!expanded}
      >
        <div
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocused(false);
          }}
        >
          <nav aria-label={label}>{children}</nav>
        </div>
      </div>
    </section>
  );
}
