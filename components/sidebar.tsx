"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  Briefcase,
  Users,
  DollarSign,
  KanbanSquare,
  FileText,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";

type Role = "admin" | "manager" | "employee";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
  highlight?: boolean;
  adminOnly?: boolean;
}

const nav: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/projects", labelKey: "nav.projects", icon: Briefcase, highlight: true },
  { href: "/tasks", labelKey: "nav.tasks", icon: KanbanSquare, highlight: true },
  { href: "/team", labelKey: "nav.team", icon: Users },
  { href: "/finance", labelKey: "nav.finance", icon: DollarSign },
  { href: "/reports", labelKey: "nav.reports", icon: FileText },
  { href: "/admin/users", labelKey: "nav.admin_users", icon: ShieldCheck, adminOnly: true },
];

interface Props {
  userRole: Role;
  userName: string;
  userEmail: string;
}

export function Sidebar({ userRole, userName, userEmail }: Props) {
  const pathname = usePathname();
  const t = useT();
  const { locale } = useLocale();

  const activeIndicatorClass =
    locale === "ar"
      ? "mr-auto h-1.5 w-1.5 rounded-full bg-emerald-500"
      : "ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500";

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-zinc-800 bg-zinc-900/40 p-4 border-s">
      <div className="mb-4 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-500">
            S
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100">SRB</div>
            <div className="text-[10px] text-zinc-500">{t("brand.system")}</div>
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          if (item.adminOnly && userRole !== "admin") return null;
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
              <span>{t(item.labelKey)}</span>
              {active && <span className={activeIndicatorClass} />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-zinc-800 pt-3">
        <div className="mb-2 rounded-lg bg-zinc-800/40 p-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-200">
                {userName}
              </div>
              <div className="truncate text-[10px] text-zinc-500" dir="ltr">
                {userEmail}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px]",
                userRole === "admin"
                  ? "bg-rose-500/10 text-rose-400"
                  : userRole === "manager"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-emerald-500/10 text-emerald-400"
              )}
            >
              {t(`role.${userRole}`)}
            </span>
          </div>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 py-1 text-[10px] text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-400"
          >
            <LogOut className="h-3 w-3" />
            {t("auth.signout")}
          </button>
        </div>
        <div className="text-[10px] text-zinc-600">v1.0.0 · Phase 2 real</div>
      </div>
    </aside>
  );
}
