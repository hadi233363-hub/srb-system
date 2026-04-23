"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTransactionAction } from "./actions";
import { useT } from "@/lib/i18n/client";

export function DeleteTransactionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const t = useT();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm(t("finance.delete.confirm"))) return;
        startTransition(async () => {
          await deleteTransactionAction(id);
        });
      }}
      className="rounded-md p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
      aria-label={t("action.delete")}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
