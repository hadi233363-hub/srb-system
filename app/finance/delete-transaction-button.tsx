"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTransactionAction } from "./actions";

export function DeleteTransactionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm("تحذف هذي المعاملة؟")) return;
        startTransition(async () => {
          await deleteTransactionAction(id);
        });
      }}
      className="rounded-md p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
      aria-label="حذف"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
