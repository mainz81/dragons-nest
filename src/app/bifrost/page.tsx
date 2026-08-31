import type { Metadata } from "next";
import BifrostClient from "./BifrostClient";

export const metadata: Metadata = {
  title: "BIFRÖST — MAINLAND MYTHOS",
  description: "The scholarly acquisition bridge of MAINLAND MYTHOS.",
  icons: {
    icon: "/bifrost-download.svg",
    shortcut: "/bifrost-download.svg",
    apple: "/bifrost-download.svg"
  }
};

export default function BifrostPage() {
  return <BifrostClient />;
}
