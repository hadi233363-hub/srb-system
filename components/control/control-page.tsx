"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Radio,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSim } from "../sim-provider";
import { ScenarioCard } from "./scenario-card";
import { ScenarioLibrary } from "./scenario-library";
import { ManualActions } from "./manual-actions";
import { DecisionLog } from "./decision-log";
import { CapacityPanel } from "./capacity-panel";
import { GrowthFunnel } from "./growth-funnel";
import { HireDialog } from "./hire-dialog";
import type { Role, Seniority } from "@/lib/sim/types";
import { formatQAR } from "@/lib/format";

export function ControlPage() {
  const { state, connected } = useSim();
  const pendingRef = useRef<HTMLDivElement | null>(null);
  const hireRef = useRef<HTMLDivElement | null>(null);
  const [hireOpen, setHireOpen] = useState<{
    open: boolean;
    role?: Role;
    seniority?: Seniority;
  }>({ open: false });
  const [hireFlash, setHireFlash] = useState<string | null>(null);

  const openHire = (role?: Role, seniority?: Seniority) => {
    setHireOpen({ open: true, role, seniority });
    requestAnimationFrame(() => {
      hireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const onHireConfirmed = (message: string) => {
    setHireFlash(message);
    setTimeout(() => setHireFlash(null), 3500);
  };

  const pendingSorted = useMemo(() => {
    if (!state) return [];
    const order = { high: 0, medium: 1, low: 2 };
    return [...state.scenarios].sort((a, b) => {
      const u = order[a.urgency] - order[b.urgency];
      if (u !== 0) return u;
      return a.expiresAt - b.expiresAt;
    });
  }, [state]);

  const metrics = useMemo(() => {
    if (!state) {
      return { totalImpact: 0, positiveCount: 0, negativeCount: 0 };
    }
    let totalImpact = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    for (const d of state.decisionLog) {
      totalImpact += d.financialImpact;
      const positiveOutcomes = d.actualOutcomes.filter(
        (o) => o.happened && o.tone === "positive"
      ).length;
      const negativeOutcomes = d.actualOutcomes.filter(
        (o) => o.happened && o.tone === "negative"
      ).length;
      if (positiveOutcomes > negativeOutcomes) positiveCount++;
      else if (negativeOutcomes > positiveOutcomes) negativeCount++;
    }
    return { totalImpact, positiveCount, negativeCount };
  }, [state]);

  const scrollToPending = () => {
    requestAnimationFrame(() => {
      pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (!state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        <Radio className="ml-2 h-4 w-4 animate-pulse" />
        يتصل بغرفة القرارات...
      </div>
    );
  }

  const urgentCount = state.scenarios.filter((s) => s.urgency === "high").length;

  return (
    <div className="space-y-8">
      {/* HEADER + MISSION CONTROL BAR */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-widest text-emerald-500">
              <span className="relative flex h-2 w-2">
                {connected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              CEO MODE · مباشر
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">غرفة القرارات</h1>
            <p className="mt-1 text-sm text-zinc-500">
              المكان الوحيد اللي كل كليك يتحول لعواقب حقيقية — فلوس، موظفين، مشاريع.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill
              icon={Inbox}
              label="قرارات معلّقة"
              value={state.scenarios.length}
              accent={urgentCount > 0 ? "rose" : "zinc"}
              sub={urgentCount > 0 ? `${urgentCount} عاجل` : "ما فيه عاجل"}
            />
            <StatPill
              icon={ClipboardList}
              label="قرارات سابقة"
              value={state.counters.decisionsMade}
              accent="zinc"
              sub={`${state.decisionLog.length} مسجّل`}
            />
            <StatPill
              icon={CheckCircle2}
              label="نتائج إيجابية"
              value={metrics.positiveCount}
              accent="emerald"
              sub={`${metrics.negativeCount} سلبية`}
            />
            <StatPill
              icon={Sparkles}
              label="أثر القرارات"
              value={formatQAR(metrics.totalImpact, true)}
              accent={metrics.totalImpact >= 0 ? "emerald" : "rose"}
              sub="إجمالي تراكمي"
            />
          </div>
        </div>
      </header>

      {/* SECTION 1 — CAPACITY + HIRING */}
      <section ref={hireRef} className="scroll-mt-20 space-y-4">
        <SectionHeader
          number={1}
          title="السعة والتوظيف"
          subtitle="توظيف → سعة → مشاريع → إيراد · الأرقام من الحالة الفعلية."
        />
        {hireFlash && (
          <div className="mb-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-sm text-emerald-400">
            ✓ {hireFlash}
          </div>
        )}
        <GrowthFunnel windowDays={30} />
        <CapacityPanel onOpenHire={openHire} />
        {hireOpen.open && (
          <HireDialog
            initialRole={hireOpen.role}
            initialSeniority={hireOpen.seniority}
            onClose={() => setHireOpen({ open: false })}
            onConfirmed={onHireConfirmed}
          />
        )}
      </section>

      {/* SECTION 2 — SCENARIO SELECTOR */}
      <section>
        <SectionHeader
          number={2}
          title="منتقي السيناريوهات"
          subtitle="اختر موقف · يتولّد سيناريو جاهز للقرار. كله مربوط بحالة الشركة الفعلية."
        />
        <ScenarioLibrary onSpawned={scrollToPending} />
      </section>

      {/* SECTION 3 — PENDING DECISIONS */}
      <section ref={pendingRef} className="scroll-mt-20">
        <SectionHeader
          number={3}
          title="قرارات تنتظر قرارك"
          subtitle="كل سيناريو فيه: خيارات · رأي المدير · احتمالات · الأثر المالي والفريق والمشاريع."
          badge={
            urgentCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-900/40 bg-rose-950/30 px-2.5 py-0.5 text-xs text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                {urgentCount} عاجل
              </span>
            ) : null
          }
        />

        {pendingSorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
            <Inbox className="h-9 w-9 text-zinc-700" />
            <div className="text-sm text-zinc-400">طابور القرارات فاضي</div>
            <p className="max-w-md text-xs text-zinc-500">
              تطلع سيناريوهات تلقائياً لما تحصل مشاكل حقيقية في الشركة، أو
              تقدر تختار واحد من منتقي السيناريوهات فوق عشان تجرب.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {pendingSorted.map((s) => (
              <ScenarioCard key={s.id} scenario={s} simTime={state.simTime} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4 — DIRECT ACTIONS */}
      <section>
        <SectionHeader
          number={4}
          title="إجراءات مباشرة"
          subtitle="قرارات تنفذها بدون سيناريو: توظيف، بونص، إيقاف توظيف، تنشيط فرص."
        />
        <ManualActions onOpenHire={() => openHire()} />
      </section>

      {/* SECTION 5 — DECISION LOG */}
      <section>
        <SectionHeader
          number={5}
          title="سجل القرارات"
          subtitle="ما توقعته · ما صار فعلاً. شف دقة حدسك مع الوقت."
        />
        <DecisionLog />
      </section>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  subtitle,
  badge,
}: {
  number: number;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs font-bold text-emerald-400 tabular-nums">
          {number}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Inbox;
  label: string;
  value: string | number;
  sub: string;
  accent: "zinc" | "emerald" | "rose";
}) {
  const accentColor = {
    zinc: "text-zinc-200",
    emerald: "text-emerald-400",
    rose: "text-rose-400",
  }[accent];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div
        className={cn(
          "mt-1 text-base font-bold tabular-nums leading-tight",
          accentColor
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-zinc-600">{sub}</div>
    </div>
  );
}
