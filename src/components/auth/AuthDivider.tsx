export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-xs font-medium text-ink-tertiary">or</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
