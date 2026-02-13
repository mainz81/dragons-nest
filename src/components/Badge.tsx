import type { PropsWithChildren } from "react";
import clsx from "clsx";

export function Badge({
  tone = "neutral",
  children,
  className
}: PropsWithChildren<{
  tone?: "neutral" | "good" | "bad" | "warn";
  className?: string;
}>) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : tone === "bad"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : tone === "warn"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
          : "border-border bg-white/5 text-text";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        toneClass,
        className
      )}
    >
      {children}
    </span>
  );
}
