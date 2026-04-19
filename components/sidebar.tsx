"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Briefcase,
  Users,
  DollarSign,
  Activity,
  FileText,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/cn";

const nav = [
  { href: "/", label: "نظرة عامة", icon: Home },
  { href: "/control", label: "غرفة القرارات", icon: Settings2, highlight: true },
  { href: "/projects", label: "المشاريع", icon: Briefcase },
  { href: "/team", label: "الفريق", icon: Users },
  { href: "/finance", label: "المالية", icon: DollarSign },
  { href: "/activity", label: "النشاط", icon: Activity },
  { href: "/reports", label: "التقارير", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-l border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-4 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-500">
            S
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100">SRB</div>
            <div className="text-[10px] text-zinc-500">محاكاة · مرحلة 1</div>
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const isHighlight = "highlight" in item && item.highlight;

          const classes = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
            active
              ? "bg-zinc-800/80 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
            isHighlight && !active && "text-emerald-400 hover:text-emerald-300"
          );

          return (
            <Link key={item.href} href={item.href} className={classes}>
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {active && (
                <span className="mr-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-zinc-800 pt-3 text-[11px] text-zinc-600">
        v0.2.0 · Phase 1 simulation
      </div>
    </aside>
  );
}
