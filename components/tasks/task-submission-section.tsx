"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CornerDownLeft,
  FileText,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Send,
} from "lucide-react";
import {
  approveTaskSubmissionAction,
  requestTaskChangesAction,
  submitTaskWorkAction,
} from "@/app/tasks/submission-actions";
import { useT } from "@/lib/i18n/client";

export interface SubmissionLite {
  id: string;
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  note: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  submitter: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
}

interface Props {
  taskId: string;
  taskStatus: string;
  isAssignee: boolean;
  isOwner: boolean;
  submissions: SubmissionLite[];
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/gif,application/pdf";

export function TaskSubmissionSection({
  taskId,
  taskStatus,
  isAssignee,
  isOwner,
  submissions,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const latest = submissions[0];
  const pending = latest && latest.status === "pending";
  const showSubmit =
    isAssignee && taskStatus !== "done" && (!latest || latest.status !== "pending");

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await submitTaskWorkAction(taskId, formData);
      if (res.ok) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(res.message ?? t("common.error"));
      }
    });
  };

  const onApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approveTaskSubmissionAction(taskId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message ?? t("common.error"));
      }
    });
  };

  const onRequestChanges = () => {
    if (!reason.trim()) {
      setError(t("submission.reasonRequired"));
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("reason", reason.trim());
    startTransition(async () => {
      const res = await requestTaskChangesAction(taskId, fd);
      if (res.ok) {
        setReasonOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(res.message ?? t("common.error"));
      }
    });
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-300">
        <Paperclip className="h-3.5 w-3.5 text-emerald-400" />
        {t("submission.title")}
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 text-[11px] text-rose-400">
          {error}
        </div>
      )}

      {/* History */}
      {submissions.length > 0 && (
        <ul className="mb-3 space-y-2">
          {submissions.slice(0, 5).map((s) => (
            <SubmissionRow key={s.id} s={s} t={t} />
          ))}
        </ul>
      )}

      {/* Owner review controls */}
      {isOwner && pending && !reasonOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <span className="text-[11px] text-amber-300">
            {t("submission.awaitingReview")}
          </span>
          <button
            type="button"
            onClick={onApprove}
            disabled={isPending}
            className="ms-auto flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("submission.approve")}
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

      {isOwner && pending && reasonOpen && (
        <div className="mb-3 space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
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
                setError(null);
              }}
              disabled={isPending}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800"
            >
              {t("action.cancel")}
            </button>
            <button
              type="button"
              onClick={onRequestChanges}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
              {isPending ? t("action.saving") : t("submission.send")}
            </button>
          </div>
        </div>
      )}

      {/* Employee submit form */}
      {showSubmit ? (
        <form
          ref={formRef}
          action={onSubmit}
          encType="multipart/form-data"
          className="space-y-2"
        >
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11px] text-zinc-500">
              <Link2 className="h-3 w-3" />
              {t("submission.linkLabel")}
            </span>
            <input
              name="linkUrl"
              type="url"
              placeholder="https://..."
              dir="ltr"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11px] text-zinc-500">
              <Paperclip className="h-3 w-3" />
              {t("submission.fileLabel")}
            </span>
            <input
              name="file"
              type="file"
              accept={ACCEPTED}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > MAX_BYTES) {
                  setError(t("submission.tooLarge"));
                  e.target.value = "";
                } else {
                  setError(null);
                }
              }}
              className="block w-full text-[11px] text-zinc-300 file:me-2 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2.5 file:py-1.5 file:text-[11px] file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <span className="mt-0.5 block text-[10px] text-zinc-600">
              {t("submission.fileHint")}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-zinc-500">
              {t("submission.noteLabel")}
            </span>
            <textarea
              name="note"
              rows={2}
              placeholder={t("submission.notePlaceholder")}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
            />
          </label>
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {isPending ? t("action.saving") : t("submission.submit")}
            </button>
          </div>
        </form>
      ) : (
        !isOwner &&
        !isAssignee &&
        submissions.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-800 px-3 py-2 text-[11px] text-zinc-600">
            {t("submission.empty")}
          </div>
        )
      )}

      {isAssignee && pending && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          {t("submission.assigneeWaiting")}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({
  s,
  t,
}: {
  s: SubmissionLite;
  t: (key: string) => string;
}) {
  const isImage = s.fileType?.startsWith("image/");
  const date = new Date(s.createdAt).toLocaleString("en", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const tone =
    s.status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : s.status === "changes_requested"
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-amber-500/30 bg-amber-500/5";
  const statusLabel = t(`submission.status.${s.status}`);

  return (
    <li className={`rounded-md border px-2.5 py-2 ${tone}`}>
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
        <span>{s.submitter.name}</span>
        <span className="tabular-nums">{date}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          {statusLabel}
        </span>
        {s.linkUrl && (
          <a
            href={s.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
            dir="ltr"
          >
            <Link2 className="h-3 w-3" />
            {truncate(s.linkUrl, 40)}
          </a>
        )}
        {s.fileUrl && (
          <a
            href={s.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
          >
            {isImage ? (
              <ImageIcon className="h-3 w-3" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {s.fileName ?? t("submission.attachment")}
          </a>
        )}
      </div>
      {isImage && s.fileUrl && (
        <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.fileUrl}
            alt={s.fileName ?? "preview"}
            className="mt-2 max-h-40 rounded-md border border-zinc-800 object-cover"
          />
        </a>
      )}
      {s.note && (
        <div className="mt-1 text-[11px] text-zinc-300 whitespace-pre-wrap">
          {s.note}
        </div>
      )}
      {s.reviewNotes && (
        <div className="mt-1 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[11px] text-rose-300">
          <span className="font-semibold">{t("submission.reviewNotes")}: </span>
          {s.reviewNotes}
        </div>
      )}
    </li>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
