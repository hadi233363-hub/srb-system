"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, Users, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { createShootAction, updateShootAction } from "./actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}
interface ProjectLite {
  id: string;
  title: string;
}
interface EquipmentLite {
  id: string;
  name: string;
  category: string;
}

interface ShootInitial {
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
  crewIds: string[];
  equipmentIds: string[];
}

interface Props {
  mode: "create" | "edit";
  users: UserLite[];
  projects: ProjectLite[];
  equipment: EquipmentLite[];
  initial?: ShootInitial;
}

function dateToLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function ShootForm({
  mode,
  users,
  projects,
  equipment,
  initial,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [crewIds, setCrewIds] = useState<string[]>(initial?.crewIds ?? []);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(
    initial?.equipmentIds ?? []
  );

  const defaultStart = initial
    ? dateToLocalInput(new Date(initial.shootDate))
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return dateToLocalInput(d);
      })();

  const toggleCrew = (id: string) =>
    setCrewIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  const toggleEquipment = (id: string) =>
    setEquipmentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const onSubmit = (formData: FormData) => {
    setError(null);
    formData.set("crewIds", crewIds.join(","));
    formData.set("equipmentIds", equipmentIds.join(","));
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createShootAction(formData)
          : await updateShootAction(initial!.id, formData);
      if (res.ok) {
        setOpen(false);
        if (!initial) {
          setCrewIds([]);
          setEquipmentIds([]);
        }
        formRef.current?.reset();
        router.refresh();
      } else {
        const msg = (res as { message?: string }).message;
        setError(msg ?? t("common.errorGeneric"));
      }
    });
  };

  // Group equipment by category so the picker is navigable.
  const byCategory = equipment.reduce<Record<string, EquipmentLite[]>>(
    (acc, e) => {
      if (!acc[e.category]) acc[e.category] = [];
      acc[e.category].push(e);
      return acc;
    },
    {}
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
          mode === "create"
            ? "text-zinc-950 hover:opacity-90"
            : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        )}
        style={
          mode === "create" ? { background: "var(--color-brand)" } : undefined
        }
      >
        {mode === "create" && <Plus className="h-4 w-4" />}
        {mode === "create" ? t("shoots.new") : t("action.edit")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[5vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {mode === "create" ? t("shoots.new") : t("shoots.edit")}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form
              ref={formRef}
              action={onSubmit}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <Field label={`${t("shoots.field.title")} *`} full>
                <input
                  name="title"
                  required
                  defaultValue={initial?.title ?? ""}
                  placeholder={t("shoots.field.titlePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.project")}>
                <select
                  name="projectId"
                  defaultValue={initial?.projectId ?? ""}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "edit" && (
                <Field label={t("shoots.field.status")}>
                  <select
                    name="status"
                    defaultValue={initial?.status ?? "scheduled"}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  >
                    <option value="scheduled">{t("shoots.status.scheduled")}</option>
                    <option value="done">{t("shoots.status.done")}</option>
                    <option value="cancelled">{t("shoots.status.cancelled")}</option>
                    <option value="postponed">{t("shoots.status.postponed")}</option>
                  </select>
                </Field>
              )}
              <Field label={`${t("shoots.field.date")} *`}>
                <input
                  type="datetime-local"
                  name="shootDate"
                  required
                  defaultValue={defaultStart}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.duration")}>
                <select
                  name="durationHours"
                  defaultValue={String(initial?.durationHours ?? 4)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="1">1 {t("shoots.hours")}</option>
                  <option value="2">2 {t("shoots.hours")}</option>
                  <option value="3">3 {t("shoots.hours")}</option>
                  <option value="4">4 {t("shoots.hours")}</option>
                  <option value="6">6 {t("shoots.hours")}</option>
                  <option value="8">8 {t("shoots.hours")}</option>
                  <option value="12">12 {t("shoots.hours")}</option>
                </select>
              </Field>
              <Field label={`${t("shoots.field.location")} *`} full>
                <input
                  name="location"
                  required
                  defaultValue={initial?.location ?? ""}
                  placeholder={t("shoots.field.locationPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.locationNotes")}>
                <input
                  name="locationNotes"
                  defaultValue={initial?.locationNotes ?? ""}
                  placeholder={t("shoots.field.locationNotesPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.mapUrl")}>
                <input
                  type="url"
                  name="mapUrl"
                  defaultValue={initial?.mapUrl ?? ""}
                  placeholder="https://maps.google.com/..."
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.clientContact")}>
                <input
                  name="clientContact"
                  defaultValue={initial?.clientContact ?? ""}
                  placeholder={t("shoots.field.clientContactPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.referenceUrl")}>
                <input
                  type="url"
                  name="referenceUrl"
                  defaultValue={initial?.referenceUrl ?? ""}
                  placeholder="https://drive.google.com/..."
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              {/* Crew multi-select */}
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="h-3 w-3" />
                  {t("shoots.field.crew")} · {crewIds.length}
                </div>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 p-2">
                  {users.length === 0 && (
                    <span className="text-xs text-zinc-600">
                      {t("shoots.noCrewAvailable")}
                    </span>
                  )}
                  {users.map((u) => {
                    const selected = crewIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleCrew(u.id)}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
                          selected
                            ? "border-transparent text-zinc-950"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        )}
                        style={
                          selected
                            ? { background: "var(--color-brand)" }
                            : undefined
                        }
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {displayName(u)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Equipment multi-select */}
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Package className="h-3 w-3" />
                  {t("shoots.field.equipment")} · {equipmentIds.length}
                </div>
                <div className="space-y-2 rounded-md border border-zinc-700 bg-zinc-950 p-2 max-h-64 overflow-auto">
                  {equipment.length === 0 && (
                    <span className="text-xs text-zinc-600">
                      {t("shoots.noEquipmentAvailable")}
                    </span>
                  )}
                  {Object.entries(byCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        {t(`equipment.category.${cat}`)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((e) => {
                          const selected = equipmentIds.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => toggleEquipment(e.id)}
                              className={cn(
                                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition",
                                selected
                                  ? "border-transparent text-zinc-950"
                                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                              )}
                              style={
                                selected
                                  ? { background: "var(--color-brand)" }
                                  : undefined
                              }
                            >
                              {selected && <Check className="h-2.5 w-2.5" />}
                              {e.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Field label={t("shoots.field.shotList")} full>
                <textarea
                  name="shotList"
                  rows={3}
                  defaultValue={initial?.shotList ?? ""}
                  placeholder={t("shoots.field.shotListPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("shoots.field.notes")} full>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={initial?.notes ?? ""}
                  placeholder={t("shoots.field.notesPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-3 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-brand)" }}
                >
                  {isPending
                    ? t("action.saving")
                    : mode === "create"
                    ? t("shoots.create")
                    : t("action.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
