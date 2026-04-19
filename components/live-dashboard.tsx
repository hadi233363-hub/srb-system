"use client";

import { useSim } from "./sim-provider";
import { LiveKpis } from "./live-kpis";
import { LiveActivityFeed } from "./live-activity-feed";
import { LiveAgentGrid } from "./live-agent-grid";
import { LiveAtRisk } from "./live-at-risk";
import { LiveBottlenecks } from "./live-bottlenecks";
import { CashflowChart } from "./cashflow-chart";
import { GrowthFunnel } from "./control/growth-funnel";

export function LiveDashboard() {
  const { state, connected } = useSim();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">نظرة عامة</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {state
              ? `محاكاة شركة SRB · ${connected ? "متصل" : "انقطع الاتصال"}`
              : "يبدأ..."}
          </p>
        </div>
      </div>

      <LiveKpis />

      <GrowthFunnel windowDays={30} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CashflowChart />
          <LiveActivityFeed />
        </div>
        <div className="space-y-6">
          <LiveBottlenecks />
          <LiveAtRisk />
          <LiveAgentGrid />
        </div>
      </div>
    </div>
  );
}
