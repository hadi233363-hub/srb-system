"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CornerDownLeft,
  FileText,
  Image as ImageIcon,
  Layers,
  Link2,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import {
  applyPhaseTemplateAction,
  approvePhaseAction,
  createPhaseAction,
  deletePhaseAction,
  rejectPhaseAction,
  submitPhaseCompletionAction,
  unlockPhaseAction,
} from "@/app/projects/phase-actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { PHASE_TEMPLATES } from "@/lib/projects/phase-templates";
import { cn } from "@/lib/cn";

export interface PhaseTaskLite {
  id: string;
  title: string;
  status: string;
  assignee: { id: string; name: string } | null;
  dueAt: Date | string | null;
}

export interface PhaseLite {
  id: string;
  order: number;
  name: string;
  description: string | null;
  deadlineAt: Date | string | null;
  status: string;
  proofLinkUrl: string | null;
  proofFileUrl: string | null;
  proofFileName: string | null;
  proofFileType: string | null;
  submittedAt: Date | string | null;
  submittedBy: { id: string; name: string } | null;
  reviewNotes: string | null;
  reviewedAt: Date | string | null;
  approvedBy: { id: string; name: string } | null;
  tasks: PhaseTaskLite[];
}

interface Props {
  projectId: string;
  phases: PhaseLite[];
  canManage: boolean;
  isOwner: boolean;
  viewerId?: string;
}

const STATUS_TONE: Record<string, string> = {
  not_started: "border-zinc-700 bg-zinc-900/40 text-zinc-400",
  active: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  completed: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  locked: "border-zinc-700 bg-zinc-900/40 text-zinc-500",
};

