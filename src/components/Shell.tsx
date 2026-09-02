"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Database,
  GitMerge,
  Hash,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCw,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";
import { num } from "@/lib/format";
import { refreshAll, useApi } from "@/state/filters";

const NAV: { section: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    section: "Monitor",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    section: "Operate",
    items: [
      { href: "/merge", label: "Excel merger", icon: GitMerge },
      { href: "/transactions", label: "Transactions", icon: Table2 },
    ],
  },
  {
    section: "Configure",
    items: [{ href: "/services", label: "Service registry", icon: Hash }],
  },
];

const TITLES: Record<string, { title: string; desc: string }> = {
  "/": { title: "Revenue dashboard", desc: "Gross & net VAS revenue across every merged operator file" },
  "/merge": { title: "Excel merger", desc: "Combine operator spreadsheets into one clean, de-duplicated dataset" },
  "/transactions": { title: "Transactions", desc: "Filter, inspect and export every merged row by Service ID" },
  "/services": { title: "Service registry", desc: "The uploaded Service IDs that drive filtering and revenue share" },
  "/reports": { title: "Reports", desc: "Daily, monthly and per-service summaries ready for finance" },
};

interface Meta {
  txCount: number;
  servicesCount: number;
  datasetsCount: number;
  coverage: number;
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = useApi<Meta>("/api/meta");
  const info = TITLES[pathname] ?? TITLES["/"];

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-ink-950 text-slate-300 transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <BrandMark />
          <div>
            <p className="font-display text-[15px] font-bold leading-none tracking-tight text-white">
              BRICCSMerge
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">VAS Revenue Console</p>
          </div>
          <button className="ml-auto rounded p-1 text-slate-400 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all",
                        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand-500 transition-all",
                          active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                        )}
                      />
                      <item.icon size={15} strokeWidth={2} className={active ? "text-brand-500" : "text-slate-500 group-hover:text-slate-300"} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="rounded-lg bg-white/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Database size={11} className="text-brand-500" /> Data warehouse
            </div>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">Transactions</dt>
                <dd className="num font-semibold text-white">{meta.data ? num(meta.data.txCount) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Service IDs</dt>
                <dd className="num font-semibold text-white">{meta.data ? num(meta.data.servicesCount) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Merged datasets</dt>
                <dd className="num font-semibold text-white">{meta.data ? num(meta.data.datasetsCount) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Registry coverage</dt>
                <dd className="num font-semibold text-brand-500">
                  {meta.data ? `${(meta.data.coverage * 100).toFixed(1)}%` : "—"}
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-2 px-1 text-[10px] text-slate-600">v1.0 · NGN · Postgres</p>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main column */}
      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button className="rounded p-1 text-mute hover:bg-ink-900/5 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-[17px] font-bold tracking-tight text-ink-900">{info.title}</h1>
              <p className="hidden truncate text-[11px] text-mute sm:block">{info.desc}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => {
                  refreshAll();
                  meta.reload();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-mute transition-colors hover:border-ink-900/25 hover:text-ink-900"
                title="Refresh all data"
              >
                <RefreshCw size={12} className={meta.loading ? "animate-spin" : ""} /> Refresh
              </button>
              {pathname !== "/merge" && (
                <Link
                  href="/merge"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand-600/30 transition-all hover:bg-brand-700 active:scale-[.98]"
                >
                  <Plus size={13} strokeWidth={2.5} /> New merge
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="17" height="20" rx="2.5" fill="#0C8F63" opacity="0.9" />
      <rect x="9" y="3" width="17" height="20" rx="2.5" fill="#0E7490" opacity="0.85" />
      <rect x="12" y="7" width="11" height="2" rx="1" fill="#fff" opacity="0.9" />
      <rect x="12" y="11" width="8" height="2" rx="1" fill="#fff" opacity="0.65" />
      <rect x="12" y="15" width="10" height="2" rx="1" fill="#fff" opacity="0.45" />
      <path d="M14 24h9m0 0-3-3m3 3-3 3" stroke="#12A577" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
