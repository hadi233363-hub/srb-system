import type { Archetype, ProjectType, Role, Traits } from "./types";

export const ROLES: Role[] = [
  "account_manager",
  "designer",
  "video_editor",
  "developer",
  "sales",
];

export const ROLE_LABELS: Record<Role, string> = {
  account_manager: "مدير حساب",
  designer: "مصمم",
  video_editor: "مونتير",
  developer: "مطور",
  sales: "مبيعات",
};

export const AGENT_NAMES: { name: string; role: Role; archetype: Archetype }[] = [
  { name: "أحمد الكواري", role: "account_manager", archetype: "efficient" },
  { name: "نورة العبدالله", role: "account_manager", archetype: "rookie" },
  { name: "ليلى المري", role: "designer", archetype: "perfectionist" },
  { name: "مريم الخليفي", role: "designer", archetype: "inconsistent" },
  { name: "عمر الأنصاري", role: "video_editor", archetype: "inconsistent" },
  { name: "راشد الدوسري", role: "video_editor", archetype: "lazy" },
  { name: "فاطمة الكعبي", role: "developer", archetype: "efficient" },
  { name: "خالد السويدي", role: "sales", archetype: "burnout_prone" },
];

export const ARCHETYPE_TRAITS: Record<Archetype, Traits> = {
  efficient:      { speed: 85, accuracy: 88, reliability: 92, creativity: 78 },
  lazy:           { speed: 35, accuracy: 60, reliability: 40, creativity: 50 },
  inconsistent:   { speed: 65, accuracy: 55, reliability: 50, creativity: 85 },
  perfectionist:  { speed: 42, accuracy: 96, reliability: 88, creativity: 88 },
  burnout_prone:  { speed: 78, accuracy: 78, reliability: 70, creativity: 70 },
  rookie:         { speed: 50, accuracy: 50, reliability: 75, creativity: 55 },
};

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  efficient: "شغّيل",
  lazy: "كسلان",
  inconsistent: "مزاجي",
  perfectionist: "إتقان زايد",
  burnout_prone: "قابل للاحتراق",
  rookie: "مبتدئ",
};

export const BASE_SALARY_BY_ROLE: Record<Role, number> = {
  account_manager: 12000,
  designer: 10000,
  video_editor: 9500,
  developer: 14000,
  sales: 11000,
};

export const CLIENT_POOL: string[] = [
  "Ooredoo",
  "Vodafone Qatar",
  "QNB",
  "CBQ",
  "مصرف قطر الإسلامي",
  "Qatar Airways",
  "Al Meera",
  "Lulu Qatar",
  "Qatar Foundation",
  "Msheireb Properties",
  "Ezdan Holding",
  "Barwa Real Estate",
  "هيئة الأشغال",
  "كتارا",
  "مؤسسة قطر للسياحة",
  "مهرجان الدرعية",
  "Qatar National Museum",
  "Baladna",
  "Woqod",
  "Qatar Rail",
];

interface TaskTemplate {
  title: string;
  role: Role;
  hours: number;
}

interface ProjectTemplate {
  titlePatterns: string[];
  minBudget: number;
  maxBudget: number;
  costRatio: number;
  durationDays: [number, number];
  tasks: TaskTemplate[];
}

