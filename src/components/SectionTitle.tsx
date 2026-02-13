import type { PropsWithChildren } from "react";

export function SectionTitle(props: PropsWithChildren) {
  return <h2 className="mb-3 text-sm font-medium text-muted">{props.children}</h2>;
}
