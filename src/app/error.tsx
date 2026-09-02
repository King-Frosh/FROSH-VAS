"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Segment-level error boundary: a crash on one page shows a branded,
 * recoverable card instead of Next's full-screen black failure page.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6 shadow-xl shadow-ink-900/10 animate-[rise_.25s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-amber-50 p-2.5 text-amber-600">
          <AlertTriangle size={18} strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink-900">
            This view failed to render
          </h2>
          <p className="text-xs text-mute">The rest of the console is unaffected.</p>
        </div>
      </div>
      <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-paper px-3 py-2 font-mono text-[11px] leading-relaxed text-red-700">
        {`${error.name}: ${error.message}`}
      </pre>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="md" icon={RotateCcw} onClick={reset}>
          Try again
        </Button>
        <Button size="md" icon={RefreshCw} onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}
