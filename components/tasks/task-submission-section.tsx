"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  CornerDownLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { detectLinkType } from "@/lib/links";
import { cn } from "@/lib/cn";

export interface SubmissionLite {
  id: string;
  linkUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  note: string | null;
  status: string;
  // Revision number — 1 for the first submission on a task, increments
  // whenever the assignee re-submits after "request changes". Falls back to
  // a derived index if older rows didn't have the column populated.
  revisionNumber?: number | null;
  reviewNotes: string | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  submitter: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
}

interface Props {
  taskId: string;
  /** Currently unused inside the section — kept on the props so callers
   *  can pass it for future copy ("submitted [Title]") without having to
   *  thread a new prop through. */
  taskTitle?: string;
  taskStatus: string;
  isAssignee: boolean;
  isOwner: boolean;
  // Latest snapshot (from Task row)
  submissionUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  submissionFileType: string | null;
  submissionNote: string | null;
  submittedAt: Date | string | null;
  reviewNote: string | null;
  reviewedAt: Date | string | null;
  // Optional history (small list rendered below review actions)
  submissions?: SubmissionLite[];
  /** Called after a successful submit / approve / reject — modal closes. */
  onAfterAction?: () => void;
}

const ACCEPT_MIME =
  "image/jpeg,image/png,image/gif,application/pdf";
const ACCEPT_EXT = ".jpg,.jpeg,.png,.gif,.pdf";
const MAX_BYTES = 10 * 1024 * 1024;

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface Toast {
  kind: "success" | "warning" | "error";
  message: string;
}

