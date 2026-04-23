"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX, X } from "lucide-react";
import { checkInEquipmentAction, checkOutEquipmentAction } from "./actions";
import { useT } from "@/lib/i18n/client";

interface UserLite {
  id: string;
  name: string;
}

interface Props {
  equipmentId: string;
  equipmentName: string;
  currentHolder: { id: string; name: string } | null;
  users: UserLite[];
}

export function CheckOutButton({
  equipmentId,
  equipmentName,
  currentHolder,
  users,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [holderId, setHolderId] = useState<string>("");
  const [expectedReturnAt, setExpectedReturnAt] = useState<string>("");

  const doCheckOut = () => {
    if (!holderId) return;
    startTransition(async () => {
      await checkOutEquipmentAction(equipmentId, holderId, expectedReturnAt || null);
      setOpen(false);
      router.refresh();
    });
  };

  const doCheckIn = () => {
    startTransition(async () => {
      await checkInEquipmentAction(equipmentId);
      router.refresh();
    });
  };

  if (currentHolder) {
    return (
      <button
        onClick={doCheckIn}
        disabled={isPending}
        className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
      >
        <UserX className="h-3 w-3" />
        {t("equipment.checkIn")}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800"
      >
        <UserCheck className="h-3 w-3" />
        {t("equipment.checkOut")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {t("equipment.checkOutTitle")}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
              📦 {equipmentName}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">
                  {t("equipment.checkOutHolder")}
                </span>
                <select
                  value={holderId}
                  onChange={(e) => setHolderId(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">
                  {t("equipment.expectedReturn")}
                </span>
                <input
                  type="date"
                  value={expectedReturnAt}
                  onChange={(e) => setExpectedReturnAt(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  onClick={doCheckOut}
                  disabled={isPending || !holderId}
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-brand)" }}
                >
                  {isPending ? t("action.saving") : t("equipment.checkOut")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
