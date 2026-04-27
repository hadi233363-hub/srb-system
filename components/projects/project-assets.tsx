"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addAssetAction,
  deleteAssetAction,
} from "@/app/projects/asset-actions";

interface AssetRow {
  id: string;
  kind: string;
  title: string | null;
  caption: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  externalUrl: string | null;
  createdAt: Date | string;
  addedBy: { id: string; name: string } | null;
}

interface Props {
  projectId: string;
  assets: AssetRow[];
  canCreate: boolean;
  canDelete: boolean;
  locale: "ar" | "en";
}

const KINDS = [
  { key: "moodboard", labelAr: "موود بورد", labelEn: "Moodboard" },
  { key: "reference", labelAr: "مراجع", labelEn: "References" },
  { key: "brand", labelAr: "أصول الهوية", labelEn: "Brand assets" },
  { key: "deliverable", labelAr: "مخرجات نهائية", labelEn: "Final deliverables" },
  { key: "other", labelAr: "أخرى", labelEn: "Other" },
] as const;

const KIND_TONE: Record<string, string> = {
  moodboard: "border-pink-500/30 bg-pink-500/5",
  reference: "border-sky-500/30 bg-sky-500/5",
  brand: "border-amber-500/30 bg-amber-500/5",
  deliverable: "border-emerald-500/30 bg-emerald-500/5",
  other: "border-zinc-700 bg-zinc-900/40",
};

function isImageMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function ProjectAssets({
  projectId,
  assets,
  canCreate,
  canDelete,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered =
    activeKind === "all"
      ? assets
      : assets.filter((a) => a.kind === activeKind);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addAssetAction(projectId, formData);
      if (!res.ok) {
        setError(res.message ?? (isAr ? "فشل الإضافة" : "Failed"));
      } else {
        setAdding(false);
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm(isAr ? "حذف هذا العنصر؟" : "Delete this asset?")) return;
    startTransition(async () => {
      await deleteAssetAction(id);
    });
  }

  return (
    <section className="rounded-xl border border-pink-500/30 bg-pink-500/5">
      <header className="flex items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-start"
        >
          <Layers className="h-5 w-5 text-pink-300" />
          <div>
            <h2 className="text-lg font-semibold">
              {isAr ? "الموود بورد والأصول" : "Moodboard & assets"}
            </h2>
            <div className="mt-0.5 text-[11px] text-pink-300/80">
              {assets.length}{" "}
              {isAr ? "عنصر مرفوع" : "assets uploaded"}
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
              className="flex h-9 items-center gap-1.5 rounded-md border border-pink-500/30 bg-pink-500/10 px-2.5 text-[11px] text-pink-200 hover:border-pink-400/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? "أضف" : "Add"}
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
        <div className="border-t border-pink-500/20 p-4">
          {/* Kind filter chips */}
          {assets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <KindChip
                active={activeKind === "all"}
                onClick={() => setActiveKind("all")}
                label={isAr ? "الكل" : "All"}
                count={assets.length}
              />
              {KINDS.map((k) => {
                const count = assets.filter((a) => a.kind === k.key).length;
                if (count === 0) return null;
                return (
                  <KindChip
                    key={k.key}
                    active={activeKind === k.key}
                    onClick={() => setActiveKind(k.key)}
                    label={isAr ? k.labelAr : k.labelEn}
                    count={count}
                  />
                );
              })}
            </div>
          )}

          {adding && canCreate && (
            <form
              action={(fd) => onSubmit(fd)}
              className="mb-3 space-y-2 rounded-lg border border-pink-500/30 bg-zinc-900/40 p-3"
              encType="multipart/form-data"
            >
              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "النوع" : "Kind"}
                  </span>
                  <select
                    name="kind"
                    defaultValue="moodboard"
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                  >
                    {KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {isAr ? k.labelAr : k.labelEn}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "العنوان (اختياري)" : "Title (optional)"}
                  </span>
                  <input
                    type="text"
                    name="title"
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] text-zinc-500">
                  {isAr ? "وصف قصير" : "Short caption"}
                </span>
                <input
                  type="text"
                  name="caption"
                  maxLength={300}
                  className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "ملف (JPG/PNG/PDF)" : "File (JPG/PNG/PDF)"}
                  </span>
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/gif,application/pdf"
                    className="mt-1 block w-full text-xs text-zinc-300 file:me-2 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2.5 file:py-1.5 file:text-zinc-200 hover:file:bg-zinc-700"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-zinc-500">
                    {isAr ? "أو رابط خارجي" : "Or external URL"}
                  </span>
                  <input
                    type="url"
                    name="externalUrl"
                    placeholder="https://..."
                    className="mt-1 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </label>
              </div>
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
                  className="flex h-9 items-center gap-1 rounded-md bg-pink-500/20 px-3 text-xs text-pink-200 transition hover:bg-pink-500/30 disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {isAr ? "ارفع" : "Upload"}
                </button>
              </div>
            </form>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
              {isAr
                ? "ما فيه عناصر هنا بعد"
                : "No assets here yet"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  canDelete={canDelete}
                  onDelete={() => onDelete(a.id)}
                  isAr={isAr}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function KindChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] transition",
        active
          ? "border-pink-400/60 bg-pink-500/15 text-pink-100"
          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      )}
    >
      {label}
      <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] tabular-nums">
        {count}
      </span>
    </button>
  );
}

function AssetCard({
  asset,
  canDelete,
  onDelete,
  isAr,
}: {
  asset: AssetRow;
  canDelete: boolean;
  onDelete: () => void;
  isAr: boolean;
}) {
  const isImage = isImageMime(asset.fileType);
  const target = asset.externalUrl ?? asset.fileUrl ?? "#";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border",
        KIND_TONE[asset.kind] ?? KIND_TONE.other
      )}
    >
      <a href={target} target="_blank" rel="noreferrer" className="block">
        <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-950">
          {asset.fileUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.fileUrl}
              alt={asset.title ?? asset.caption ?? "asset"}
              className="h-full w-full object-cover transition group-hover:scale-105"
              loading="lazy"
            />
          ) : asset.externalUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
              <ExternalLink className="h-6 w-6" />
              <span className="line-clamp-2 px-2 text-center text-[10px]" dir="ltr">
                {asset.externalUrl}
              </span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              {asset.fileType === "application/pdf" ? (
                <FileText className="h-8 w-8" />
              ) : (
                <ImageIcon className="h-8 w-8" />
              )}
            </div>
          )}
        </div>
        <div className="p-2">
          <div className="line-clamp-1 text-xs font-medium text-zinc-100">
            {asset.title || asset.fileName || asset.kind}
          </div>
          {asset.caption && (
            <div className="line-clamp-2 text-[10px] text-zinc-400">
              {asset.caption}
            </div>
          )}
          {asset.addedBy && (
            <div className="mt-0.5 text-[9px] text-zinc-600">
              {isAr ? "أضافه" : "by"} {asset.addedBy.name}
            </div>
          )}
        </div>
      </a>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute end-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md bg-zinc-950/80 text-rose-400 hover:bg-rose-500/20 group-hover:flex"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
