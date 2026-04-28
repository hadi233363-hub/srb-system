// Shared helpers for Arabic labels + formatters used across pages.

export const ROLE_LABEL: Record<string, string> = {
  admin: "الرئيس",
  manager: "المدير",
  department_lead: "رئيس الفريق",
  employee: "الموظف",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  on_hold: "موقّف مؤقتاً",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  on_hold: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  completed: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  cancelled: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  video: "فيديو",
  photo: "تصوير",
  event: "فعالية",
  digital_campaign: "حملة رقمية",
  web: "ويب",
  design: "ديزاين",
  branding: "إنشاء علامة تجارية",
  other: "غير ذلك",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "مرتفعة",
  urgent: "عاجلة",
};

export const PRIORITY_COLOR: Record<string, string> = {
  low: "text-zinc-400",
  normal: "text-zinc-300",
  high: "text-amber-400",
  urgent: "text-rose-400",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "قيد الانتظار",
  in_progress: "قيد العمل",
  in_review: "قيد المراجعة",
  done: "مكتمل",
  blocked: "معلّق",
};

export const TASK_STATUS_COLOR: Record<string, string> = {
  todo: "border-zinc-700",
  in_progress: "border-sky-500/40",
  in_review: "border-amber-500/40",
  done: "border-emerald-500/40",
  blocked: "border-rose-500/40",
};

export const TRANSACTION_CATEGORY_LABEL: Record<string, string> = {
  project_payment: "دفعة مشروع",
  salary: "راتب",
  bonus: "بونص",
  freelance: "فري لانس",
  tool: "أدوات/اشتراكات",
  ad: "إعلانات",
  overhead: "مصاريف عامة",
  refund: "ارتجاع/خسارة",
  other: "غير ذلك",
};

export const BILLING_TYPE_LABEL: Record<string, string> = {
  one_time: "مرة واحدة",
  monthly: "شهري متكرر",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  none: "مرة واحدة",
  monthly: "شهري",
};

// Categories that typically recur monthly. UI defaults them to `monthly`.
export const MONTHLY_DEFAULT_CATEGORIES = new Set(["salary", "overhead", "tool"]);

export function formatQar(
  n: number,
  opts: { sign?: boolean; locale?: "ar" | "en" } = {}
): string {
  const sign = opts.sign && n > 0 ? "+" : "";
  const abs = Math.abs(Math.round(n));
  const currency = opts.locale === "en" ? "QAR" : "ر.ق";
  return `${n < 0 ? "−" : sign}${abs.toLocaleString("en")} ${currency}`;
}

export function formatDate(
  d: Date | null | undefined,
  locale: "ar" | "en" = "ar"
): string {
  if (!d) return "—";
  const bcp = locale === "en" ? "en-US" : "en"; // keep digits western in both
  return new Date(d).toLocaleDateString(bcp, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(dueAt: Date | null | undefined, status?: string): boolean {
  if (!dueAt) return false;
  if (status === "done" || status === "cancelled") return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function daysUntil(dueAt: Date | null | undefined): number | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
