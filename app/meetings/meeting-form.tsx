"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createMeetingAction, updateMeetingAction } from "./actions";
import { displayName } from "@/lib/display";
import { useT } from "@/lib/i18n/client";

interface UserLite {
  id: string;
  name: string;
  nickname: string | null;
}

interface MeetingInitial {
  id: string;
  clientName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  websiteUrl: string | null;
  socialNotes: string | null;
  meetingAt: Date;
  durationMin: number;
  location: string | null;
  meetingLink: string | null;
  agendaNotes: string | null;
  status: string;
  outcomeNotes: string | null;
  ownerId: string | null;
}

interface Props {
  mode: "create" | "edit";
  users: UserLite[];
  currentUserId: string;
  initial?: MeetingInitial;
  triggerLabel?: string;
}

function dateToLocalInput(d: Date): string {
  // Format as YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function MeetingForm({
  mode,
  users,
  currentUserId,
  initial,
  triggerLabel,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const defaultStart = initial
    ? dateToLocalInput(new Date(initial.meetingAt))
    : (() => {
        // Default: tomorrow at 10:00 local
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(10, 0, 0, 0);
        return dateToLocalInput(d);
      })();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createMeetingAction(formData)
          : await updateMeetingAction(initial!.id, formData);
      if (res.ok) {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      } else {
        const msg = (res as { message?: string }).message;
        setError(msg ?? t("common.errorGeneric"));
      }
    });
  };

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
        {triggerLabel ??
          (mode === "create" ? t("meetings.new") : t("action.edit"))}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[5vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {mode === "create"
                  ? t("meetings.new")
                  : t("meetings.edit")}
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
              <Section title={t("meetings.section.client")} />
              <Field label={`${t("meetings.field.clientName")} *`}>
                <input
                  name="clientName"
                  required
                  defaultValue={initial?.clientName ?? ""}
                  placeholder={t("meetings.field.clientNamePlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.companyName")}>
                <input
                  name="companyName"
                  defaultValue={initial?.companyName ?? ""}
                  placeholder={t("meetings.field.companyPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.phone")}>
                <input
                  name="phone"
                  defaultValue={initial?.phone ?? ""}
                  placeholder="+974 5555 0000"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.email")}>
                <input
                  type="email"
                  name="email"
                  defaultValue={initial?.email ?? ""}
                  placeholder="client@example.com"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Section title={t("meetings.section.social")} />
              <Field label={t("meetings.field.instagram")}>
                <input
                  name="instagramHandle"
                  defaultValue={initial?.instagramHandle ?? ""}
                  placeholder="@clientname"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.tiktok")}>
                <input
                  name="tiktokHandle"
                  defaultValue={initial?.tiktokHandle ?? ""}
                  placeholder="@clientname"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.website")} full>
                <input
                  type="url"
                  name="websiteUrl"
                  defaultValue={initial?.websiteUrl ?? ""}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.socialNotes")} full>
                <input
                  name="socialNotes"
                  defaultValue={initial?.socialNotes ?? ""}
                  placeholder={t("meetings.field.socialNotesPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <Section title={t("meetings.section.schedule")} />
              <Field label={`${t("meetings.field.meetingAt")} *`}>
                <input
                  type="datetime-local"
                  name="meetingAt"
                  required
                  defaultValue={defaultStart}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.duration")}>
                <select
                  name="durationMin"
                  defaultValue={String(initial?.durationMin ?? 60)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="15">15 {t("meetings.minutes")}</option>
                  <option value="30">30 {t("meetings.minutes")}</option>
                  <option value="45">45 {t("meetings.minutes")}</option>
                  <option value="60">60 {t("meetings.minutes")}</option>
                  <option value="90">90 {t("meetings.minutes")}</option>
                  <option value="120">120 {t("meetings.minutes")}</option>
                </select>
              </Field>
              <Field label={t("meetings.field.location")}>
                <input
                  name="location"
                  defaultValue={initial?.location ?? ""}
                  placeholder={t("meetings.field.locationPlaceholder")}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.meetingLink")}>
                <input
                  type="url"
                  name="meetingLink"
                  defaultValue={initial?.meetingLink ?? ""}
                  placeholder="https://meet.google.com/..."
                  dir="ltr"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label={t("meetings.field.owner")}>
                <select
                  name="ownerId"
                  defaultValue={initial?.ownerId ?? currentUserId}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayName(u)}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "edit" && (
                <Field label={t("meetings.field.status")}>
                  <select
                    name="status"
                    defaultValue={initial?.status ?? "scheduled"}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  >
                    <option value="scheduled">{t("meetings.status.scheduled")}</option>
                    <option value="done">{t("meetings.status.done")}</option>
                    <option value="cancelled">{t("meetings.status.cancelled")}</option>
                    <option value="no_show">{t("meetings.status.no_show")}</option>
                  </select>
                </Field>
              )}

              <Section title={t("meetings.section.notes")} />
              <Field label={t("meetings.field.agendaNotes")} full>
                <textarea
                  name="agendaNotes"
                  rows={3}
                  defaultValue={initial?.agendaNotes ?? ""}
                  placeholder={t("meetings.field.agendaPlaceholder")}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              {mode === "edit" && (
                <Field label={t("meetings.field.outcomeNotes")} full>
                  <textarea
                    name="outcomeNotes"
                    rows={3}
                    defaultValue={initial?.outcomeNotes ?? ""}
                    placeholder={t("meetings.field.outcomePlaceholder")}
                    className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                  />
                </Field>
              )}

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
                    ? t("meetings.create")
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

function Section({ title }: { title: string }) {
  return (
    <div className="sm:col-span-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </div>
      <div className="border-t border-zinc-800" />
    </div>
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
