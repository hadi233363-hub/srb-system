"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { deleteShootAction, updateShootAction } from "./actions";
import { ShootForm } from "./shoot-form";
import { useT } from "@/lib/i18n/client";

interface Shoot {
  id: string;
  title: string;
  projectId: string | null;
  shootDate: Date;
  durationHours: number;
  location: string;
  locationNotes: string | null;
  mapUrl: string | null;
  clientContact: string | null;
  shotList: string | null;
  referenceUrl: string | null;
  notes: string | null;
  status: string;
  crew: { user: { id: string; name: string } }[];
  equipment: { equipment: { id: string; name: string; category: string } }[];
}

interface Props {
  shoot: Shoot;
  users: { id: string; name: string }[];
  projects: { id: string; title: string }[];
  equipment: { id: string; name: string; category: string }[];
}

export function ShootActions({ shoot, users, projects, equipment }: Props) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (status: string) => {
    const fd = new FormData();
    fd.set("status", status);
    startTransition(async () => {
      await updateShootAction(shoot.id, fd);
      router.refresh();
    });
  };

  const del = () => {
    if (!confirm(`${t("shoots.deleteConfirm")} ${shoot.title}`)) return;
    startTransition(async () => {
      await deleteShootAction(shoot.id);
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {shoot.status === "scheduled" && (
        <>
          <button
            onClick={() => setStatus("done")}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-40"
          >
            <CheckCircle2 className="h-3 w-3" />
            {t("shoots.markDone")}
          </button>
          <button
            onClick={() => setStatus("cancelled")}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <XCircle className="h-3 w-3" />
            {t("shoots.cancel")}
          </button>
        </>
      )}
      <ShootForm
        mode="edit"
        users={users}
        projects={projects}
        equipment={equipment}
        initial={{
          id: shoot.id,
          title: shoot.title,
          projectId: shoot.projectId,
          shootDate: shoot.shootDate,
          durationHours: shoot.durationHours,
          location: shoot.location,
          locationNotes: shoot.locationNotes,
          mapUrl: shoot.mapUrl,
          clientContact: shoot.clientContact,
          shotList: shoot.shotList,
          referenceUrl: shoot.referenceUrl,
          notes: shoot.notes,
          status: shoot.status,
          crewIds: shoot.crew.map((c) => c.user.id),
          equipmentIds: shoot.equipment.map((e) => e.equipment.id),
        }}
      />
      <button
        onClick={del}
        disabled={isPending}
        className="rounded-md border border-rose-500/30 p-1 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-40"
        aria-label={t("action.delete")}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
