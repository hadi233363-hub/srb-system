"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Palette,
  Upload,
  Check,
  RotateCcw,
  Briefcase,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import { saveThemeAction, uploadLogoAction } from "./actions";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

const DEFAULT_BRAND = "#10b981";
const DEFAULT_ACCENT = "#0ea5e9";

const PRESETS: { key: string; brand: string; accent: string }[] = [
  { key: "theme.preset.default", brand: "#10b981", accent: "#0ea5e9" },
  { key: "theme.preset.blue", brand: "#3b82f6", accent: "#06b6d4" },
  { key: "theme.preset.purple", brand: "#a855f7", accent: "#ec4899" },
  { key: "theme.preset.gold", brand: "#d4a017", accent: "#f59e0b" },
  { key: "theme.preset.rose", brand: "#f43f5e", accent: "#f97316" },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  initialBrand: string;
  initialAccent: string;
  logoPath: string;
}

export function ThemeEditor({ initialBrand, initialAccent, logoPath }: Props) {
  const t = useT();
  const [brand, setBrand] = useState(initialBrand || DEFAULT_BRAND);
  const [accent, setAccent] = useState(initialAccent || DEFAULT_ACCENT);
  const [currentLogo, setCurrentLogo] = useState(logoPath);
  const [isPending, startTransition] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [uploadState, setUploadState] = useState<"idle" | "done" | "failed">("idle");
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live preview — push the chosen colors into the real <html> style so the
  // entire rest of the UI (sidebar, topbar, buttons) reflects the change before save.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-brand", brand);
    root.style.setProperty("--color-brand-dim", hexToRgba(brand, 0.1));
    root.style.setProperty("--color-brand-border", hexToRgba(brand, 0.3));
  }, [brand]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-accent", accent);
    root.style.setProperty("--color-accent-dim", hexToRgba(accent, 0.1));
  }, [accent]);

  const applyPreset = (p: { brand: string; accent: string }) => {
    setBrand(p.brand);
    setAccent(p.accent);
  };

  const reset = () => applyPreset({ brand: DEFAULT_BRAND, accent: DEFAULT_ACCENT });

  const save = () => {
    startTransition(async () => {
      const res = await saveThemeAction({ brandColor: brand, accentColor: accent });
      if (res.ok) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2200);
      }
    });
  };

  const onUpload = (file: File) => {
    setUploadErr(null);
    setUploadState("idle");
    const formData = new FormData();
    formData.append("logo", file);
    startUpload(async () => {
      const res = await uploadLogoAction(formData);
      if (res.ok && res.logoPath) {
        setCurrentLogo(res.logoPath);
        setUploadState("done");
        setTimeout(() => setUploadState("idle"), 2500);
      } else {
        setUploadErr(res.error ?? "upload failed");
        setUploadState("failed");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Left: controls */}
      <div className="space-y-5 lg:col-span-2">
        {/* Brand color */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Palette className="h-4 w-4" style={{ color: brand }} />
            {t("theme.field.brand")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-lg border border-zinc-700 bg-transparent"
            />
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="#10b981"
              className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 tabular-nums focus:border-emerald-500/50 focus:outline-none"
              dir="ltr"
            />
            <span
              className="h-11 flex-1 rounded-lg border border-zinc-700"
              style={{ background: brand }}
            />
          </div>
        </section>

        {/* Accent color */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Palette className="h-4 w-4" style={{ color: accent }} />
            {t("theme.field.accent")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-lg border border-zinc-700 bg-transparent"
            />
            <input
              type="text"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#0ea5e9"
              className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 tabular-nums focus:border-emerald-500/50 focus:outline-none"
              dir="ltr"
            />
            <span
              className="h-11 flex-1 rounded-lg border border-zinc-700"
              style={{ background: accent }}
            />
          </div>
        </section>

        {/* Presets */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 text-xs font-semibold text-zinc-400">
            {t("theme.presets")}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={cn(
                  "group flex h-16 flex-col items-center justify-center gap-1 rounded-lg border transition",
                  brand === p.brand && accent === p.accent
                    ? "border-zinc-600"
                    : "border-zinc-800 hover:border-zinc-700"
                )}
                title={t(p.key)}
              >
                <div className="flex gap-0.5">
                  <span
                    className="h-6 w-6 rounded-full"
                    style={{ background: p.brand }}
                  />
                  <span
                    className="h-6 w-6 rounded-full"
                    style={{ background: p.accent }}
                  />
                </div>
                <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300">
                  {t(p.key)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Logo upload */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 text-sm font-semibold text-zinc-200">
            {t("theme.field.logo")}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl bg-zinc-950 p-2">
              <img
                src={currentLogo}
                alt="logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" />
                {isUploading
                  ? t("theme.logo.uploading")
                  : uploadState === "done"
                  ? t("theme.logo.uploaded")
                  : t("theme.logo.change")}
              </button>
              <div className="text-[10px] text-zinc-600">
                {uploadErr ? (
                  <span className="text-rose-400">
                    {t("theme.logo.failed")} — {uploadErr}
                  </span>
                ) : (
                  t("theme.logo.hint")
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-zinc-950 transition disabled:opacity-60"
            style={{ background: brand }}
          >
            {saveState === "saved" ? (
              <>
                <Check className="h-4 w-4" />
                {t("theme.saved")}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {t("theme.save")}
              </>
            )}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            {t("theme.reset")}
          </button>
        </div>
      </div>

      {/* Right: live preview */}
      <div className="lg:col-span-3">
        <div className="sticky top-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-4 text-xs font-semibold text-zinc-400">
            {t("theme.preview.title")}
          </div>

          {/* KPI row */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <PreviewKpi
              icon={Briefcase}
              label={t("theme.preview.sampleCard")}
              value="12"
              tone="brand"
              brand={brand}
            />
            <PreviewKpi
              icon={TrendingUp}
              label={t("theme.preview.sampleAccent")}
              value="+24%"
              tone="accent"
              accent={accent}
            />
          </div>

          {/* Buttons + badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <button
              className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-950"
              style={{ background: brand }}
            >
              {t("theme.preview.sampleButton")}
            </button>
            <button
              className="rounded-lg border px-4 py-2 text-sm"
              style={{
                borderColor: hexToRgba(brand, 0.4),
                color: brand,
                background: hexToRgba(brand, 0.05),
              }}
            >
              {t("theme.preview.samplePrimary")}
            </button>
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: hexToRgba(brand, 0.1),
                color: brand,
              }}
            >
              {t("theme.preview.sampleBadge")}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: hexToRgba(accent, 0.1),
                color: accent,
              }}
            >
              {t("theme.preview.sampleAccent")}
            </span>
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-400">
              Danger
            </span>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
              Warning
            </span>
          </div>

          {/* Sample task card */}
          <div
            className="mb-4 rounded-lg border-2 p-4"
            style={{
              borderColor: hexToRgba(accent, 0.4),
              background: hexToRgba(accent, 0.03),
            }}
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
              <AlertCircle className="h-3 w-3" />
              Sample task · due in 2 days
            </div>
            <div className="mb-1 text-sm font-semibold text-zinc-100">
              Design social media campaign
            </div>
            <div className="text-[11px] text-zinc-500">
              Assigned to <Users className="inline h-3 w-3" /> Ahmed
            </div>
          </div>

          {/* Accent bar (progress) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Project progress</span>
              <span className="tabular-nums text-zinc-300">65%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full"
                style={{ background: accent, width: "65%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewKpi({
  icon: Icon,
  label,
  value,
  tone,
  brand,
  accent,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  tone: "brand" | "accent";
  brand?: string;
  accent?: string;
}) {
  const color = tone === "brand" ? brand! : accent!;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
