import { cn, initials } from "@/lib/utils";

export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("grid place-items-center rounded-[10px] bg-primary text-primary-foreground", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.64} height={size * 0.64} fill="none">
        <path d="M4 7.2 8.1 17l3.9-7.4 3.9 7.4L20 7.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19.2h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".78" />
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
      className={cn("grid shrink-0 place-items-center rounded-full text-xs font-semibold text-white", className)}
      style={{ width: size, height: size, background: `hsl(${hue} 42% 38%)` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function GuildBadge({
  tag,
  size = 44,
  active,
  iconUrl,
}: {
  tag: string;
  size?: number;
  active?: boolean;
  iconUrl?: string | null;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center overflow-hidden rounded-[14px] bg-muted text-[12px] font-semibold tracking-wide transition-transform duration-150",
        active && "ring-2 ring-primary",
      )}
      style={{ width: size, height: size }}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" width={size} height={size} className="size-full object-cover" />
      ) : (
        tag
      )}
    </span>
  );
}
