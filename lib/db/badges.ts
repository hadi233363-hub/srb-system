// Badge system — central definitions + seed-on-boot.
//
// Badges are skill / role tags attached to users (many-to-many). The smart
// task router uses them to filter and rank candidates: typing "تصوير" into
// a new task flags the photographer badge, and the suggestion list narrows
// to people who actually have it.
//
// The 6 builtins below are seeded on first boot via ensureDefaultBadges().
// Admins can add custom badges later (TODO: admin badge editor) — those are
// stored with builtin=false and can be deleted from the UI.

import { prisma } from "./prisma";

export interface BuiltinBadge {
  slug: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  colorHex: string;
  sortOrder: number;
  /** Words (AR + EN) that hint at this badge when found in a task title/desc. */
  keywords: string[];
}

export const BUILTIN_BADGES: BuiltinBadge[] = [
  {
    slug: "photographer",
    labelAr: "مصوّر",
    labelEn: "Photographer",
    icon: "📸",
    colorHex: "#10b981",
    sortOrder: 10,
    keywords: [
      "تصوير",
      "صورة",
      "صور",
      "كاميرا",
      "فوتو",
      "فوتوغراف",
      "جلسة تصوير",
      "photo",
      "photos",
      "photography",
      "shoot",
      "camera",
      "headshot",
    ],
  },
  {
    slug: "designer",
    labelAr: "ديزاينر",
    labelEn: "Designer",
    icon: "🎨",
    colorHex: "#a855f7",
    sortOrder: 20,
    keywords: [
      "تصميم",
      "ديزاين",
      "بوستر",
      "بوسترات",
      "لوقو",
      "لوجو",
      "هوية",
      "بانر",
      "موك اب",
      "جرافيك",
      "design",
      "graphic",
      "logo",
      "poster",
      "branding",
      "mockup",
      "banner",
    ],
  },
  {
    slug: "account_manager",
    labelAr: "مسؤول حسابات",
    labelEn: "Account Manager",
    icon: "💼",
    colorHex: "#0ea5e9",
    sortOrder: 30,
    keywords: [
      "عميل",
      "عملاء",
      "متابعة",
      "مسؤول",
      "تنسيق",
      "اجتماع عميل",
      "client",
      "account",
      "follow",
      "coordination",
      "kickoff",
    ],
  },
  {
    slug: "sales",
    labelAr: "سيلز",
    labelEn: "Sales",
    icon: "💰",
    colorHex: "#f59e0b",
    sortOrder: 40,
    keywords: [
      "مبيعات",
      "بيع",
      "صفقة",
      "عرض سعر",
      "تسعير",
      "بروبوزل",
      "سيلز",
      "lead",
      "sales",
      "deal",
      "quote",
      "offer",
      "proposal",
      "pitch",
    ],
  },
  {
    slug: "producer",
    labelAr: "بروديوسر / مخرج",
    labelEn: "Producer / Director",
    icon: "🎬",
    colorHex: "#f43f5e",
    sortOrder: 50,
    keywords: [
      "إخراج",
      "مخرج",
      "إنتاج",
      "بروديوسر",
      "مونتاج كامل",
      "تصوير فيديو",
      "produce",
      "production",
      "direct",
      "director",
      "shoot day",
    ],
  },
  {
    slug: "video_editor",
    labelAr: "مونتير فيديو",
    labelEn: "Video Editor",
    icon: "🎞️",
    colorHex: "#6366f1",
    sortOrder: 60,
    keywords: [
      "مونتاج",
      "تحرير فيديو",
      "افتر افكت",
      "بريمير",
      "ريل",
      "ريلز",
      "فيديو قصير",
      "edit",
      "editing",
      "video edit",
      "after effects",
      "premiere",
      "reel",
      "reels",
    ],
  },
];

const KEYWORDS_BY_SLUG: Map<string, string[]> = new Map(
  BUILTIN_BADGES.map((b) => [b.slug, b.keywords.map((k) => k.toLowerCase())])
);

/** Idempotent — call on app boot. Inserts any builtin badges that don't yet exist. */
export async function ensureDefaultBadges(): Promise<void> {
  const existing = await prisma.badge.findMany({ select: { slug: true } });
  const existingSlugs = new Set(existing.map((b) => b.slug));

  const missing = BUILTIN_BADGES.filter((b) => !existingSlugs.has(b.slug));
  if (missing.length === 0) return;

  for (const b of missing) {
    await prisma.badge.create({
      data: {
        slug: b.slug,
        labelAr: b.labelAr,
        labelEn: b.labelEn,
        icon: b.icon,
        colorHex: b.colorHex,
        sortOrder: b.sortOrder,
        builtin: true,
      },
    });
  }
  console.log(`[badges] seeded ${missing.length} default badge(s)`);
}

/**
 * Detect which badges are likely needed based on task title + description.
 * Used to pre-fill the badge picker so the user doesn't have to think about it.
 */
export function detectBadgesFromText(text: string): string[] {
  const haystack = text.toLowerCase();
  const matches: string[] = [];
  for (const [slug, keywords] of KEYWORDS_BY_SLUG.entries()) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      matches.push(slug);
    }
  }
  return matches;
}

/** Look up builtin metadata by slug — useful for keyword hints in the API. */
export function getBuiltinBadge(slug: string): BuiltinBadge | undefined {
  return BUILTIN_BADGES.find((b) => b.slug === slug);
}
