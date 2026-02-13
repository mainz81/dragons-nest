import type { PropsWithChildren } from "react";

export function LinkOut({ href, children }: PropsWithChildren<{ href: string }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-white/20 underline-offset-4 hover:decoration-white/50"
    >
      {children}
    </a>
  );
}
