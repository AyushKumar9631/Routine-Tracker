export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-card px-4 py-3">
      <p className="font-mono text-2xl text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
