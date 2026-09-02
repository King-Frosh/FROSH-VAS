"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Search,
  Square,
  Undo2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- Button --------------------------------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md";
  icon?: LucideIcon;
};
export function Button({ variant = "outline", size = "sm", icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[.98]",
        size === "xs" && "px-2 py-1 text-[11px]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        variant === "primary" && "bg-brand-600 text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700",
        variant === "dark" && "bg-ink-900 text-white hover:bg-ink-800",
        variant === "outline" && "border border-line bg-white text-ink-900 hover:border-ink-900/30 hover:bg-paper",
        variant === "ghost" && "text-mute hover:bg-ink-900/5 hover:text-ink-900",
        variant === "danger" && "bg-danger-600 text-white hover:bg-red-700",
        className,
      )}
    >
      {Icon && <Icon size={size === "xs" ? 12 : 14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

/* ----------------------------------- Card ---------------------------------- */
export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-white shadow-[0_1px_2px_rgba(11,21,36,.05),0_8px_24px_-16px_rgba(11,21,36,.18)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] text-mute">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

/* ---------------------------------- Badges --------------------------------- */
const TONES: Record<string, string> = {
  green: "bg-brand-50 text-brand-700 border-brand-200",
  teal: "bg-cyan-50 text-cyan-800 border-cyan-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  gold: "bg-orange-50 text-orange-800 border-orange-200",
  ink: "bg-ink-900 text-white border-ink-900",
};
export function Badge({
  tone = "slate",
  icon: Icon,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon size={10} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

const STATUS_META: Record<string, { tone: keyof typeof TONES; icon: LucideIcon; label: string }> = {
  success: { tone: "green", icon: CheckCircle2, label: "Success" },
  failed: { tone: "red", icon: XCircle, label: "Failed" },
  pending: { tone: "amber", icon: Clock, label: "Pending" },
  refunded: { tone: "slate", icon: Undo2, label: "Refunded" },
};
export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { tone: "slate" as const, icon: Clock, label: status };
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {m.label}
    </Badge>
  );
}

/* ---------------------------------- Inputs --------------------------------- */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-ink-900 placeholder:text-mute/70 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15",
        className,
      )}
    />
  );
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cn(
        "rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink-900 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15",
        className,
      )}
    >
      {children}
    </select>
  );
}
export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full rounded-md border border-line bg-white px-2.5 py-2 font-mono text-xs text-ink-900 placeholder:text-mute/70 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15",
        className,
      )}
    />
  );
}
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-mute/80">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs text-ink-900"
    >
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------- Segmented --------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md border border-line bg-white p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-all",
            value === o.key ? "bg-ink-900 text-white shadow-sm" : "text-mute hover:bg-paper hover:text-ink-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- MultiSelect ------------------------------- */
export interface MSOption {
  value: string;
  label: string;
  hint?: string;
}
export function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  panelClass = "w-80",
  searchable = true,
}: {
  options: MSOption[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  panelClass?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()) || o.value.includes(q))
    : options;
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
          values.length
            ? "border-brand-600/40 bg-brand-50 text-brand-700"
            : "border-line bg-white text-mute hover:border-ink-900/25",
        )}
      >
        {placeholder}
        {values.length > 0 && (
          <span className="rounded bg-brand-600 px-1 text-[10px] font-bold text-white">{values.length}</span>
        )}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-40 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-xl shadow-ink-900/10",
            panelClass,
          )}
        >
          {searchable && (
            <div className="relative border-b border-line p-2">
              <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="pl-7" />
            </div>
          )}
          <div className="max-h-64 overflow-auto p-1">
            {filtered.length === 0 && <p className="p-3 text-center text-[11px] text-mute">No matches</p>}
            {filtered.map((o) => {
              const on = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-paper"
                >
                  {on ? <CheckSquare size={13} className="shrink-0 text-brand-600" /> : <Square size={13} className="shrink-0 text-slate-300" />}
                  <span className="truncate font-medium text-ink-900">{o.label}</span>
                  {o.hint && <span className="ml-auto shrink-0 font-mono text-[10px] text-mute">{o.hint}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-line bg-paper px-2 py-1.5">
            <span className="text-[10px] text-mute">{values.length} selected</span>
            <div className="flex gap-1">
              <Button size="xs" variant="ghost" onClick={() => onChange(options.map((o) => o.value))}>
                All
              </Button>
              <Button size="xs" variant="ghost" onClick={() => onChange([])}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Modal ---------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-line bg-white shadow-2xl animate-[rise_.22s_ease-out]",
          wide ? "max-w-3xl" : "max-w-md",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
            {desc && <p className="mt-0.5 text-xs text-mute">{desc}</p>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-mute hover:bg-paper hover:text-ink-900" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="max-h-[65vh] overflow-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line bg-paper px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------------------------------- Toasts --------------------------------- */
interface Toast {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  desc?: string;
}
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-white px-3.5 py-3 shadow-xl animate-[toast-in_.25s_ease-out]",
              t.tone === "success" && "border-brand-200",
              t.tone === "error" && "border-red-200",
              t.tone === "info" && "border-line",
            )}
          >
            {t.tone === "success" && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />}
            {t.tone === "error" && <XCircle size={16} className="mt-0.5 shrink-0 text-danger-600" />}
            {t.tone === "info" && <Clock size={16} className="mt-0.5 shrink-0 text-teal-700" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-900">{t.title}</p>
              {t.desc && <p className="mt-0.5 text-[11px] leading-relaxed text-mute">{t.desc}</p>}
            </div>
            <button
              onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}
              className="ml-auto shrink-0 rounded p-0.5 text-mute hover:text-ink-900"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ Motion helpers ----------------------------- */
export function CountUp({ value, format, duration = 900 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="num tabular-nums">{format(display)}</span>;
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/**
 * Loading placeholder. Rendered as a block-level <span> (never a <div>) so it
 * stays valid inside <p>, <td> and inline contexts without hydration errors.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded bg-slate-200/70", className)}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-xl border border-line bg-paper p-3 text-mute">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-ink-900">{title}</p>
        {desc && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-mute">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div
        className="h-full rounded-full bg-brand-600 transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
