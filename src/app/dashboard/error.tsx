"use client";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border border-border bg-panel/60 p-6">
        <div className="mb-2 text-sm font-medium">Something broke.</div>
        <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-border bg-black/30 p-3 text-xs text-muted">
          {error.message}
        </pre>
        <button
          onClick={reset}
          className="rounded-xl border border-border bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
