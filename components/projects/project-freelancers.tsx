"use client";

import { useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code,
  DollarSign,
  Edit3,
  Mic,
  Palette,
  PenTool,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatQar } from "@/lib/db/helpers";
import {
  createFreelancerAction,
  deleteFreelancerAction,
  recordFreelancerPaymentAction,
  updateFreelancerAction,
} from "@/app/projects/freelancer-actions";

interface PaymentRow {
  id: string;
  amountQar: number;
  occurredAt: Date | string;
  description: string | null;
}

interface FreelancerRow {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  agreedAmountQar: number;
  paymentTerms: string | null;
  status: string;
  notes: string | null;
  createdAt: Date | string;
  payments: PaymentRow[];
}

interface Props {
  projectId: string;
  freelancers: FreelancerRow[];
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean; // mark a payment as paid
  canDelete: boolean;
  locale: "ar" | "en";
}

const ROLE_OPTIONS = [
  { key: "photographer", labelAr: "مصوّر", labelEn: "Photographer", icon: Camera, tone: "sky" },
  { key: "videographer", labelAr: "مصوّر فيديو", labelEn: "Videographer", icon: Video, tone: "indigo" },
  { key: "designer", labelAr: "ديزاينر", labelEn: "Designer", icon: Palette, tone: "pink" },
  { key: "editor", labelAr: "مونتير", labelEn: "Video editor", icon: Edit3, tone: "violet" },
  { key: "sound", labelAr: "صوت", labelEn: "Sound", icon: Mic, tone: "amber" },
  { key: "writer", labelAr: "كاتب محتوى", labelEn: "Copywriter", icon: PenTool, tone: "emerald" },
  { key: "developer", labelAr: "مطوّر", labelEn: "Developer", icon: Code, tone: "cyan" },
  { key: "other", labelAr: "أخرى", labelEn: "Other", icon: UserRound, tone: "zinc" },
] as const;

const ROLE_TONE: Record<string, string> = {
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  pink: "border-pink-500/30 bg-pink-500/10 text-pink-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  zinc: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
};

