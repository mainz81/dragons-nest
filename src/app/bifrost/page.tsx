import type { Metadata } from "next";
import BifrostClient from "./BifrostClient";

export const metadata: Metadata = {
  title: "BIFRÖST — MAINLAND MYTHOS",
  description: "The scholarly acquisition bridge of MAINLAND MYTHOS.",
  manifest: "/bifrost.webmanifest",
  icons: {
    icon: [
      { url: "/bifrost/icon.svg", type: "image/svg+xml" },
      { url: "/bifrost-download.svg", type: "image/svg+xml" }
    ],
    shortcut: "/bifrost-download.svg",
    apple: "/bifrost-download.svg"
  }
};

export default function BifrostPage() {
  return <BifrostClient />;
}
