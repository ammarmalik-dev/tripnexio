"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Globe2, Search } from "lucide-react";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { SERVICE_ROUTE_INFO } from "@/lib/service-route-info";
import { cn } from "@/lib/cn";
import type { CountryPageCard } from "@/lib/new-visa/country-pages";

const RUPEE_FORMATTER = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const SEARCH_THRESHOLD = 6;

/** Destination cards on /services/new-visa. Each opens that country's page. */
export function NewVisaCountryGrid({ cards }: { cards: CountryPageCard[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? cards.filter((card) => card.countryName.toLowerCase().includes(term) || card.countryCode.toLowerCase() === term) : cards;
  }, [cards, query]);

  return (
    <div className="flex flex-col gap-8">
      {cards.length > SEARCH_THRESHOLD ? (
        <div className="relative mx-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="destination-search" className="sr-only">
            Search destinations
          </label>
          <input
            id="destination-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a country…"
            className={cn(fieldControlClass, fieldBorderClass(false), "h-12 rounded-full pl-10")}
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mx-auto max-w-md rounded-xl border border-dashed border-hairline px-6 py-10 text-center text-sm text-ink-tertiary">
          No destination matches &ldquo;{query.trim()}&rdquo;. Ask us on WhatsApp if you can&rsquo;t find your country.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((card, index) => (
            <li key={card.slug}>
              <MotionReveal delay={Math.min(index, 6) * 0.05} className="h-full">
                <Link
                  href={`/services/new-visa/${card.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                    {card.imageUrl ? (
                      <Image
                        src={card.imageUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                      />
                    ) : (
                      <Image
                        src={SERVICE_ROUTE_INFO.NEW_VISA.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute inset-x-4 bottom-3 flex items-center gap-2 text-white">
                      {card.flag ? (
                        <span className="text-2xl leading-none drop-shadow" aria-hidden="true">
                          {card.flag}
                        </span>
                      ) : (
                        <Globe2 className="h-5 w-5" aria-hidden="true" />
                      )}
                      <h3 className="text-lg font-semibold drop-shadow">{card.countryName}</h3>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {card.tagline ? <p className="text-sm text-ink-secondary">{card.tagline}</p> : null}
                    {card.processingText ? (
                      <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Processing: {card.processingText}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-col gap-3">
                      {card.fromPrice !== null ? (
                        <p className="text-sm text-ink-tertiary">
                          Starting from{" "}
                          <span className="text-lg font-semibold text-ink-heading">{RUPEE_FORMATTER.format(card.fromPrice)}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-ink-tertiary">Price on request</p>
                      )}
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[image:var(--gradient-accent)] px-4 py-2 text-sm font-semibold text-white transition-shadow duration-200 group-hover:shadow-md">
                        Apply Now
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              </MotionReveal>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
