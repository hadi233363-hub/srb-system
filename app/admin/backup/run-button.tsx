"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { runBackupAction } from "./actions";
import { useT } from "@/lib/i18n/client";

export function RunBackupButton() {
  const [isPending, startTransition] = useTransition();
  const t = useT();

  const trigger = () => {
    startTransition(async () => {
      const result = await runBackupAction();
      if (result.ok) {
        alert(`${t("backup.success")}\n${result.filePath ?? ""}`);
      } else {
        alert(`${t("backup.failed")}\n${result.error ?? ""}`);
      }
    });
  };

  return (
    <button
      onClick={trigger}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70"
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("backup.running")}
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          {t("backup.runNow")}
        </>
      )}
    </button>
  );
}
