"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultFilters,
  filtersToParams,
  type FilterState,
} from "@/lib/filters";

interface FiltersCtx {
  filters: FilterState;
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
  params: URLSearchParams;
  version: number;
}

const Ctx = createContext<FiltersCtx | null>(null);
const LS_KEY = "vas.filters.v1";

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(() => defaultFilters());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setFilters({ ...defaultFilters(), ...(JSON.parse(raw) as FilterState) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const set = useCallback((patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setVersion((v) => v + 1);
  }, []);
  const reset = useCallback(() => {
    setFilters(defaultFilters());
    setVersion((v) => v + 1);
  }, []);

  const params = useMemo(() => filtersToParams(filters), [filters]);

  return <Ctx.Provider value={{ filters, set, reset, params, version }}>{children}</Ctx.Provider>;
}

export function useFilters(): FiltersCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFilters must be used inside FiltersProvider");
  return ctx;
}

/** Tiny data-fetching hook with refresh-event support. */
export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce, ...deps]);

  useEffect(() => {
    const h = () => setNonce((n) => n + 1);
    window.addEventListener("vas:refresh", h);
    return () => window.removeEventListener("vas:refresh", h);
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

export function refreshAll() {
  window.dispatchEvent(new CustomEvent("vas:refresh"));
}
