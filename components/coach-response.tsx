import { Fragment } from "react";
function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : part.startsWith("`") && part.endsWith("`") ? (
            <code key={i}>{part.slice(1, -1)}</code>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
    </>
  );
}
// Render a deliberately small Markdown subset as React text; never inject model HTML.
export default function CoachResponse({ content }: { content: string }) {
  return (
    <div className="coach-response">
      {content.split(/(```[\s\S]*?```)/g).map((chunk, index) => {
        if (chunk.startsWith("```")) {
          const code = chunk.slice(3, -3);
          const split = code.indexOf("\n");
          return (
            <pre key={index}>
              <span>
                {split >= 0 ? code.slice(0, split) || "EXAMPLE" : "EXAMPLE"}
              </span>
              <code>{split >= 0 ? code.slice(split + 1) : code}</code>
            </pre>
          );
        }
        return (
          <Fragment key={index}>
            {chunk
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((block, i) => {
                const lines = block.split("\n");
                if (lines.every((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line)))
                  return (
                    <ul key={i}>
                      {lines.map((line, n) => (
                        <li key={n}>
                          <Inline
                            text={line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "")}
                          />
                        </li>
                      ))}
                    </ul>
                  );
                if (/^#{1,4}\s/.test(block))
                  return (
                    <h4 key={i}>
                      <Inline text={block.replace(/^#{1,4}\s+/, "")} />
                    </h4>
                  );
                return (
                  <p key={i}>
                    <Inline text={block} />
                  </p>
                );
              })}
          </Fragment>
        );
      })}
    </div>
  );
}
