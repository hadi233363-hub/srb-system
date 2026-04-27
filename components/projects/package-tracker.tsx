"use client";

import { useState, useTransition } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Film,
  Image as ImageIcon,
  Layers,
  Minus,
  Package as PackageIcon,
  PenLine,
  Plus,
  Save,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  bumpPackageCompletedAction,
  savePackageAction,
} from "@/app/projects/package-actions";

interface PackageRow {
  targetPosts: number;
  targetReels: number;
  targetVideos: number;
  targetShoots: number;
  targetStories: number;
  completedPosts: number;
  completedReels: number;
  completedVideos: number;
  completedShoots: number;
  completedStories: number;
  notes: string | null;
}

interface Props {
  projectId: string;
  pkg: PackageRow | null;
  canEdit: boolean;
  locale: "ar" | "en";
}

interface Item {
  key:
    | "Posts"
    | "Reels"
    | "Videos"
    | "Shoots"
    | "Stories";
  labelAr: string;
  labelEn: string;
  icon: typeof ImageIcon;
}

const ITEMS: Item[] = [
  { key: "Posts", labelAr: "بوست", labelEn: "Posts", icon: ImageIcon },
  { key: "Reels", labelAr: "ريل", labelEn: "Reels", icon: Film },
  { key: "Videos", labelAr: "فيديو", labelEn: "Videos", icon: Video },
  { key: "Shoots", labelAr: "تصوير", labelEn: "Shoots", icon: Camera },
  { key: "Stories", labelAr: "ستوري", labelEn: "Stories", icon: Layers },
];

const EMPTY: PackageRow = {
  targetPosts: 0,
  targetReels: 0,
  targetVideos: 0,
  targetShoots: 0,
  targetStories: 0,
  completedPosts: 0,
  completedReels: 0,
  completedVideos: 0,
  completedShoots: 0,
  completedStories: 0,
  notes: null,
};

export function PackageTracker({ projectId, pkg, canEdit, locale }: Props) {
  const isAr = locale === "ar";
  const data: PackageRow = pkg ?? EMPTY;
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totals = ITEMS.reduce(
    (acc, item) => {
      const target = data[`target${item.key}` as keyof PackageRow] as number;
      const done = data[`completed${item.key}` as keyof PackageRow] as number;
      acc.target += target;
      acc.done += done;
      return acc;
    },
    { target: 0, done: 0 }
  );
  const overallPct =
    totals.target > 0
      ? Math.min(100, Math.round((totals.done / totals.target) * 100))
      : 0;

  // If there are no targets at all and the user can't edit, hide the card.
  // Saves visual noise on projects that don't use the package model.
  if (totals.target === 0 && totals.done === 0 && !canEdit) return null;

  function bump(field: string, delta: 1 | -1) {
    startTransition(async () => {
      await bumpPackageCompletedAction({ projectId, field, delta });
    });
  }

  async function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await savePackageAction(projectId, formData);
      if (res.ok) setEditing(false);
    });
  }

  return (
    <section className="rounded-xl border border-sky-500/30 bg-sky-500/5">
      <header className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <PackageIcon className="h-5 w-5 text-sky-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "الباقة (الالتزام مع العميل)" : "Package tracker"}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-sky-300/80">
              {totals.target > 0 ? (
                <>
                  <span className="tabular-nums">
                    {totals.done} / {totals.target}{" "}
                    {isAr ? "تم تسليمه" : "delivered"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    · {overallPct}%
                  </span>
                </>
              ) : (
                <span className="text-zinc-500">
                  {isAr
                    ? "ما تم تحديد أهداف بعد"
                    : "No targets set yet"}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setOpen(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 text-[11px] text-sky-200 hover:border-sky-400/50"
            >
              <PenLine className="h-3.5 w-3.5" />
              {isAr ? "تعديل الأهداف" : "Edit targets"}
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
        <div className="border-t border-sky-500/20 p-4">
          {editing && canEdit ? (
            <form
              action={(fd) => onSubmit(fd)}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      className="rounded-lg border border-sky-500/20 bg-zinc-900/40 p-3"
                    >
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-100">
                        <Icon className="h-3.5 w-3.5 text-sky-300" />
                        {isAr ? item.labelAr : item.labelEn}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500">
                            {isAr ? "الهدف" : "Target"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            name={`target${item.key}`}
                            defaultValue={
                              data[`target${item.key}` as keyof PackageRow] as number
                            }
                            className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-zinc-500">
                            {isAr ? "تم تسليمه" : "Delivered"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            name={`completed${item.key}`}
                            defaultValue={
                              data[
                                `completed${item.key}` as keyof PackageRow
                              ] as number
                            }
                            className="mt-1 h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm tabular-nums text-zinc-100 focus:border-zinc-700 focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="block">
                <span className="block text-[10px] text-zinc-500">
                  {isAr ? "ملاحظات على الباقة" : "Package notes"}
                </span>
                <textarea
                  name="notes"
                  defaultValue={data.notes ?? ""}
                  rows={2}
                  className="mt-1 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  placeholder={
                    isAr
                      ? "ضع أي تفاصيل عن الباقة (مثلاً: ٥ بوست شهرياً، حملة أسبوعين)"
                      : "Any notes about this package's scope"
                  }
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex h-10 items-center gap-1.5 rounded-md border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-zinc-700"
                >
                  <X className="h-3.5 w-3.5" />
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-10 items-center gap-1.5 rounded-md bg-sky-500/20 px-4 text-xs text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isAr ? "حفظ" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ITEMS.map((item) => {
                const target = data[`target${item.key}` as keyof PackageRow] as number;
                const done = data[`completed${item.key}` as keyof PackageRow] as number;
                if (target === 0 && done === 0) return null;
                const pct =
                  target > 0
                    ? Math.min(100, Math.round((done / target) * 100))
                    : 0;
                const Icon = item.icon;
                const completed = target > 0 && done >= target;
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-lg border p-3",
                      completed
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-sky-500/20 bg-zinc-900/40"
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                        <Icon className="h-3.5 w-3.5 text-sky-300" />
                        {isAr ? item.labelAr : item.labelEn}
                      </div>
                      {target > 0 && (
                        <span
                          className={cn(
                            "text-[10px] tabular-nums",
                            completed ? "text-emerald-300" : "text-sky-300"
                          )}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>
                    <div className="text-base font-bold tabular-nums text-zinc-100">
                      {done}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        / {target}
                      </span>
                    </div>
                    {/* Bar */}
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          "h-full transition-all",
                          completed ? "bg-emerald-400" : "bg-sky-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {canEdit && (
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => bump(`completed${item.key}`, -1)}
                          disabled={isPending || done === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:border-zinc-700 disabled:opacity-30"
                          aria-label="-1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => bump(`completed${item.key}`, +1)}
                          disabled={isPending}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50 disabled:opacity-50"
                          aria-label="+1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.notes && !editing && (
            <p className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-[12px] text-zinc-300">
              {data.notes}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
