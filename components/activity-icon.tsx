import { cn, isImageIcon } from "@/lib/utils";

export function ActivityIcon({
  icon,
  className,
}: {
  icon: string | null;
  className?: string;
}) {
  if (isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon as string}
        alt=""
        className={cn("inline-block h-5 w-5 shrink-0 rounded-sm object-contain align-middle", className)}
      />
    );
  }
  return <span className={className}>{icon}</span>;
}
