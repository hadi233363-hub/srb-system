// Built-in starter templates for the "New project" flow. Each template is a
// fixed list of phases — the order they appear here is the order in the
// project. Strings live in both Arabic and English so the locale picker can
// surface the right copy.

export type PhaseTemplateKey = "web_project" | "brand_identity" | "photography";

export interface PhaseTemplate {
  key: PhaseTemplateKey;
  labelAr: string;
  labelEn: string;
  phases: { ar: string; en: string }[];
}

export const PHASE_TEMPLATES: PhaseTemplate[] = [
  {
    key: "web_project",
    labelAr: "مشروع ويب",
    labelEn: "Web Project",
    phases: [
      { ar: "التخطيط والتصميم", en: "Planning & Design" },
      { ar: "التطوير", en: "Development" },
      { ar: "الاختبار وضمان الجودة", en: "Testing & QA" },
      { ar: "الإطلاق والتسليم", en: "Launch & Delivery" },
    ],
  },
  {
    key: "brand_identity",
    labelAr: "هوية تجارية",
    labelEn: "Brand Identity",
    phases: [
      { ar: "الاستكشاف والبريف", en: "Discovery & Brief" },
      { ar: "تصميم الشعار", en: "Logo Design" },
      { ar: "نظام الهوية الكامل", en: "Full Brand System" },
      { ar: "التسليم النهائي", en: "Final Delivery" },
    ],
  },
  {
    key: "photography",
    labelAr: "تصوير / إنتاج",
    labelEn: "Photography / Production",
    phases: [
      { ar: "التحضير والتنسيق", en: "Preparation & Coordination" },
      { ar: "التصوير", en: "Shoot" },
      { ar: "التحرير وما بعد الإنتاج", en: "Editing & Post-production" },
      { ar: "تسليم العميل", en: "Client Delivery" },
    ],
  },
];

export function findTemplate(key: string | null | undefined): PhaseTemplate | null {
  if (!key) return null;
  return PHASE_TEMPLATES.find((t) => t.key === key) ?? null;
}

export type Locale = "ar" | "en";

export function templatePhaseNames(
  template: PhaseTemplate,
  locale: Locale
): string[] {
  return template.phases.map((p) => p[locale]);
}
