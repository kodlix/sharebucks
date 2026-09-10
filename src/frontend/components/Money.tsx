import { cn } from "@/lib/utils";
import { formatMoney } from "../lib/money";

export function Money({
  amount,
  currency,
  signed,
  colored,
  className,
}: {
  amount: number;
  currency: string;
  signed?: boolean;
  colored?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        colored && amount > 0 && "text-positive",
        colored && amount < 0 && "text-negative",
        colored && amount === 0 && "text-muted-foreground",
        className,
      )}
    >
      {formatMoney(amount, currency, { signed })}
    </span>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_HUES = [155, 200, 30, 280, 340, 90, 240, 15];
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const hue = AVATAR_HUES[Math.abs(h) % AVATAR_HUES.length];
  const sz = size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", sz, className)}
      style={{ backgroundColor: `oklch(0.9 0.06 ${hue})`, color: `oklch(0.35 0.1 ${hue})` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
