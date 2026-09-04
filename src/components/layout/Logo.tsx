import Image from "next/image";
import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={className}
      aria-label="TripNexio home"
    >
      <span className="flex items-center gap-2.5">
        <Image
          src="/brand/tripnexio-symbol-dark.svg"
          alt=""
          width={28}
          height={28}
          priority
        />
        <span className="text-lg font-semibold tracking-tight text-ink-primary">
          TripNexio
        </span>
      </span>
    </Link>
  );
}