const STATUS_LABEL: Record<string, { ar: string; en: string }> = {
  active: { ar: "نشط", en: "Active" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

const STATUS_TONE: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  completed: "border-zinc-700 bg-zinc-800/40 text-zinc-400",
  cancelled: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

function roleSpec(role: string) {
  return ROLE_OPTIONS.find((r) => r.key === role) ?? ROLE_OPTIONS[ROLE_OPTIONS.length - 1];
}

export function ProjectFreelancers({
  projectId,
  freelancers,
  canCreate,
  canEdit,
  canApprove,
  canDelete,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(freelancers.length > 0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Aggregates for the header
  const totals = freelancers.reduce(
    (acc, f) => {
      const paid = f.payments.reduce((sum, p) => sum + p.amountQar, 0);
      acc.agreed += f.agreedAmountQar;
      acc.paid += paid;
      if (f.status === "active") acc.active += 1;
      return acc;
    },
    { agreed: 0, paid: 0, active: 0 }
  );
  const remaining = Math.max(0, totals.agreed - totals.paid);

  function flashMsg(m: string) {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  }

  function onCreate(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createFreelancerAction(projectId, fd);
      if (!res.ok) setError(res.message ?? (isAr ? "فشل" : "Failed"));
      else {
        setAdding(false);
        flashMsg(isAr ? "تم إضافة الفري لانسر" : "Freelancer added");
      }
    });
  }

  function onUpdate(freelancerId: string, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateFreelancerAction(freelancerId, fd);
      if (!res.ok) setError(res.message ?? "");
      else {
        setEditingId(null);
        flashMsg(isAr ? "تم الحفظ" : "Saved");
      }
    });
  }

  function onDelete(freelancerId: string, name: string) {
    if (
      !confirm(
        isAr
          ? `حذف ${name}؟ (إذا فيه دفعات مسجّلة راح يتحول لملغي)`
          : `Delete ${name}? (If payments exist it'll be cancelled instead)`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteFreelancerAction(freelancerId);
      if (res.ok && "cancelled" in res && res.cancelled) {
        flashMsg(res.message ?? (isAr ? "تم تحويله إلى ملغي" : "Moved to cancelled"));
      } else if (res.ok) {
        flashMsg(isAr ? "تم الحذف" : "Deleted");
      }
    });
  }

  function onPay(freelancerId: string, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await recordFreelancerPaymentAction(freelancerId, fd);
      if (!res.ok) setError(res.message ?? "");
      else {
        setPayingId(null);
        flashMsg(isAr ? "تم تسجيل الدفعة" : "Payment recorded");
      }
    });
  }

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <Users className="h-5 w-5 text-amber-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "الفري لانسرز (موظفو المشروع)" : "Project freelancers"}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-amber-300/80">
              <span>
                {freelancers.length}{" "}
                {isAr ? `(${totals.active} نشط)` : `(${totals.active} active)`}
              </span>
              {totals.agreed > 0 && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span>
                    {isAr ? "متفق عليه" : "Agreed"}: {formatQar(totals.agreed, { locale })}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className={remaining === 0 ? "text-emerald-300" : "text-amber-200"}>
                    {isAr ? "مدفوع" : "Paid"}: {formatQar(totals.paid, { locale })}
                  </span>
                  {remaining > 0 && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-rose-300">
                        {isAr ? "متبقي" : "Outstanding"}: {formatQar(remaining, { locale })}
                      </span>
                    </>
                  )}
                </>
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
              className="flex h-9 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] text-amber-200 hover:border-amber-400/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "أضف فري لانسر" : "Add freelancer"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {open && (
        <div className="space-y-3 border-t border-amber-500/20 p-4">
          {flash && (
            <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-1.5 text-[11px] text-emerald-300">
              {flash}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
              {error}
            </div>
          )}

          {adding && canCreate && (
            <FreelancerForm
              isAr={isAr}
              isPending={isPending}
              onCancel={() => {
                setAdding(false);
                setError(null);
              }}
              onSubmit={onCreate}
              submitLabel={isAr ? "أضف" : "Add"}
            />
          )}

          {freelancers.length === 0 && !adding ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isAr
                ? "ما فيه فري لانسرز على هذا المشروع. أضف مصوّر / ديزاينر / مونتير ... كلهم يوصل معاشهم من ميزانية المشروع."
                : "No freelancers on this project yet. Add photographers / designers / editors — their pay comes out of this project's budget."}
            </div>
          ) : (
            <ul className="space-y-2">
              {freelancers.map((f) => (
                <li key={f.id}>
                  <FreelancerCard
                    freelancer={f}
                    isAr={isAr}
                    locale={locale}
                    isPending={isPending}
                    canEdit={canEdit}
                    canApprove={canApprove}
                    canDelete={canDelete}
                    isEditing={editingId === f.id}
                    isPaying={payingId === f.id}
                    onEdit={() => {
                      setEditingId(f.id);
                      setPayingId(null);
                      setError(null);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onSubmitEdit={(fd) => onUpdate(f.id, fd)}
                    onStartPay={() => {
                      setPayingId(f.id);
                      setEditingId(null);
                      setError(null);
                    }}
                    onCancelPay={() => setPayingId(null)}
                    onSubmitPay={(fd) => onPay(f.id, fd)}
                    onDelete={() => onDelete(f.id, f.name)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FreelancerCard({
  freelancer: f,
  isAr,
  locale,
  isPending,
  canEdit,
  canApprove,
  canDelete,
  isEditing,
  isPaying,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
  onStartPay,
  onCancelPay,
  onSubmitPay,
  onDelete,
}: {
  freelancer: FreelancerRow;
  isAr: boolean;
  locale: "ar" | "en";
  isPending: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  isEditing: boolean;
  isPaying: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (fd: FormData) => void;
  onStartPay: () => void;
  onCancelPay: () => void;
  onSubmitPay: (fd: FormData) => void;
  onDelete: () => void;
}) {
  const role = roleSpec(f.role);
  const RoleIcon = role.icon;
  const paid = f.payments.reduce((sum, p) => sum + p.amountQar, 0);
  const remaining = Math.max(0, f.agreedAmountQar - paid);
  const overpaid = paid > f.agreedAmountQar;
  const fullyPaid = f.agreedAmountQar > 0 && paid >= f.agreedAmountQar;
  const pct =
    f.agreedAmountQar > 0
      ? Math.min(100, Math.round((paid / f.agreedAmountQar) * 100))
      : 0;

  const phoneE164 = f.phone?.replace(/[^\d+]/g, "");

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                ROLE_TONE[role.tone]
              )}
            >
              <RoleIcon className="h-3 w-3" />
              {isAr ? role.labelAr : role.labelEn}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                STATUS_TONE[f.status] ?? STATUS_TONE.active
              )}
            >
              {(STATUS_LABEL[f.status] ?? STATUS_LABEL.active)[isAr ? "ar" : "en"]}
            </span>
            {fullyPaid && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                <CheckCircle2 className="me-0.5 inline h-3 w-3" />
                {isAr ? "تم الدفع كامل" : "Fully paid"}
              </span>
            )}
            {overpaid && (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
                {isAr ? "تجاوز المتفق" : "Over agreed"}
              </span>
            )}
          </div>

          <h3 className="mt-1 text-sm font-semibold text-zinc-100">{f.name}</h3>

          {(f.phone || f.email) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
              {f.phone && (
                <a
                  href={`tel:${phoneE164}`}
                  className="inline-flex items-center gap-1 hover:text-zinc-200"
                  dir="ltr"
                >
                  <Phone className="h-3 w-3" />
                  {f.phone}
                </a>
              )}
              {f.email && (
                <a
                  href={`mailto:${f.email}`}
                  className="hover:text-zinc-200"
                  dir="ltr"
                >
                  {f.email}
                </a>
              )}
            </div>
          )}

          {f.paymentTerms && (
            <p className="mt-1 text-[11px] text-zinc-500">
              {isAr ? "شروط الدفع" : "Terms"}: {f.paymentTerms}
            </p>
          )}
          {f.notes && (
            <p className="mt-0.5 text-[11px] text-zinc-500">{f.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {canApprove && f.status === "active" && (
            <button
              type="button"
              onClick={onStartPay}
              disabled={isPending || isPaying}
              className="flex h-8 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] text-emerald-300 hover:border-emerald-400/50 disabled:opacity-50"
            >
              <DollarSign className="h-3 w-3" />
              {isAr ? "سجّل دفعة" : "Record payment"}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 items-center gap-1 rounded-md border border-zinc-800 px-2 text-[11px] text-zinc-300 hover:border-zinc-700"
            >
              <Edit3 className="h-3 w-3" />
              {isAr ? "عدّل" : "Edit"}
            </button>
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

      {/* Money summary + progress bar */}
      {(f.agreedAmountQar > 0 || paid > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Money
            label={isAr ? "متفق عليه" : "Agreed"}
            value={formatQar(f.agreedAmountQar, { locale })}
            tone="zinc"
          />
          <Money
            label={isAr ? "مدفوع" : "Paid"}
            value={formatQar(paid, { locale })}
            tone={fullyPaid ? "emerald" : "sky"}
          />
          <Money
            label={isAr ? "متبقي" : "Remaining"}
            value={formatQar(overpaid ? -1 * (paid - f.agreedAmountQar) : remaining, {
              locale,
              sign: overpaid,
            })}
            tone={remaining === 0 ? "emerald" : "rose"}
          />
        </div>
      )}
      {f.agreedAmountQar > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              "h-full transition-all",
              fullyPaid ? "bg-emerald-400" : "bg-sky-400",
              overpaid && "bg-rose-400"
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}

      {/* Payment history */}
      {f.payments.length > 0 && (
        <details className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1.5 text-[11px] open:bg-zinc-950/60">
          <summary className="cursor-pointer select-none text-zinc-300">
            <Wallet className="me-1 inline h-3 w-3" />
            {isAr ? "سجل الدفعات" : "Payment history"} · {f.payments.length}
          </summary>
          <ul className="mt-1.5 space-y-1">
            {f.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800/60 bg-zinc-900/40 px-2 py-1"
              >
                <span className="line-clamp-1 text-zinc-400">
                  {p.description ??
                    new Date(p.occurredAt).toLocaleDateString("en-US")}
                </span>
                <span className="font-semibold tabular-nums text-zinc-100">
                  −{formatQar(p.amountQar, { locale })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Inline payment form */}
      {isPaying && canApprove && (
        <form
          action={(fd) => onSubmitPay(fd)}
          className="mt-3 space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="block text-[10px] text-zinc-500">
                {isAr ? "المبلغ (ر.ق)" : "Amount (QAR)"}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amountQar"
                required
                defaultValue={remaining > 0 ? remaining : ""}
                placeholder={remaining > 0 ? String(remaining) : "0"}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] text-zinc-500">
                {isAr ? "تاريخ الدفع" : "Date"}
              </span>
              <input
                type="date"
                name="occurredAt"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="block text-[10px] text-zinc-500">
                {isAr ? "ملاحظات (اختياري)" : "Note (optional)"}
              </span>
              <input
                type="text"
                name="description"
                placeholder={
                  isAr
                    ? `دفعة لـ ${f.name} (${role.labelAr})`
                    : `Payment to ${f.name}`
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
              />
            </label>
          </div>
          <p className="text-[10px] text-emerald-300/70">
            {isAr
              ? "هذي الدفعة تُسجَّل كمصروف على المشروع وتُخصَم من ربحيته تلقائياً."
              : "Recorded as a project expense; project profit updates automatically."}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelPay}
              className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
            >
              <X className="h-3 w-3" />
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-9 items-center gap-1 rounded-md bg-emerald-500/20 px-3 text-xs text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <DollarSign className="h-3 w-3" />
              {isAr ? "سجّل الدفعة" : "Record payment"}
            </button>
          </div>
        </form>
      )}

      {/* Inline edit form */}
      {isEditing && canEdit && (
        <FreelancerForm
          isAr={isAr}
          isPending={isPending}
          initial={f}
          showStatus
          onCancel={onCancelEdit}
          onSubmit={(fd) => onSubmitEdit(fd)}
          submitLabel={isAr ? "احفظ" : "Save"}
        />
      )}
    </div>
  );
}

function FreelancerForm({
  initial,
  isAr,
  isPending,
  onCancel,
  onSubmit,
  submitLabel,
  showStatus,
}: {
  initial?: Partial<FreelancerRow>;
  isAr: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
  submitLabel: string;
  showStatus?: boolean;
}) {
  return (
    <form
      action={(fd) => onSubmit(fd)}
      className="mt-3 space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "الاسم" : "Name"}
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={200}
            defaultValue={initial?.name ?? ""}
            placeholder={isAr ? "مثلاً: أحمد المصور" : "e.g. Ahmed (photographer)"}
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "التخصص" : "Role"}
          </span>
          <select
            name="role"
            defaultValue={initial?.role ?? "photographer"}
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {isAr ? r.labelAr : r.labelEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "الجوال (اختياري)" : "Phone (optional)"}
          </span>
          <input
            type="tel"
            name="phone"
            maxLength={40}
            defaultValue={initial?.phone ?? ""}
            placeholder="+974 ..."
            dir="ltr"
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "الإيميل (اختياري)" : "Email (optional)"}
          </span>
          <input
            type="email"
            name="email"
            maxLength={200}
            defaultValue={initial?.email ?? ""}
            dir="ltr"
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "المبلغ المتفق عليه (ر.ق)" : "Agreed amount (QAR)"}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="agreedAmountQar"
            defaultValue={initial?.agreedAmountQar ?? 0}
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] text-zinc-500">
            {isAr ? "شروط الدفع" : "Payment terms"}
          </span>
          <input
            type="text"
            name="paymentTerms"
            maxLength={400}
            defaultValue={initial?.paymentTerms ?? ""}
            placeholder={
              isAr
                ? "مثلاً: ٥٠٪ مقدّم + ٥٠٪ عند التسليم"
                : "e.g. 50% upfront, 50% on delivery"
            }
            className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
          />
        </label>
        {showStatus && (
          <label className="block sm:col-span-2">
            <span className="block text-[10px] text-zinc-500">
              {isAr ? "الحالة" : "Status"}
            </span>
            <select
              name="status"
              defaultValue={initial?.status ?? "active"}
              className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
            >
              {Object.keys(STATUS_LABEL).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s][isAr ? "ar" : "en"]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="block">
        <span className="block text-[10px] text-zinc-500">
          {isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}
        </span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className="mt-1 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 items-center gap-1 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
        >
          <X className="h-3 w-3" />
          {isAr ? "إلغاء" : "Cancel"}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-9 items-center gap-1 rounded-md bg-amber-500/20 px-3 text-xs text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Money({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "zinc" | "sky" | "emerald" | "rose";
}) {
  const t: Record<string, string> = {
    zinc: "text-zinc-100",
    sky: "text-sky-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
  };
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-2">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold tabular-nums", t[tone])}>
        {value}
      </div>
    </div>
  );
}

