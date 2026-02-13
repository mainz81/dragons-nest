export function formatRelativeFromNow(msOrIso: number | string | undefined) {
  if (!msOrIso) return "";
  const ts = typeof msOrIso === "number" ? msOrIso : Date.parse(msOrIso);
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);

  const mins = Math.round(abs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ${diff >= 0 ? "ago" : "from now"}`;

  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ${diff >= 0 ? "ago" : "from now"}`;

  const days = Math.round(hrs / 24);
  return `${days}d ${diff >= 0 ? "ago" : "from now"}`;
}
