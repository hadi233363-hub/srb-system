"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  MessageSquareWarning,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  createDeliveryAction,
  deleteDeliveryAction,
  setDeliveryStatusAction,
} from "@/app/projects/delivery-actions";

interface DeliveryRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  deliveryUrl: string | null;
  previewUrl: string | null;
  sentAt: Date | string | null;
  viewedAt: Date | string | null;
  changesRequestedAt: Date | string | null;
  approvedAt: Date | string | null;
  clientFeedback: string | null;
  notes: string | null;
  createdAt: Date | string;
  createdBy: { id: string; name: string } | null;
}

interface Props {
  projectId: string;
  deliveries: DeliveryRow[];
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  locale: "ar" | "en";
}

const STATUS_ORDER = ["drafting", "sent", "viewed", "changes_requested", "approved"];

const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  drafting: { ar: "تجهيز", en: "Drafting" },
  sent: { ar: "مرسل", en: "Sent" },
  viewed: { ar: "تمت المشاهدة", en: "Viewed" },
  changes_requested: { ar: "طلب تعديل", en: "Changes" },
  approved: { ar: "معتمد", en: "Approved" },
};

const STATUS_TONE: Record<string, string> = {
  drafting: "border-zinc-700 bg-zinc-900/40 text-zinc-300",
  sent: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  viewed: "border-violet-500/30 bg-violet-500/5 text-violet-300",
  changes_requested: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  approved: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
};

const KIND_LABEL: Record<string, { ar: string; en: string }> = {
  post: { ar: "بوست", en: "Post" },
  reel: { ar: "ريل", en: "Reel" },
  video: { ar: "فيديو", en: "Video" },
  photo: { ar: "صورة", en: "Photo" },
  other: { ar: "أخرى", en: "Other" },
};

