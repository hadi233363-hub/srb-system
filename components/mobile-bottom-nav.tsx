"use client";

// Mobile bottom navigation — shown ONLY below md (≥768px the sidebar takes
// over). The 4 tabs match the simplified employee surface called for in the
// internal-OS spec: مهامي · جدولي · إشعاراتي · الرئيسية. Higher-tier roles
// see the same 4 quick tabs PLUS a "More" button that opens the full
// sidebar drawer (the drawer is implemented in components/sidebar.tsx — we
// don't duplicate it; we only forward the open-state via a custom event).
//
// Why a separate component instead of folding into <Sidebar/>?
// - Sidebar is a full-height drawer; bottom-nav is a 64px-tall persistent
//   bar. Different layout primitives, different lifecycles.
// - The bar must stay above safe-area-inset-bottom on iOS, which is easier
//   to manage in isolation.
// - Sidebar is already large; splitting keeps each file < 300 lines.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calendar, Home, KanbanSquare, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { type Role } from "@/lib/auth/roles";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
}

// 4 tabs is the iOS / Material guideline maximum before tabs become hard to
// hit. We keep these identical for every role so muscle memory works no
// matter who's signed in. Higher roles get the "More" trigger as a 5th item.
const TABS: NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/tasks", labelKey: "bottomNav.myTasks", icon: KanbanSquare },
  { href: "/shoots", labelKey: "bottomNav.mySchedule", icon: Calendar },
  { href: "/notifications", labelKey: "bottomNav.notifications", icon: Bell },
];

interface Props {
  role: Role;
  hasExtraPerms?: boolean;
}

function dispatchOpenDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("srb:open-mobile-nav"));
}

export function MobileBottomNav({ role, hasExtraPerms = false }: Props) {
  const onOpenDrawer = dispatchOpenDrawer;
  const pathname = usePathname();
  const t = useT();

  // Only employees see the strict 4-tab view. Everyone else gets a 5th
  // "More" button that pops the sidebar drawer for full nav (admin pages,
  // finance, projects, etc). This way the bottom nav still gives muscle
  // memory for the common 4 actions without hiding power-user routes.
  const showDrawerButton = role !== "employee" || hasExtraPerms;

  const items: { kind: "link" | "drawer"; item?: NavItem }[] = TABS.map(
    (item) => ({ kind: "link" as const, item })
  );
  if (showDrawerButton) {
    items.push({ kind: "drawer" as const });
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden",
        // safe-area: iPhone home-indicator clearance
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((entry) => {
          if (entry.kind === "drawer") {
            return (
              <li key="drawer">
                <button
                  type="button"
                  onClick={onOpenDrawer}
                  className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[10px] text-zinc-400 transition active:bg-zinc-900"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                  <span>{t("bottomNav.more")}</span>
                </button>
              </li>
            );
          }

          const item = entry.item!;
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[10px] transition active:bg-zinc-900",
                  active ? "text-zinc-100" : "text-zinc-400"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("h-5 w-5", active && "drop-shadow-[0_0_4px_currentColor]")}
                  style={active ? { color: "var(--color-brand)" } : undefined}
                />
                <span style={active ? { color: "var(--color-brand)" } : undefined}>
                  {t(item.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