export function ProjectPhases({
  projectId,
  phases,
  canManage,
  isOwner,
  viewerId,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(
    phases.find((p) => p.status === "active")?.id ?? phases[0]?.id ?? null
  );
  const [adding, setAdding] = useState(false);

  const onApplyTemplate = (key: string) => {
    setError(null);
    startTransition(async () => {
      const res = await applyPhaseTemplateAction(projectId, key, locale);
      if (res.ok) router.refresh();
      else setError(res.message ?? t("common.error"));
    });
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-400" />
          <h2 className="text-lg font-semibold">
            {t("phases.title")} ({phases.length})
          </h2>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("phases.addPhase")}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      {phases.length === 0 && canManage && (
        <div className="mb-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2 text-sm text-zinc-300">{t("phases.startFromTemplate")}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PHASE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                disabled={isPending}
                onClick={() => onApplyTemplate(tpl.key)}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-right transition hover:border-emerald-500/40 hover:bg-emerald-500/5 disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-zinc-200">
                  {locale === "en" ? tpl.labelEn : tpl.labelAr}
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
                  {tpl.phases.map((p, i) => (
                    <li key={i}>
                      {i + 1}. {locale === "en" ? p.en : p.ar}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>
      )}

      {adding && canManage && (
        <AddPhaseForm
          projectId={projectId}
          onClose={() => setAdding(false)}
          onError={setError}
        />
      )}

      {phases.length === 0 && !canManage && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          {t("phases.empty")}
        </div>
      )}

      <div className="space-y-3">
        {phases.map((p) => (
          <PhaseCard
            key={p.id}
            phase={p}
            open={openId === p.id}
            onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
            canManage={canManage}
            isOwner={isOwner}
            viewerId={viewerId}
            onError={setError}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add phase form
// ---------------------------------------------------------------------------

function AddPhaseForm({
  projectId,
  onClose,
  onError,
}: {
  projectId: string;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (formData: FormData) => {
    onError(null);
    startTransition(async () => {
      const res = await createPhaseAction(projectId, formData);
      if (res.ok) {
        formRef.current?.reset();
        onClose();
        router.refresh();
      } else {
        onError(res.message ?? t("common.error"));
      }
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="mb-3 grid grid-cols-1 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-2"
    >
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-[11px] text-zinc-500">
          {t("phases.field.name")}
        </span>
        <input
          name="name"
          required
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-zinc-500">
          {t("phases.field.deadline")}
        </span>
        <input
          name="deadlineAt"
          type="date"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-[11px] text-zinc-500">
          {t("phases.field.description")}
        </span>
        <textarea
          name="description"
          rows={2}
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
      </label>
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          {t("action.cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {isPending ? t("action.creating") : t("phases.create")}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Phase card
// ---------------------------------------------------------------------------

function PhaseCard({
  phase,
  open,
  onToggle,
  canManage,
  isOwner,
  viewerId,
  onError,
}: {
  phase: PhaseLite;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  isOwner: boolean;
  viewerId?: string;
  onError: (msg: string | null) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");

  const total = phase.tasks.length;
  const done = phase.tasks.filter((tk) => tk.status === "done").length;
  const pct = total === 0 ? (phase.status === "completed" ? 100 : 0) : Math.round((done / total) * 100);

  const isLocked = phase.status === "locked";
  const isCompleted = phase.status === "completed";
  const isPendingReview = !!phase.submittedAt && !isCompleted;
  const tone = STATUS_TONE[phase.status] ?? STATUS_TONE.not_started;

  const onUnlock = () => {
    onError(null);
    startTransition(async () => {
      const res = await unlockPhaseAction(phase.id);
      if (res.ok) router.refresh();
      else onError(res.message ?? t("common.error"));
    });
  };

  const onApprove = () => {
    onError(null);
    startTransition(async () => {
      const res = await approvePhaseAction(phase.id);
      if (res.ok) router.refresh();
      else onError(res.message ?? t("common.error"));
    });
  };

  const onReject = () => {
    if (!reason.trim()) {
      onError(t("submission.reasonRequired"));
      return;
    }
    onError(null);
    const fd = new FormData();
    fd.set("reason", reason.trim());
    startTransition(async () => {
      const res = await rejectPhaseAction(phase.id, fd);
      if (res.ok) {
        setReasonOpen(false);
        setReason("");
        router.refresh();
      } else {
        onError(res.message ?? t("common.error"));
      }
    });
  };

  const onDelete = () => {
    if (!confirm(t("phases.confirmDelete"))) return;
    onError(null);
    startTransition(async () => {
      const res = await deletePhaseAction(phase.id);
      if (res.ok) router.refresh();
      else onError(res.message ?? t("common.error"));
    });
  };

  return (
    <div className={cn("rounded-xl border bg-zinc-900/30", isLocked ? "border-zinc-800 opacity-80" : "border-zinc-800") }>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-right"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
          {phase.order}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", tone)}>
              {isLocked && <Lock className="me-1 inline h-2.5 w-2.5" />}
              {isCompleted && <Check className="me-1 inline h-2.5 w-2.5" />}
              {t(`phases.status.${phase.status}`)}
            </span>
            <span className="truncate text-sm font-semibold text-zinc-100">
              {phase.name}
            </span>
            {isPendingReview && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                {t("phases.pendingReview")}
              </span>
            )}
            {phase.deadlineAt && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <CalendarDays className="h-3 w-3" />
                {new Date(phase.deadlineAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  "h-full transition-all",
                  isCompleted ? "bg-emerald-500" : "bg-sky-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-zinc-500">
              {pct}% · {done}/{total}
            </span>
          </div>
        </div>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-800 p-3">
          {phase.description && (
            <p className="text-xs text-zinc-400 whitespace-pre-wrap">
              {phase.description}
            </p>
          )}

          {/* Tasks list */}
          {phase.tasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-800 px-3 py-2 text-[11px] text-zinc-600">
              {t("phases.tasksEmpty")}
            </div>
          ) : (
            <ul className="space-y-1">
              {phase.tasks.map((tk) => (
                <li
                  key={tk.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 text-zinc-200">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tk.status === "done"
                          ? "bg-emerald-500"
                          : tk.status === "in_review"
                          ? "bg-amber-500"
                          : tk.status === "in_progress"
                          ? "bg-sky-500"
                          : "bg-zinc-600"
                      )}
                    />
                    {tk.title}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {tk.assignee?.name ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Existing proof + review state */}
          {(phase.proofLinkUrl || phase.proofFileUrl) && (
            <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2 text-[11px]">
              <div className="mb-1 text-zinc-500">
                {t("phases.proof")}{" "}
                {phase.submittedBy && (
                  <span className="text-zinc-400">· {phase.submittedBy.name}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {phase.proofLinkUrl && (
                  <a
                    href={phase.proofLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
                  >
                    <Link2 className="h-3 w-3" />
                    {phase.proofLinkUrl}
                  </a>
                )}
                {phase.proofFileUrl && (
                  <a
                    href={phase.proofFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                  >
                    {phase.proofFileType?.startsWith("image/") ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    {phase.proofFileName ?? t("submission.attachment")}
                  </a>
                )}
              </div>
              {phase.proofFileType?.startsWith("image/") && phase.proofFileUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={phase.proofFileUrl}
                  alt={phase.proofFileName ?? "proof"}
                  className="mt-2 max-h-40 rounded-md border border-zinc-800 object-cover"
                />
              )}
            </div>
          )}

          {phase.reviewNotes && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[11px] text-rose-300">
              <span className="font-semibold">{t("submission.reviewNotes")}: </span>
              {phase.reviewNotes}
            </div>
          )}

          {/* Owner: approve / reject */}
          {isOwner && isPendingReview && !reasonOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
              <span className="text-[11px] text-amber-300">
                {t("phases.reviewMe")}
              </span>
              <button
                type="button"
                onClick={onApprove}
                disabled={isPending}
                className="ms-auto flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("phases.approve")}
              </button>
              <button
                type="button"
                onClick={() => setReasonOpen(true)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
                {t("submission.requestChanges")}
              </button>
            </div>
          )}
          {isOwner && isPendingReview && reasonOpen && (
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={t("submission.reasonPlaceholder")}
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReasonOpen(false);
                    setReason("");
                  }}
                  disabled={isPending}
                  className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  {isPending ? t("action.saving") : t("submission.send")}
                </button>
              </div>
            </div>
          )}

          {/* Employee: complete-phase form (only when active + not already pending review) */}
          {!isLocked && !isCompleted && !isPendingReview && viewerId && (
            <PhaseCompleteForm phaseId={phase.id} onError={onError} />
          )}

          {/* Owner footer: unlock / delete */}
          <div className="flex items-center justify-end gap-2">
            {isOwner && isLocked && (
              <button
                type="button"
                onClick={onUnlock}
                disabled={isPending}
                className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60"
              >
                <Unlock className="h-3.5 w-3.5" />
                {t("phases.unlock")}
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isPending}
                className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/5 px-2.5 py-1 text-[11px] text-rose-400 hover:bg-rose-500/15 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("action.delete")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseCompleteForm({
  phaseId,
  onError,
}: {
  phaseId: string;
  onError: (msg: string | null) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (formData: FormData) => {
    onError(null);
    startTransition(async () => {
      const res = await submitPhaseCompletionAction(phaseId, formData);
      if (res.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        onError(res.message ?? t("common.error"));
      }
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      encType="multipart/form-data"
      className="space-y-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2"
    >
      <div className="text-[11px] font-semibold text-emerald-300">
        {t("phases.completeHeader")}
      </div>
      <input
        name="linkUrl"
        type="url"
        placeholder="https://..."
        dir="ltr"
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
      />
      <input
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/gif,application/pdf"
        className="block w-full text-[11px] text-zinc-300 file:me-2 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2.5 file:py-1.5 file:text-[11px] file:text-zinc-200 hover:file:bg-zinc-700"
      />
      <span className="block text-[10px] text-zinc-600">
        {t("submission.fileHint")}
      </span>
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          {isPending ? t("action.saving") : t("phases.completeButton")}
        </button>
      </div>
    </form>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
  ) : (
    <ChevronLeft className="h-4 w-4 shrink-0 text-zinc-500" />
  );
}

