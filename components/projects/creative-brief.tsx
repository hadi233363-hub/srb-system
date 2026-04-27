"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ClipboardCheck,
  FileText,
  Lock,
  PenLine,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  saveBriefAction,
  setBriefStageAction,
} from "@/app/projects/brief-actions";

interface BriefRow {
  approvalStage: string;
  approvedAt: Date | null;
  approvedBy: { id: string; name: string } | null;
  objective: string | null;
  targetAudience: string | null;
  styleNotes: string | null;
  refs: string | null;
  deliverables: string | null;
  platforms: string | null;
  sizes: string | null;
  notes: string | null;
}

interface Props {
  projectId: string;
  brief: BriefRow | null;
  // Permission gates resolved server-side and passed in.
  canEdit: boolean;
  canApprove: boolean;
  locale: "ar" | "en";
}

const STAGE_TONE: Record<string, string> = {
  draft: "bg-zinc-700/40 text-zinc-300 border-zinc-700",
  pending_review: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

const STAGE_LABEL: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسوّدة", en: "Draft" },
  pending_review: { ar: "قيد المراجعة", en: "Pending review" },
  approved: { ar: "معتمد", en: "Approved" },
};

interface Field {
  key: keyof BriefRow;
  labelAr: string;
  labelEn: string;
  placeholderAr: string;
  placeholderEn: string;
  multiline?: boolean;
}

const FIELDS: Field[] = [
  {
    key: "objective",
    labelAr: "الهدف",
    labelEn: "Objective",
    placeholderAr: "الهدف من المشروع — وش نبي نحقق؟",
    placeholderEn: "What is the goal of this project?",
    multiline: true,
  },
  {
    key: "targetAudience",
    labelAr: "الجمهور المستهدف",
    labelEn: "Target audience",
    placeholderAr: "العمر، الجنس، المنطقة، الاهتمامات",
    placeholderEn: "Age, gender, region, interests",
    multiline: true,
  },
  {
    key: "styleNotes",
    labelAr: "الستايل والمزاج",
    labelEn: "Style & mood",
    placeholderAr: "ألوان، نبرة، مرجع بصري",
    placeholderEn: "Colors, tone, visual references",
    multiline: true,
  },
  {
    key: "refs",
    labelAr: "المراجع والروابط",
    labelEn: "References & links",
    placeholderAr: "ضع كل رابط في سطر منفصل",
    placeholderEn: "One URL per line",
    multiline: true,
  },
  {
    key: "deliverables",
    labelAr: "المخرجات",
    labelEn: "Deliverables",
    placeholderAr: "كم بوست؟ كم ريل؟ كم فيديو طويل؟",
    placeholderEn: "How many posts, reels, long-form videos?",
    multiline: true,
  },
  {
    key: "platforms",
    labelAr: "المنصات",
    labelEn: "Platforms",
    placeholderAr: "Instagram, TikTok, YouTube",
    placeholderEn: "Instagram, TikTok, YouTube",
  },
  {
    key: "sizes",
    labelAr: "المقاسات والأبعاد",
    labelEn: "Sizes",
    placeholderAr: "1080×1080, 1080×1920, 16:9",
    placeholderEn: "1080×1080, 1080×1920, 16:9",
  },
  {
    key: "notes",
    labelAr: "ملاحظات إضافية",
    labelEn: "Additional notes",
    placeholderAr: "أي شي ثاني الفريق لازم يعرفه",
    placeholderEn: "Anything else the team should know",
    multiline: true,
  },
];

