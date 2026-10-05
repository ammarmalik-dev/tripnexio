import type { ReactNode } from "react";

/** Service pages use justified paragraph text (client correction 2026-10-05, see globals.css). */
export default function ServicesLayout({ children }: { children: ReactNode }) {
  return <div className="tn-justify">{children}</div>;
}