export function TaskSubmissionSection({
  taskId,
  taskStatus,
  isAssignee,
  isOwner,
  submissionUrl,
  submissionFileUrl,
  submissionFileName,
  submissionFileType,
  submissionNote,
  submittedAt,
  reviewNote,
  reviewedAt,
  submissions,
  onAfterAction,
}: Props) {
  const t = useT();
  const router = useRouter();

  // ---- form state ----
  const [linkUrl, setLinkUrl] = useState("");
  const [note, setNote] = useState("");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- review state ----
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewing, startReview] = useTransition();

  // ---- toast ----
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isInReview = taskStatus === "in_review";
  const isDone = taskStatus === "done";
  const wasRejected = !!reviewNote && taskStatus === "in_progress";

  // Anyone who can act on this task. The assignee + collaborators are the
  // primary case; the owner (admin) can submit on behalf because they manage
  // every project end-to-end and routinely test the flow.
  const canSubmit = isAssignee || isOwner;

  // The form is shown when the task isn't currently under review or already
  // done AND the viewer is somebody who can submit work on it.
  const showForm = canSubmit && !isInReview && !isDone;
  const showOwnerReview = isOwner && isInReview;

  // ----------------------------------------------------------------------
  // File handling
  // ----------------------------------------------------------------------
  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("submission.tooLarge"));
      return;
    }
    if (!ACCEPT_MIME.split(",").includes(file.type)) {
      setError(t("submission.badType"));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/tasks/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as
        | { ok: true; url: string; fileName: string; fileType: string; fileSize: number }
        | { error: string };
      if (!res.ok || !("ok" in data)) {
        const msg = "error" in data ? data.error : t("submission.uploadFailed");
        setError(msg);
        return;
      }
      setUploaded({
        url: data.url,
        name: data.fileName,
        type: data.fileType,
        size: data.fileSize,
      });
    } catch {
      setError(t("submission.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const removeFile = () => {
    setUploaded(null);
    setError(null);
  };

  // ----------------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------------
  const onSubmit = async () => {
    setError(null);
    const trimmedLink = linkUrl.trim();
    if (!trimmedLink && !uploaded) {
      setError(t("submission.requireOne"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkUrl: trimmedLink || null,
          fileUrl: uploaded?.url ?? null,
          fileName: uploaded?.name ?? null,
          fileType: uploaded?.type ?? null,
          note: note.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("common.error"));
        return;
      }
      setToast({
        kind: "success",
        message: t("submission.toastSubmitted"),
      });
      router.refresh();
      // Brief delay so the user sees the toast before the modal closes.
      setTimeout(() => onAfterAction?.(), 700);
    } catch {
      setError(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------
  // Owner: approve / reject
  // ----------------------------------------------------------------------
  const onApprove = () => {
    setError(null);
    startReview(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/approve`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? t("common.error"));
          return;
        }
        setToast({ kind: "success", message: t("submission.toastApproved") });
        router.refresh();
        setTimeout(() => onAfterAction?.(), 700);
      } catch {
        setError(t("common.error"));
      }
    });
  };

  const onReject = () => {
    if (!reason.trim()) {
      setError(t("submission.reasonRequired"));
      return;
    }
    setError(null);
    startReview(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? t("common.error"));
          return;
        }
        setToast({ kind: "warning", message: t("submission.toastRejected") });
        router.refresh();
        setTimeout(() => onAfterAction?.(), 700);
      } catch {
        setError(t("common.error"));
      }
    });
  };

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  const linkPreviewType = detectLinkType(linkUrl);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-300">
        <Paperclip className="h-3.5 w-3.5 text-emerald-400" />
        {t("submission.title")}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
            toast.kind === "success" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
            toast.kind === "warning" &&
              "border-amber-500/40 bg-amber-500/10 text-amber-300",
            toast.kind === "error" &&
              "border-rose-500/40 bg-rose-500/10 text-rose-300"
          )}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Owner review panel — shown when status is in_review */}
      {showOwnerReview && (
        <ReviewPanel
          submissionUrl={submissionUrl}
          submissionFileUrl={submissionFileUrl}
          submissionFileName={submissionFileName}
          submissionFileType={submissionFileType}
          submissionNote={submissionNote}
          submittedAt={submittedAt}
          rejectMode={rejectMode}
          setRejectMode={setRejectMode}
          reason={reason}
          setReason={setReason}
          onApprove={onApprove}
          onReject={onReject}
          reviewing={reviewing}
          t={t}
        />
      )}

      {/* Assignee waiting view */}
      {isAssignee && isInReview && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            {t("submission.assigneeWaiting")}
          </div>
          <SubmissionPreview
            url={submissionUrl}
            fileUrl={submissionFileUrl}
            fileName={submissionFileName}
            fileType={submissionFileType}
            note={submissionNote}
            t={t}
            compact
          />
        </div>
      )}

      {/* Approved view (status: done) */}
      {isDone && (submissionUrl || submissionFileUrl) && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("submission.approvedHeader")}
          </div>
          <SubmissionPreview
            url={submissionUrl}
            fileUrl={submissionFileUrl}
            fileName={submissionFileName}
            fileType={submissionFileType}
            note={submissionNote}
            t={t}
            compact
          />
        </div>
      )}

      {/* Rejected — show reviewNote prominently above the form so the
          employee sees what they need to fix when they resubmit. */}
      {showForm && wasRejected && (
        <div className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-3">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-300">
            <CornerDownLeft className="h-3 w-3" />
            {t("submission.changesRequestedHeader")}
          </div>
          <p className="text-xs text-rose-200 whitespace-pre-wrap">
            {reviewNote}
          </p>
          {reviewedAt && (
            <p className="mt-1 text-[10px] text-rose-300/70">
              {new Date(reviewedAt).toLocaleString("en")}
            </p>
          )}
        </div>
      )}

      {/* Submission form — assignee only, when not in_review/done */}
      {showForm && (
        <div className="space-y-3">
          {/* Smart URL field */}
          <div>
            <label
              htmlFor={`sub-url-${taskId}`}
              className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400"
            >
              <span className="flex items-center gap-1">
                🔗 {t("submission.urlLabel")}
              </span>
              {linkUrl.trim() && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                    linkPreviewType.toneClass
                  )}
                >
                  <span>{linkPreviewType.icon}</span>
                  <span>{linkPreviewType.label}</span>
                </span>
              )}
            </label>
            <input
              id={`sub-url-${taskId}`}
              type="url"
              dir="ltr"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t("submission.urlPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* File / image drop zone */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
              📎 {t("submission.fileLabel")}
            </label>
            {!uploaded ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                disabled={uploading}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 transition",
                  uploading
                    ? "cursor-wait border-zinc-700 bg-zinc-900/40"
                    : dragging
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-950/40 hover:border-emerald-500/40 hover:bg-zinc-900/40"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    <span className="text-xs text-zinc-400">
                      {t("submission.uploading")}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload
                      className={cn(
                        "h-5 w-5",
                        dragging ? "text-emerald-300" : "text-zinc-500"
                      )}
                    />
                    <span className="text-xs text-zinc-300">
                      {dragging
                        ? t("submission.dropZoneActive")
                        : t("submission.dropZoneIdle")}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {t("submission.fileHint")}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <UploadedPreview
                file={uploaded}
                onRemove={removeFile}
                onReplace={() => fileInputRef.current?.click()}
                t={t}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_EXT}
              onChange={onPickFile}
              className="hidden"
            />
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor={`sub-note-${taskId}`}
              className="mb-1.5 block text-[11px] text-zinc-400"
            >
              {t("submission.noteLabel")}
            </label>
            <textarea
              id={`sub-note-${taskId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t("submission.notePlaceholder")}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* Big emerald submit button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("submission.submitting")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t("submission.submitButton")}
              </>
            )}
          </button>
        </div>
      )}

      {/* History list — small, collapsed below */}
      {submissions && submissions.length > 0 && (
        <details className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-[11px] text-zinc-400 open:bg-zinc-950/40">
          <summary className="cursor-pointer select-none text-zinc-300">
            {t("submission.history")} · {submissions.length}
          </summary>
          <ul className="mt-2 space-y-1">
            {submissions.slice(0, 10).map((s, idx) => {
              // Display revision label. When the column is null (legacy rows
              // saved before this migration), derive it from order: oldest
              // submission = Revision 1, etc. The list is descending so the
              // last item is the oldest.
              const totalCount = submissions.length;
              const fallbackRev = totalCount - idx;
              const rev = s.revisionNumber ?? fallbackRev;
              const isFinal = totalCount > 1 && idx === 0 && s.status === "approved";
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        isFinal
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-zinc-800/80 text-zinc-300"
                      )}
                      title={`Revision ${rev}`}
                    >
                      {isFinal ? "FINAL" : `R${rev}`}
                    </span>
                    <Clock className="h-3 w-3 text-zinc-500" />
                    {new Date(s.createdAt).toLocaleString("en", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="text-zinc-500">
                    {t(`submission.status.${s.status}`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Empty state — only when the viewer truly has nothing to do (e.g.
          a teammate browsing someone else's task that has no submission). */}
      {!showForm &&
        !showOwnerReview &&
        !isInReview &&
        !isDone &&
        !canSubmit &&
        !(submissionUrl || submissionFileUrl) && (
          <div className="rounded-md border border-dashed border-zinc-800 px-3 py-2 text-[11px] text-zinc-600">
            {t("submission.empty")}
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function UploadedPreview({
  file,
  onRemove,
  onReplace,
  t,
}: {
  file: UploadedFile;
  onRemove: () => void;
  onReplace: () => void;
  t: (key: string) => string;
}) {
  const isImage = file.type.startsWith("image/");
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
      <div className="flex items-start gap-3">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            className="h-16 w-16 shrink-0 rounded-md border border-zinc-800 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
            <FileText className="h-7 w-7 text-rose-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-zinc-100">
            {file.name}
          </div>
          <div className="text-[10px] text-zinc-500">
            {formatBytes(file.size)} · {file.type.split("/")[1]?.toUpperCase()}
          </div>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onReplace}
              className="text-[10px] text-emerald-400 hover:text-emerald-300"
            >
              {t("submission.replaceFile")}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-0.5 text-[10px] text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
              {t("submission.removeFile")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmissionPreview({
  url,
  fileUrl,
  fileName,
  fileType,
  note,
  t,
  compact,
}: {
  url: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  note: string | null;
  t: (key: string) => string;
  compact?: boolean;
}) {
  const linkType = detectLinkType(url);
  const isImage = fileType?.startsWith("image/");

  if (!url && !fileUrl && !note) return null;

  return (
    <div className={cn("space-y-2", compact ? "text-xs" : "text-sm")}>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border px-3 py-2 transition hover:brightness-125",
            linkType.toneClass
          )}
        >
          <span className="text-base leading-none">{linkType.icon}</span>
          <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold">
            {linkType.label}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs">{url}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </a>
      )}
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-stretch gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 transition hover:border-emerald-500/40"
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={fileName ?? "preview"}
              className="h-16 w-16 shrink-0 rounded-md border border-zinc-800 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
              <FileText className="h-7 w-7 text-rose-400" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-xs font-semibold text-zinc-100">
              {fileName ?? t("submission.attachment")}
            </span>
            <span className="text-[10px] text-zinc-500">
              {(fileType ?? "").split("/")[1]?.toUpperCase() || "FILE"}
            </span>
          </div>
          {isImage ? (
            <ImageIcon className="m-2 h-4 w-4 self-start text-zinc-600" />
          ) : (
            <FileText className="m-2 h-4 w-4 self-start text-zinc-600" />
          )}
        </a>
      )}
      {note && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300 whitespace-pre-wrap">
          {note}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  submissionUrl,
  submissionFileUrl,
  submissionFileName,
  submissionFileType,
  submissionNote,
  submittedAt,
  rejectMode,
  setRejectMode,
  reason,
  setReason,
  onApprove,
  onReject,
  reviewing,
  t,
}: {
  submissionUrl: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  submissionFileType: string | null;
  submissionNote: string | null;
  submittedAt: Date | string | null;
  rejectMode: boolean;
  setRejectMode: (v: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  reviewing: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
        <span className="font-semibold">{t("submission.reviewTitle")}</span>
        {submittedAt && (
          <span className="ms-auto text-[10px] text-amber-300/80">
            {new Date(submittedAt).toLocaleString("en", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>

      <SubmissionPreview
        url={submissionUrl}
        fileUrl={submissionFileUrl}
        fileName={submissionFileName}
        fileType={submissionFileType}
        note={submissionNote}
        t={t}
      />

      {!rejectMode ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={reviewing}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t("submission.approveButton")}
          </button>
          <button
            type="button"
            onClick={() => setRejectMode(true)}
            disabled={reviewing}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-rose-950 shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CornerDownLeft className="h-4 w-4" />
            {t("submission.rejectButton")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder={t("submission.reasonPlaceholderRich")}
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-rose-500/60 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectMode(false);
                setReason("");
              }}
              disabled={reviewing}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800"
            >
              <X className="h-3 w-3" />
              {t("action.cancel")}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={reviewing}
              className="flex items-center gap-1 rounded-md bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-rose-950 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {t("submission.send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
