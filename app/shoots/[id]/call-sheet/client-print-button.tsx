"use client";

import { Printer } from "lucide-react";

export function ClientPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs text-zinc-100 transition hover:bg-zinc-800"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
