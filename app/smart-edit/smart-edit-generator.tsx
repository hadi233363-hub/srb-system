"use client";

import { useState } from "react";
import { Check, Copy, Database, Layers, Monitor, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dict";

const EDIT_TYPES = ["ui", "sections", "database"] as const;
type EditType = (typeof EDIT_TYPES)[number];

interface TypeConfig {
  labelKey: string;
  descKey: string;
  icon: React.ElementType;
  color: "sky" | "amber" | "emerald";
}

const TYPE_CONFIG: Record<EditType, TypeConfig> = {
  ui: {
    labelKey: "smartEdit.type.ui",
    descKey: "smartEdit.type.ui.desc",
    icon: Monitor,
    color: "sky",
  },
  sections: {
    labelKey: "smartEdit.type.sections",
    descKey: "smartEdit.type.sections.desc",
    icon: Layers,
    color: "amber",
  },
  database: {
    labelKey: "smartEdit.type.database",
    descKey: "smartEdit.type.database.desc",
    icon: Database,
    color: "emerald",
  },
};

const COLOR_CLASSES: Record<"sky" | "amber" | "emerald", { active: string; icon: string }> = {
  sky:     { active: "border-sky-500/40 bg-sky-500/10 text-sky-300",       icon: "text-sky-400" },
  amber:   { active: "border-amber-500/40 bg-amber-500/10 text-amber-300", icon: "text-amber-400" },
  emerald: { active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", icon: "text-emerald-400" },
};

function buildPrompt(description: string, editType: EditType, locale: Locale): string {
  const trimmed = description.trim();

  if (editType === "ui") {
    return `## نوع التعديل: الواجهة (UI / Interface)

### الطلب
${trimmed}

---

### سياق المشروع: SRB Internal Management

**Stack الواجهة:**
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + Lucide React icons
- واجهة عربية RTL + دعم إنجليزي عبر \`lib/i18n/dict.ts\`

**الملفات الأكثر احتمالاً للتعديل:**
\`\`\`
app/
  projects/page.tsx              # قائمة المشاريع
  projects/[id]/page.tsx         # صفحة المشروع الواحد
  projects/new-project-button.tsx
  tasks/page.tsx                 # صفحة المهام
  finance/page.tsx               # صفحة المالية
  finance/edit-transaction-button.tsx
  team/page.tsx                  # صفحة الفريق
  team/[id]/page.tsx
  clients/page.tsx               # صفحة العملاء
  clients/[id]/page.tsx
  shoots/page.tsx                # صفحة جلسات التصوير
  shoots/[id]/page.tsx
  meetings/page.tsx              # صفحة الاجتماعات
  reports/page.tsx               # صفحة التقارير
  activity/page.tsx              # سجل النشاط
  equipment/page.tsx             # المعدات

components/
  sidebar.tsx                    # الشريط الجانبي والتنقل
  tasks/kanban-board.tsx         # لوحة كانبان
  projects/*.tsx                 # مكوّنات المشاريع
  finance/*.tsx                  # مكوّنات المالية
  team/*.tsx                     # مكوّنات الفريق
  charts/*.tsx                   # مخططات بيانية

lib/
  i18n/dict.ts                   # ترجمات AR/EN — أضف مفاتيح جديدة هنا
\`\`\`

**أنماط الكود الواجب اتباعها:**
- الترجمات: \`useT()\` في client components، \`translate(key, locale)\` في server components
- ألوان Tailwind: \`zinc\` للأساس، \`emerald\` للإيجابي، \`rose\` للسلبي، \`sky\` للمعلومات، \`amber\` للتحذير
- أيقونات: \`lucide-react\` فقط (لا تضف مكتبة أيقونات جديدة)
- RTL مطبّق على مستوى layout — لا تضف \`dir\` أو \`text-right\` inline

---

### المطلوب

1. اقرأ الملف/الملفات المعنية أولاً قبل أي تعديل
2. نفّذ التغيير بنفس نمط وأسلوب الكود الموجود
3. أضف مفاتيح الترجمة في \`lib/i18n/dict.ts\` (بالعربي والإنجليزي) لأي نصوص جديدة
4. لا تمس server actions أو schema.prisma
5. اذكر كل الملفات التي ستعدّلها قبل البدء
`;
  }

  if (editType === "sections") {
    return `## نوع التعديل: الأقسام (Features / Logic)

### الطلب
${trimmed}

---

### سياق المشروع: SRB Internal Management

**Stack المنطق:**
- Next.js 16 App Router + TypeScript + Prisma ORM + SQLite (better-sqlite3)
- next-auth v5 (Google OAuth)
- أدوار: owner > admin > manager > head > department_lead > employee

**الملفات الأكثر احتمالاً للتعديل:**
\`\`\`
app/
  projects/actions.ts            # CRUD المشاريع والمهام الفرعية
  tasks/actions.ts               # CRUD المهام والتسليمات
  finance/actions.ts             # المعاملات المالية
  clients/actions.ts             # إدارة العملاء
  clients/[id]/actions.ts
  team/actions.ts                # إدارة الفريق
  team/[id]/actions.ts
  shoots/actions.ts              # جلسات التصوير
  shoots/[id]/actions.ts
  meetings/actions.ts            # الاجتماعات
  equipment/actions.ts           # المعدات
  admin/users/actions.ts         # إدارة المستخدمين (owner/admin فقط)
  admin/permissions/actions.ts   # الصلاحيات

lib/
  auth-guards.ts                 # ← اختر الـ guard المناسب من هنا
  input-limits.ts                # safeString(), safeAmount(), MAX_* constants
  db/
    prisma.ts                    # Prisma client singleton
    audit.ts                     # logAudit({ action, target, metadata })
    helpers.ts                   # DB helpers مشتركة
  projects/index.ts              # business logic المشاريع
  tasks/index.ts                 # business logic المهام
\`\`\`

**أنماط Server Actions الواجب اتباعها:**
\`\`\`ts
"use server";
// 1. Auth guard أولاً
const session = await requireManagerOrAbove();
// Guards متاحة: requireOwner | requireManagerOrAbove | requireDeptLeadOrAbove | requireActiveUser

// 2. Validate input
const title = safeString(formData.get("title"));
const amount = safeAmount(formData.get("amount"));

// 3. Business logic مع Prisma
const result = await prisma.model.create({ data: { ... } });

// 4. Audit log
await logAudit({ action: "ACTION_NAME", target: result.id, metadata: { ... } });

// 5. Revalidate
revalidatePath("/section-path");

// 6. Return
return { ok: true };
// أو عند خطأ: return { ok: false, message: "رسالة الخطأ" };
\`\`\`

---

### المطلوب

1. اقرأ ملف الـ actions المعني أولاً لترى الأنماط الموجودة
2. اقرأ \`lib/auth-guards.ts\` لتختار الـ guard الصحيح
3. نفّذ التعديل بنفس pattern الـ actions الموجودة بالضبط
4. إذا احتجت تغيير الـ schema — أخبرني وسأستخدم نوع "قاعدة البيانات" بدلاً
5. اذكر كل الملفات التي ستعدّلها أو تنشئها قبل البدء
`;
  }

  // database
  return `## نوع التعديل: قاعدة البيانات (Database / Schema)

### الطلب
${trimmed}

---

### سياق المشروع: SRB Internal Management

**Stack قاعدة البيانات:**
- Prisma ORM + SQLite (better-sqlite3)
- تطبيق التغييرات: \`npx prisma db push\` ثم \`npx prisma generate\`
- Production (Railway): يشغّل \`prisma db push --skip-generate\` تلقائياً عند الـ deploy

**الملفات المعنية:**
\`\`\`
prisma/
  schema.prisma          # ← عدّل هنا فقط
  app.db                 # SQLite database (لا تمسه مباشرة)

lib/
  db/
    prisma.ts            # Prisma client singleton (لا تعدّله)
\`\`\`

**الموديلات الموجودة حالياً في schema.prisma:**
\`\`\`
User, Session, Account          # next-auth
Project                          # المشاريع الإبداعية
ProjectPackage                   # باقة المشروع (posts/reels/videos/shoots/stories)
Task, TaskSubmission             # المهام والتسليمات
Transaction                      # المعاملات المالية (income/expense)
Client                           # العملاء
TeamMember                       # أعضاء الفريق
Shoot, ShootParticipant         # جلسات التصوير
Meeting, MeetingAttendee        # الاجتماعات
Equipment                        # المعدات
Freelancer                       # المستقلون المرتبطون بالمشاريع
AuditLog                         # سجل التدقيق
Notification, PushSubscription  # الإشعارات
PermissionOverride               # تجاوزات الصلاحيات
\`\`\`

**أنماط Schema الواجب اتباعها:**
\`\`\`prisma
model NewModel {
  id        String   @id @default(cuid())
  // الحقول هنا
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
\`\`\`

---

### المطلوب

1. اقرأ \`prisma/schema.prisma\` كاملاً أولاً
2. اشرح التغيير المطلوب وأثره على الموديلات الموجودة
3. اكتب التعديل الكامل على الـ schema
4. اذكر الملفات في \`app/*/actions.ts\` التي تحتاج تحديث بعد تغيير الـ schema
5. أعطِ الأوامر المطلوب تشغيلها:
   \`\`\`bash
   npx prisma db push
   npx prisma generate
   \`\`\`
`;
}

export function SmartEditGenerator({ locale }: { locale: Locale }) {
  const t = useT();
  const [description, setDescription] = useState("");
  const [editType, setEditType] = useState<EditType>("ui");
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    if (!description.trim()) return;
    setGeneratedPrompt(buildPrompt(description, editType, locale));
    setCopied(false);
  };

  const copyToClipboard = async () => {
    if (!generatedPrompt) return;
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Edit type selector — cards with description */}
      <div>
        <label className="mb-3 block text-xs font-medium text-zinc-400">
          {t("smartEdit.typeLabel")}
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {EDIT_TYPES.map((type) => {
            const cfg = TYPE_CONFIG[type];
            const Icon = cfg.icon;
            const colors = COLOR_CLASSES[cfg.color];
            const active = editType === type;
            return (
              <button
                key={type}
                onClick={() => setEditType(type)}
                className={cn(
                  "rounded-xl border p-3 text-start transition",
                  active
                    ? colors.active
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? colors.icon : "text-zinc-500"
                    )}
                  />
                  <span className="text-sm font-semibold">
                    {t(cfg.labelKey)}
                  </span>
                </div>
                <p className={cn("text-[11px] leading-relaxed", active ? "opacity-80" : "text-zinc-500")}>
                  {t(cfg.descKey)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description input */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <label className="mb-2 block text-xs font-medium text-zinc-400">
          {t("smartEdit.descLabel")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder={t("smartEdit.descPlaceholder")}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">
            {description.length} {t("smartEdit.chars")}
          </span>
          <button
            onClick={generate}
            disabled={!description.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            <Wand2 className="h-4 w-4" />
            {t("smartEdit.generate")}
          </button>
        </div>
      </div>

      {/* Generated prompt */}
      {generatedPrompt && (
        <div className="rounded-xl border border-emerald-500/20 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-300">
              {t("smartEdit.result")}
            </h3>
            <button
              onClick={copyToClipboard}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                copied
                  ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                  : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {t("smartEdit.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {t("smartEdit.copy")}
                </>
              )}
            </button>
          </div>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 font-mono text-[11px] text-zinc-300 leading-relaxed">
            {generatedPrompt}
          </pre>
          <p className="mt-2 text-[10px] text-zinc-600">{t("smartEdit.hint")}</p>
        </div>
      )}
    </div>
  );
}
