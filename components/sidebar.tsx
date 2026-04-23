"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  Shield,
  Archive,
  Palette,
  Calendar,
  Camera,
  Package,
  Menu,
  X,
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
  { href: "/meetings", labelKey: "nav.meetings", icon: Calendar, highlight: true },
  { href: "/shoots", labelKey: "nav.shoots", icon: Camera, highlight: true },
  { href: "/equipment", labelKey: "nav.equipment", icon: Package },
  { href: "/finance", labelKey: "nav.finance", icon: DollarSign },
  { href: "/reports", labelKey: "nav.reports", icon: FileText, adminOnly: true },
  { href: "/admin/users", labelKey: "nav.admin_users", icon: ShieldCheck, adminOnly: true },
  { href: "/admin/audit", labelKey: "nav.admin_audit", icon: Shield, adminOnly: true },
  { href: "/admin/backup", labelKey: "nav.admin_backup", icon: Archive, adminOnly: true },
  { href: "/admin/theme", labelKey: "nav.admin_theme", icon: Palette, adminOnly: true },
];

interface Props {
  userRole: Role;
  userName: string;
  userEmail: string;
  logoPath?: string;
}

export function Sidebar({ userRole, userName, userEmail, logoPath }: Props) {
  const pathname = usePathname();
  const t = useT();
  const { locale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close the mobile drawer when the user navigates.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const activeIndicatorClass =
    locale === "ar"
      ? "mr-auto h-1.5 w-1.5 rounded-full"
      : "ml-auto h-1.5 w-1.5 rounded-full";

  const panel = (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col gap-1 bg-zinc-900/95 p-4 md:bg-zinc-900/40",
        "md:relative md:h-auto md:translate-x-0 md:border-zinc-800 md:border-s",
        // Mobile: fixed drawer overlay
        "fixed inset-y-0 z-40 h-screen border-zinc-800 border-s transition-transform duration-200",
        locale === "ar" ? "right-0" : "left-0",
        mobileOpen
          ? "translate-x-0"
          : locale === "ar"
          ? "translate-x-full md:translate-x-0"
          : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-2 px-2 py-3 md:block">
        <div className="flex-1">
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "var(--color-brand-dim)" }}
          >
            <img
              src={logoPath || "/srb-logo-white.png"}
              alt="SRB"
              className="h-7 w-full object-contain object-center"
            />
          </div>
          <div className="mt-2 text-center text-[10px] text-zinc-500">
            {t("brand.system")}
          </div>
        </div>
        {/* Close button — mobile only. 44px min size meets iOS touch target guidance. */}
        <button
          onClick={() => setMobileOpen(false)}
          className="mt-2 flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
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
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
          );

          const highlightStyle =
            isHighlight && !active ? { color: "var(--color-brand)" } : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classes}
              style={highlightStyle}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
              {active && (
                <span
                  className={activeIndicatorClass}
                  style={{ background: "var(--color-brand)" }}
                />
              )}
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

  return (
    <>
      {/* Mobile hamburger — only shown below md. Safe-area-inset keeps the
          button below the iPhone Dynamic Island / notch. */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-200 shadow-lg md:hidden"
        style={{
          top: "max(12px, env(safe-area-inset-top))",
          ...(locale === "ar"
            ? { right: "max(12px, env(safe-area-inset-right))" }
            : { left: "max(12px, env(safe-area-inset-left))" }),
        }}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop — clicking closes the drawer */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden
        />
      )}

      {panel}
    </>
  );
}
