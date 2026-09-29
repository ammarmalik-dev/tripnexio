import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";

/** P20 — branded loading state while a public route streams in. */
export default function Loading() {
  return (
    <Container className="flex flex-col gap-6 py-16 sm:py-24" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-3/4 max-w-xl" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Container>
  );
}
