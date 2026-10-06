import { Fragment } from "react";
import { parseInline, parseLegalMarkup } from "@/lib/legal/markup";
import { blogHeadings } from "@/lib/blog/blog";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.type === "bold" ? (
          <strong key={index} className="font-semibold text-ink-heading">
            {part.text}
          </strong>
        ) : part.type === "link" ? (
          <a
            key={index}
            href={part.href}
            className="font-medium text-ink-accent underline underline-offset-2 hover:text-accent-on-light"
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
 * A blog article body (Legal Pages text format) with article typography:
 * `## headings` become h2s with anchor ids matching blogHeadings() for the
 * table of contents. Used by /blog/[slug] and the Admin editor preview.
 */
export function BlogArticleBody({ body }: { body: string }) {
  const headings = blogHeadings(body);
  let headingIndex = 0;
  return (
    <div className="flex flex-col gap-5 text-[16px] leading-[1.8] text-ink-secondary">
      {parseLegalMarkup(body).map((block, index) => {
        if (block.type === "heading") {
          const id = headings[headingIndex++]?.id;
          return (
            <h2 key={index} id={id} className="mt-4 scroll-mt-28 text-2xl font-semibold tracking-tight text-ink-heading">
              {block.text}
            </h2>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={index} className="text-justify hyphens-auto">
              <Inline text={block.text} />
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="flex list-disc flex-col gap-2 pl-6 marker:text-ink-accent">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
}