export function ClientDeliveries({
  projectId,
  deliveries,
  canCreate,
  canEdit,
  canApprove,
  canDelete,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(deliveries.length > 0);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = deliveries.filter((d) => d.status === s).length;
    return acc;
  }, {});

  function onCreate(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createDeliveryAction(projectId, fd);
      if (!res.ok) {
        setError(res.message ?? "فشل");
      } else {
        setAdding(false);
      }
    });
  }

  function changeStatus(id: string, status: string, feedback?: string | null) {
    startTransition(async () => {
      await setDeliveryStatusAction({ deliveryId: id, status, feedback });
    });
  }

  function onDelete(id: string) {
    if (!confirm(isAr ? "حذف هذا التسليم؟" : "Delete this delivery?")) return;
    startTransition(async () => {
      await deleteDeliveryAction(id);
    });
  }

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-500/5">
      <header className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <Send className="h-5 w-5 text-violet-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "تسليمات العميل" : "Client deliveries"}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-violet-300/80">
              <span>{deliveries.length}</span>
              {STATUS_ORDER.map(
                (s) =>
                  counts[s] > 0 && (
                    <span
                      key={s}
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px]",
                        STATUS_TONE[s]
                      )}
                    >
                      {counts[s]} · {STATUS_LABEL[s][isAr ? "ar" : "en"]}
                    </span>
                  )
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {canCreate && !adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 text-[11px] text-violet-200 hover:border-violet-400/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "تسليم جديد" : "New delivery"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {open && (
        <div className="space-y-3 border-t border-violet-500/20 p-4">
          {adding && canCreate && (
            <form
              action={(fd) => onCreate(fd)}
              className="space-y-2 rounded-lg border border-violet-500/30 bg-zinc-900/40 p-3"
            >
              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "العنوان" : "Title"}
                  </span>
                  <input
                    type="text"
                    name="title"
                    required
                    maxLength={200}
                    placeholder={
                      isAr ? "مثلاً: ريل أكتوبر #٣" : "e.g. October Reel #3"
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "النوع" : "Kind"}
                  </span>
                  <select
                    name="kind"
                    defaultValue="post"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                  >
                    {Object.entries(KIND_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {isAr ? l.ar : l.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "رابط التسليم" : "Delivery URL"}
                  </span>
                  <input
                    type="url"
                    name="deliveryUrl"
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "رابط معاينة (اختياري)" : "Preview URL (optional)"}
                  </span>
                  <input
                    type="url"
                    name="previewUrl"
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] text-zinc-500">
                  {isAr ? "ملاحظات داخلية" : "Internal notes"}
                </span>
                <textarea
                  name="notes"
                  rows={2}
                  className="mt-1 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  <X className="h-3 w-3" />
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-9 items-center gap-1 rounded-md bg-violet-500/20 px-3 text-xs text-violet-200 transition hover:bg-violet-500/30 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {isAr ? "أضف" : "Add"}
                </button>
              </div>
            </form>
          )}

          {deliveries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isAr
                ? "ما فيه تسليمات بعد"
                : "No deliveries yet"}
            </div>
          ) : (
            <ul className="space-y-2">
              {deliveries.map((d) => (
                <DeliveryRowItem
                  key={d.id}
                  delivery={d}
                  canEdit={canEdit}
                  canApprove={canApprove}
                  canDelete={canDelete}
                  isAr={isAr}
                  isPending={isPending}
                  onChangeStatus={changeStatus}
                  onDelete={() => onDelete(d.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DeliveryRowItem({
  delivery,
  canEdit,
  canApprove,
  canDelete,
  isAr,
  isPending,
  onChangeStatus,
  onDelete,
}: {
  delivery: DeliveryRow;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  isAr: boolean;
  isPending: boolean;
  onChangeStatus: (
    id: string,
    status: string,
    feedback?: string | null
  ) => void;
  onDelete: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  const status = delivery.status;
  const sentSince = delivery.sentAt
    ? formatDuration(new Date(delivery.sentAt), new Date(), isAr)
    : null;

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                STATUS_TONE[status]
              )}
            >
              {STATUS_LABEL[status][isAr ? "ar" : "en"]}
            </span>
            <span className="rounded-full bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {(KIND_LABEL[delivery.kind] ?? KIND_LABEL.other)[isAr ? "ar" : "en"]}
            </span>
            {sentSince && (
              <span className="text-[10px] text-zinc-500">
                {isAr ? "أُرسل قبل" : "Sent"} {sentSince}
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-1 text-sm font-medium text-zinc-100">
            {delivery.title}
          </h3>
          {delivery.notes && (
            <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
              {delivery.notes}
            </p>
          )}
          {delivery.clientFeedback && (
            <p className="mt-1 rounded border-s-2 border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-200">
              <MessageSquareWarning className="me-1 inline h-3 w-3" />
              {delivery.clientFeedback}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
            {delivery.deliveryUrl && (
              <a
                href={delivery.deliveryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
              >
                <ExternalLink className="h-3 w-3" />
                {isAr ? "رابط التسليم" : "Delivery link"}
              </a>
            )}
            {delivery.previewUrl && (
              <a
                href={delivery.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
              >
                <Eye className="h-3 w-3" />
                {isAr ? "معاينة" : "Preview"}
              </a>
            )}
            {delivery.createdBy && (
              <span>
                {isAr ? "أنشأه" : "by"} {delivery.createdBy.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {canEdit && status === "drafting" && (
            <ActionButton
              onClick={() => onChangeStatus(delivery.id, "sent")}
              tone="sky"
              disabled={isPending}
              icon={Send}
              label={isAr ? "أرسل" : "Mark sent"}
            />
          )}
          {canEdit && status === "sent" && (
            <ActionButton
              onClick={() => onChangeStatus(delivery.id, "viewed")}
              tone="violet"
              disabled={isPending}
              icon={Eye}
              label={isAr ? "تمت المشاهدة" : "Viewed"}
            />
          )}
          {canEdit && (status === "sent" || status === "viewed") && !showFeedback && (
            <ActionButton
              onClick={() => setShowFeedback(true)}
              tone="amber"
              disabled={isPending}
              icon={MessageSquareWarning}
              label={isAr ? "تعديل" : "Changes"}
            />
          )}
          {canApprove && status !== "approved" && (
            <ActionButton
              onClick={() => onChangeStatus(delivery.id, "approved")}
              tone="emerald"
              disabled={isPending}
              icon={CheckCircle2}
              label={isAr ? "اعتمد" : "Approve"}
            />
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {showFeedback && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder={
              isAr
                ? "ملاحظات العميل / التعديلات المطلوبة"
                : "What changes did the client request?"
            }
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowFeedback(false)}
              className="h-8 rounded-md border border-zinc-800 px-2.5 text-[11px] text-zinc-400 hover:border-zinc-700"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                onChangeStatus(delivery.id, "changes_requested", feedback);
                setShowFeedback(false);
                setFeedback("");
              }}
              className="h-8 rounded-md bg-amber-500/20 px-2.5 text-[11px] text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {isAr ? "احفظ التعديل" : "Save change request"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ActionButton({
  onClick,
  tone,
  disabled,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  tone: "sky" | "violet" | "amber" | "emerald";
  disabled: boolean;
  icon: typeof Send;
  label: string;
}) {
  const styles: Record<string, string> = {
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:border-sky-400/50",
    violet:
      "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:border-violet-400/50",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400/50",
    emerald:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] disabled:opacity-50",
        styles[tone]
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function formatDuration(then: Date, now: Date, isAr: boolean): string {
  const ms = now.getTime() - then.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return isAr ? `${minutes} دقيقة` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isAr ? `${hours} ساعة` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return isAr ? `${days} يوم` : `${days}d`;
}