export function CreativeBrief({
  projectId,
  brief,
  canEdit,
  canApprove,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const stage = brief?.approvalStage ?? "draft";
  const isApproved = stage === "approved";
  const lockedForEdit = isApproved && !canApprove;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const filledCount = FIELDS.reduce((acc, f) => {
    const v = brief?.[f.key] as string | null;
    return acc + (v && v.trim().length > 0 ? 1 : 0);
  }, 0);
  const completion = Math.round((filledCount / FIELDS.length) * 100);

  function summary(): string {
    const lines: string[] = [];
    for (const f of FIELDS) {
      const v = brief?.[f.key] as string | null;
      if (!v?.trim()) continue;
      lines.push(`${isAr ? f.labelAr : f.labelEn}: ${v.split("\n").join(" / ")}`);
    }
    return lines.length > 0
      ? lines.join("\n")
      : isAr
      ? "البريف فاضي بعد."
      : "Brief is empty.";
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fall through silently
    }
  }

  async function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveBriefAction(projectId, formData);
      if (res.ok) {
        setEditing(false);
        setFlash(isAr ? "تم الحفظ" : "Saved");
        setTimeout(() => setFlash(null), 1800);
      } else {
        setFlash(res.message ?? (isAr ? "فشل الحفظ" : "Save failed"));
        setTimeout(() => setFlash(null), 2500);
      }
    });
  }

  function changeStage(next: "draft" | "pending_review" | "approved") {
    startTransition(async () => {
      await setBriefStageAction(projectId, next);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <header
        className="flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <FileText className="h-5 w-5 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "البريف الإبداعي" : "Creative brief"}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  STAGE_TONE[stage]
                )}
              >
                {(STAGE_LABEL[stage] ?? STAGE_LABEL.draft)[isAr ? "ar" : "en"]}
              </span>
              <span className="tabular-nums">
                {completion}% {isAr ? "مكتمل" : "complete"}
              </span>
              {brief?.approvedAt && brief.approvedBy && (
                <span className="hidden sm:inline">
                  {isAr ? "اعتمده" : "approved by"} {brief.approvedBy.name}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copySummary}
            className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 text-[11px] text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            aria-label={isAr ? "نسخ ملخص البريف" : "Copy brief summary"}
          >
            {copied ? (
              <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Clipboard className="h-3.5 w-3.5" />
            )}
            <Sparkles className="h-3 w-3 text-amber-400" />
            {isAr ? "ملخص" : "Summary"}
          </button>
          {canEdit && !editing && !lockedForEdit && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 text-[11px] text-emerald-300 transition hover:border-emerald-400/50"
            >
              <PenLine className="h-3.5 w-3.5" />
              {isAr ? "تعديل" : "Edit"}
            </button>
          )}
          {lockedForEdit && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Lock className="h-3 w-3" />
              {isAr ? "مقفل" : "Locked"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/60"
            aria-label={open ? "Collapse" : "Expand"}
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
        <div className="border-t border-zinc-800 p-4">
          {flash && (
            <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-300">
              {flash}
            </div>
          )}

          {editing && canEdit ? (
            <form
              action={(fd) => onSubmit(fd)}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              {FIELDS.map((f) => {
                const initial = (brief?.[f.key] as string | null) ?? "";
                return (
                  <div
                    key={f.key as string}
                    className={cn(f.multiline && "md:col-span-2")}
                  >
                    <label
                      htmlFor={`brief-${String(f.key)}`}
                      className="mb-1 block text-[11px] text-zinc-400"
                    >
                      {isAr ? f.labelAr : f.labelEn}
                    </label>
                    {f.multiline ? (
                      <textarea
                        id={`brief-${String(f.key)}`}
                        name={String(f.key)}
                        defaultValue={initial}
                        placeholder={isAr ? f.placeholderAr : f.placeholderEn}
                        rows={3}
                        className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                      />
                    ) : (
                      <input
                        id={`brief-${String(f.key)}`}
                        name={String(f.key)}
                        defaultValue={initial}
                        placeholder={isAr ? f.placeholderAr : f.placeholderEn}
                        className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-10 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 rounded-md bg-emerald-500/15 px-4 text-xs text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {isPending
                    ? isAr
                      ? "يحفظ..."
                      : "Saving..."
                    : isAr
                    ? "حفظ البريف"
                    : "Save brief"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {FIELDS.map((f) => {
                const v = (brief?.[f.key] as string | null) ?? "";
                return (
                  <div
                    key={f.key as string}
                    className="rounded-lg border border-zinc-800/60 p-3"
                  >
                    <div className="text-[11px] text-zinc-500">
                      {isAr ? f.labelAr : f.labelEn}
                    </div>
                    {v.trim().length > 0 ? (
                      <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-100">
                        {v}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-zinc-600">
                        {isAr ? "ما تعبّى بعد" : "Not filled in yet"}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Approval controls */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 pt-3">
                {canEdit && stage === "draft" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("pending_review")}
                    className="h-9 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 text-[11px] text-amber-300 disabled:opacity-50"
                  >
                    {isAr ? "أرسل للمراجعة" : "Submit for review"}
                  </button>
                )}
                {canEdit && stage === "pending_review" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("draft")}
                    className="h-9 rounded-md border border-zinc-800 px-3 text-[11px] text-zinc-300 disabled:opacity-50"
                  >
                    {isAr ? "إرجاع لمسوّدة" : "Back to draft"}
                  </button>
                )}
                {canApprove && stage !== "approved" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("approved")}
                    className="h-9 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 text-[11px] text-emerald-300 disabled:opacity-50"
                  >
                    <CheckCircle2 className="me-1 inline h-3.5 w-3.5" />
                    {isAr ? "اعتمد البريف" : "Approve brief"}
                  </button>
                )}
                {canApprove && stage === "approved" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => changeStage("draft")}
                    className="h-9 rounded-md border border-zinc-800 px-3 text-[11px] text-zinc-400 disabled:opacity-50"
                  >
                    {isAr ? "إعادة فتح" : "Re-open"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