export const PROJECT_TEMPLATES: Record<ProjectType, ProjectTemplate> = {
  video: {
    titlePatterns: ["حملة فيديو — {client}", "ريل إعلاني — {client}", "فيديو ترويجي — {client}"],
    minBudget: 30000,
    maxBudget: 80000,
    costRatio: 0.55,
    durationDays: [5, 14],
    tasks: [
      { title: "كتابة الـ brief", role: "account_manager", hours: 4 },
      { title: "كتابة السكربت", role: "video_editor", hours: 8 },
      { title: "التصوير", role: "video_editor", hours: 16 },
      { title: "المونتاج النهائي", role: "video_editor", hours: 20 },
      { title: "التسليم والمراجعة", role: "account_manager", hours: 3 },
    ],
  },
  photo: {
    titlePatterns: ["جلسة تصوير منتج — {client}", "تصوير حملة — {client}", "تصوير فعالية — {client}"],
    minBudget: 15000,
    maxBudget: 40000,
    costRatio: 0.5,
    durationDays: [3, 10],
    tasks: [
      { title: "الـ brief والتنسيق", role: "account_manager", hours: 3 },
      { title: "التصوير", role: "designer", hours: 10 },
      { title: "المعالجة والتحرير", role: "designer", hours: 12 },
      { title: "التسليم", role: "account_manager", hours: 2 },
    ],
  },
  event: {
    titlePatterns: ["تغطية فعالية — {client}", "معرض — {client}", "افتتاح — {client}"],
    minBudget: 50000,
    maxBudget: 150000,
    costRatio: 0.6,
    durationDays: [7, 20],
    tasks: [
      { title: "التخطيط والتنسيق", role: "account_manager", hours: 8 },
      { title: "تغطية تصوير", role: "designer", hours: 14 },
      { title: "تغطية فيديو", role: "video_editor", hours: 16 },
      { title: "المونتاج النهائي", role: "video_editor", hours: 18 },
      { title: "تسليم الباقة الكاملة", role: "account_manager", hours: 4 },
    ],
  },
  digital_campaign: {
    titlePatterns: ["حملة سوشال ميديا — {client}", "إطلاق رقمي — {client}", "حملة أداء — {client}"],
    minBudget: 25000,
    maxBudget: 70000,
    costRatio: 0.45,
    durationDays: [10, 25],
    tasks: [
      { title: "الاستراتيجية", role: "account_manager", hours: 6 },
      { title: "تصميم المحتوى البصري", role: "designer", hours: 18 },
      { title: "كتابة المحتوى", role: "sales", hours: 10 },
      { title: "تشغيل الحملة", role: "account_manager", hours: 15 },
      { title: "تقرير الأداء", role: "account_manager", hours: 5 },
    ],
  },
  web: {
    titlePatterns: ["موقع إلكتروني — {client}", "landing page — {client}", "تطبيق ويب — {client}"],
    minBudget: 40000,
    maxBudget: 100000,
    costRatio: 0.5,
    durationDays: [14, 30],
    tasks: [
      { title: "تحليل المتطلبات", role: "account_manager", hours: 5 },
      { title: "تصميم UI/UX", role: "designer", hours: 18 },
      { title: "تطوير الواجهة", role: "developer", hours: 30 },
      { title: "تطوير الباك اند", role: "developer", hours: 24 },
      { title: "اختبار وتسليم", role: "developer", hours: 8 },
    ],
  },
};

export const PROJECT_TYPES = Object.keys(PROJECT_TEMPLATES) as ProjectType[];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  video: "فيديو",
  photo: "تصوير",
  event: "فعالية",
  digital_campaign: "حملة رقمية",
  web: "ويب",
};

export const PROJECT_PRIORITY_LABELS = {
  low: "عادي",
  normal: "عادي",
  urgent: "عاجل",
} as const;

export interface CrisisTemplate {
  id: string;
  message: (title: string) => string;
  apply: "add_task" | "pull_deadline" | "reject_delivery" | "scope_change";
  weight: number;
}

export const CRISIS_TEMPLATES: CrisisTemplate[] = [
  {
    id: "client_new_version",
    message: (t) => `العميل يبي نسخة جديدة من "${t}"`,
    apply: "add_task",
    weight: 3,
  },
  {
    id: "deadline_pulled",
    message: (t) => `العميل قدّم deadline "${t}" أسبوع`,
    apply: "pull_deadline",
    weight: 2,
  },
  {
    id: "brief_change",
    message: (t) => `الـ brief حق "${t}" تغير من الأساس`,
    apply: "scope_change",
    weight: 3,
  },
  {
    id: "delivery_rejected",
    message: (t) => `العميل رفض تسليم "${t}" · يبي إعادة`,
    apply: "reject_delivery",
    weight: 1,
  },
];

export const REWORK_TASK_TITLES = [
  "إعادة عمل: {title}",
  "تعديلات العميل: {title}",
  "مراجعة {title}",
];

export const EXTRA_TASK_TEMPLATES: Record<Role, string[]> = {
  account_manager: ["اجتماع إضافي مع العميل", "تقرير تفصيلي إضافي", "عرض تقديمي جديد"],
  designer: ["تصميم variant إضافي", "3 نسخ بديلة", "bannerات إضافية"],
  video_editor: ["نسخة قصيرة للسوشال", "تيزر إضافي", "نسخة عمودية للـ reels"],
  developer: ["feature إضافي طلبه العميل", "dashboard تحليلات", "ربط مع نظام خارجي"],
  sales: ["محتوى إضافي للحملة", "copywriting للـ landing page", "email sequence"],
};
