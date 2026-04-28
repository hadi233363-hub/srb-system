"use client";

// Client combobox — replaces the free-text "client name" input on the
// new-project form. Live-searches /api/clients/search as the user types,
// dedupes against the existing client roster, and surfaces an explicit
// "➕ add new client" option when nothing matches. Picking an existing
// row sets the hidden `clientId`; picking the add-new option falls
// through to `clientName` so the server can auto-create on save.

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

interface ClientResult {
  id: string;
  name: string;
  phone: string | null;
  projectsCount: number;
}

interface Props {
  // Names of the hidden form fields submitted with the surrounding <form>.
  // The new-project action prefers `clientId` when present, falls back to
  // `clientName` otherwise.
  idFieldName?: string;
  nameFieldName?: string;
  placeholder?: string;
  defaultName?: string;
  defaultId?: string;
}

export function ClientCombobox({
  idFieldName = "clientId",
  nameFieldName = "clientName",
  placeholder,
  defaultName = "",
  defaultId = "",
}: Props) {
  const t = useT();
  const [query, setQuery] = useState(defaultName);
  const [selectedId, setSelectedId] = useState<string>(defaultId);
  const [selectedName, setSelectedName] = useState<string>(defaultName);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced fetch — 150 ms is enough to coalesce typing without feeling
  // sluggish, and avoids hammering the API at 60+ req/s while typing.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clients/search?q=${encodeURIComponent(query)}&limit=8`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { ok: boolean; results: ClientResult[] };
        if (json.ok) setResults(json.results);
      } catch {
        // ignored — likely an aborted request
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [query, open]);

  const trimmed = query.trim();
  const exactMatch = results.find(
    (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  const showAddNew = trimmed.length > 0 && !exactMatch;

  const onPick = (r: ClientResult) => {
    setSelectedId(r.id);
    setSelectedName(r.name);
    setQuery(r.name);
    setOpen(false);
  };

  const onAddNew = () => {
    setSelectedId("");
    setSelectedName(trimmed);
    setQuery(trimmed);
    setOpen(false);
  };

  const onClear = () => {
    setSelectedId("");
    setSelectedName("");
    setQuery("");
    setOpen(true);
  };

  const onChangeQuery = (v: string) => {
    setQuery(v);
    // Typing invalidates the previous selection — the user is searching again.
    if (selectedId) setSelectedId("");
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={idFieldName} value={selectedId} />
      <input type="hidden" name={nameFieldName} value={selectedName || query} />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 start-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 ps-9 pe-9 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
        {(query || selectedId) && (
          <button
            type="button"
            onClick={onClear}
            title={t("clients.combobox.clear")}
            className="absolute top-1/2 -translate-y-1/2 end-2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {selectedId && !open && (
        <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
          <Check className="h-3 w-3" />
          {t("clients.combobox.linked")}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
          {loading && (
            <div className="px-3 py-2 text-[11px] text-zinc-500">…</div>
          )}

          {!loading && results.length === 0 && trimmed === "" && (
            <div className="px-3 py-2 text-[11px] text-zinc-500">
              {t("clients.combobox.empty")}
            </div>
          )}

          {!loading && results.length === 0 && trimmed !== "" && !showAddNew && (
            <div className="px-3 py-2 text-[11px] text-zinc-500">
              {t("clients.combobox.noResults")}
            </div>
          )}

          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition hover:bg-zinc-900",
                selectedId === r.id && "bg-emerald-500/10"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-zinc-100">{r.name}</div>
                {r.phone && (
                  <div className="truncate text-[10px] text-zinc-500" dir="ltr">
                    {r.phone}
                  </div>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
                {r.projectsCount}
              </span>
            </button>
          ))}

          {showAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="flex w-full items-center gap-2 border-t border-zinc-800 bg-emerald-500/5 px-3 py-2 text-start text-sm text-emerald-400 transition hover:bg-emerald-500/10"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {t("clients.combobox.addNew")} <strong>{trimmed}</strong>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
