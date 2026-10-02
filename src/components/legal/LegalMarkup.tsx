import { Fragment, type ReactNode } from "react";
import { parseInline, parseLegalMarkup } from "@/lib/legal/markup";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.type === "bold" ? (
          <strong key={index} className="font-semibold text-ink-primary">
            {part.text}
          </strong>
        ) : part.type === "link" ? (
          <a
            key={index}
            href={part.href}
            className="text-ink-accent underline underline-offset-2 hover:text-accent-on-light"
            {...(part.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        )
      )}
    </>
  );
}

/**
 * Renders a legal/About page body (src/lib/legal/markup.ts) as headed
 * sections with even spacing. `tokens` fills paragraphs that are exactly
 * "{{name}}"; an unknown token renders nothing. Used by the public pages and
 * the Admin preview, so both look the same.
 */
export function LegalMarkup({ body, tokens = {} }: { body: string; tokens?: Record<string, ReactNode> }) {
  const blocks = parseLegalMarkup(body);
  const sections: { heading: string | null; blocks: typeof blocks }[] = [];
  for (const block of blocks) {
    if (block.type === "heading" || sections.length === 0) sections.push({ heading: block.type === "heading" ? block.text : null, blocks: [] });
    if (block.type !== "heading") sections[sections.length - 1].blocks.push(block);
  }

  return (
    <div className="flex flex-col gap-7">
      {sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className="flex flex-col gap-3">
          {section.heading ? <h2 className="text-lg font-semibold text-ink-heading">{section.heading}</h2> : null}
          {section.blocks.map((block, index) => {
            if (block.type === "paragraph") {
              return (
                <p key={index} className="text-sm leading-relaxed text-ink-secondary sm:text-[15px]">
                  <Inline text={block.text} />
                </p>
              );
            }
            if (block.type === "list") {
              return (
                <ul key={index} className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-secondary marker:text-ink-tertiary sm:text-[15px]">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ul>
              );
            }
            if (block.type === "token") return <Fragment key={index}>{tokens[block.name] ?? null}</Fragment>;
            return null;
          })}
        </section>
      ))}
    </div>
  );
}
