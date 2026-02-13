import type { PropsWithChildren } from "react";
import clsx from "clsx";

export function Card(props: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border bg-panel/60 p-4 shadow-sm backdrop-blur",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}
