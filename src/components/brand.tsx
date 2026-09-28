import { cn, initials } from "@/lib/utils";

export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("grid place-items-center rounded-[10px] bg-primary text-white", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none">
        <path
          d="M4 5.5h4.2l3.8 10.2L15.8 5.5H20L13.7 20h-3.4L4 5.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function MemberAvatar({
  name,
  hue,
  size = 36,
  className,
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 42% 38%)`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function GuildBadge({ tag, size = 44, active }: { tag: string; size?: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-[14px] bg-muted text-[12px] font-semibold tracking-wide transition-transform duration-150",
        active && "ring-2 ring-primary",
      )}
      style={{ width: size, height: size }}
    >
      {tag}
    </span>
  );
}
