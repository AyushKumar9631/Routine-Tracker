export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-lg italic text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
