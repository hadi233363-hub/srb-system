"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEquipmentAction } from "./actions";
import { useT } from "@/lib/i18n/client";

export function DeleteEquipmentButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm(`${t("equipment.deleteConfirm")} ${name}`)) return;
        startTransition(async () => {
          await deleteEquipmentAction(id);
          router.refresh();
        });
      }}
      className="rounded-md border border-rose-500/30 p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
      aria-label={t("action.delete")}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
