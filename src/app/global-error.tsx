"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Stethoscope } from "lucide-react";
import "./globals.css";

interface Diag {
  label: string;
  state: "wait" | "ok" | "bad";
  detail?: string;
}

const INITIAL: Diag[] = [
  { label: "App bundle", state: "wait" },
  { label: "API layer · /api/health", state: "wait" },
  { label: "Database · /api/meta", state: "wait" },
];

/**
 * Branded replacement for Next's opaque black failure screen.
 * Auto-reloads once for transient chunk/network errors (stale deployment
 * cache), otherwise shows the real error plus live layer-by-layer diagnostics.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [diags, setDiags] = useState<Diag[]>(INITIAL);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const transient = /chunk|dynamically imported|failed to fetch|loading chunk|module script|networkerror|import/i.test(
      msg,
    );
    try {
      const key = "vas.global-error.autoreload";
      if (transient && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, String(Date.now()));
        setNotice("Stale assets detected — reloading once…");
        const t = setTimeout(() => window.location.reload(), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage unavailable */
    }

    let alive = true;
    const set = (i: number, patch: Partial<Diag>) =>
      setDiags((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    set(0, { state: "ok", detail: "this recovery screen rendered from the bundle" });

    fetch("/api/health", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { db?: string; detail?: string };
        if (!alive) return;
        set(1, {
          state: r.ok ? "ok" : "bad",
          detail: r.ok
            ? j.db === "ok"
              ? "reachable · database ok"
              : `reachable · database: ${j.db ?? "unknown"}${j.detail ? ` (${j.detail})` : ""}`
            : `HTTP ${r.status}`,
        });
      })
      .catch((e: Error) => alive && set(1, { state: "bad", detail: e.message }));

    fetch("/api/meta", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          txCount?: number;
          servicesCount?: number;
        };
        if (!alive) return;
        set(2, {
          state: r.ok ? "ok" : "bad",
          detail: r.ok
            ? `${j.txCount ?? 0} settlement rows · ${j.servicesCount ?? 0} Service IDs`
            : `HTTP ${r.status} — check DATABASE_URL in Vercel env settings`,
        });
      })
      .catch((e: Error) => alive && set(2, { state: "bad", detail: e.message }));

    return () => {
      alive = false;
    };
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#060b14", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundImage:
              "radial-gradient(900px 320px at 85% -80px, rgba(18,165,119,.10), transparent 70%), linear-gradient(to right, rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.03) 1px, transparent 1px)",
            backgroundSize: "auto, 34px 34px, 34px 34px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <rect x="3" y="6" width="17" height="20" rx="2.5" fill="#0C8F63" opacity="0.9" />
                <rect x="9" y="3" width="17" height="20" rx="2.5" fill="#0E7490" opacity="0.85" />
                <rect x="12" y="7" width="11" height="2" rx="1" fill="#fff" opacity="0.9" />
                <rect x="12" y="11" width="8" height="2" rx="1" fill="#fff" opacity="0.65" />
                <rect x="12" y="15" width="10" height="2" rx="1" fill="#fff" opacity="0.45" />
              </svg>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#fff", letterSpacing: "-0.01em" }}>
                  KoboMerge
                </p>
                <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b" }}>
                  VAS Revenue Console
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 12,
                background: "rgba(255,255,255,.04)",
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#f59e0b", display: "inline-flex" }}>
                  <AlertTriangle size={20} />
                </span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
                  The console hit a wall
                </h1>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "#94a3b8" }}>
                {notice ??
                  "The page failed while starting up. Diagnostics below pinpoint which layer is unreachable — share this screen if the problem persists after a redeploy."}
              </p>

              <pre
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,.45)",
                  border: "1px solid rgba(255,255,255,.08)",
                  color: "#fca5a5",
                  fontSize: 11,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 120,
                  overflow: "auto",
                  margin: "14px 0 0",
                }}
              >
                {`${error?.name ?? "Error"}: ${error?.message ?? "unknown error"}${error?.digest ? `\ndigest: ${error.digest}` : ""}`}
              </pre>

              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    margin: "0 0 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#64748b",
                  }}
                >
                  <Stethoscope size={11} /> Live diagnostics
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {diags.map((d) => (
                    <div
                      key={d.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,.03)",
                        border: "1px solid rgba(255,255,255,.06)",
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: d.state === "ok" ? "#12a577" : d.state === "bad" ? "#dc2626" : "#64748b",
                          boxShadow: d.state === "wait" ? "0 0 0 3px rgba(100,116,139,.25)" : "none",
                        }}
                      />
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{d.label}</span>
                      <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11, textAlign: "right" }}>
                        {d.state === "wait" ? "checking…" : d.detail ?? (d.state === "ok" ? "ok" : "failed")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => window.location.assign("/")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0c8f63",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={13} /> Reload page
                </button>
                <button
                  onClick={reset}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.16)",
                    background: "transparent",
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={13} /> Retry render
                </button>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
                Still stuck after a fresh deploy? Hard-refresh (Ctrl+Shift+R) to clear cached chunks,
                then confirm <code style={{ color: "#94a3b8" }}>DATABASE_URL</code> is set in your Vercel
                project environment variables.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
