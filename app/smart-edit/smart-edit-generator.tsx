"use client";

import { useState } from "react";
import { Check, Copy, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dict";

const EDIT_TYPES = ["ui", "logic", "database"] as const;
type EditType = (typeof EDIT_TYPES)[number];

const TYPE_LABELS: Record<EditType, { ar: string; en: string }> = {
  ui:       { ar: "واجهة المستخدم",   en: "UI / Interface" },
  logic:    { ar: "منطق تطبيقي",       en: "App Logic" },
  database: { ar: "قاعدة البيانات",    en: "Database / Schema" },
};

const TYPE_CONTEXT: Record<EditType, string> = {
  ui: `This is a UI/frontend change. Focus on:
- React/Next.js components (app router, server & client components)
- Tailwind CSS styling and responsive design
- Accessibility and user experience
- Component state management
- The project uses Next.js 16, React 19, Tailwind CSS v4, TypeScript, and Lucide icons.`,

  logic: `This is an application logic change. Focus on:
- Next.js server actions ("use server")
- Data fetching and mutations with Prisma ORM
- Authentication and authorization (next-auth v5, role-based guards)
- Business logic, validations, and error handling
- The project uses TypeScript, Prisma with SQLite (better-sqlite3), and next-auth.`,

  database: `This is a database/schema change. Focus on:
- Prisma schema modifications (schema.prisma)
- New models, fields, or relations
- Data migrations using \`prisma db push\`
- Index strategy and query optimization
- The project uses Prisma ORM with SQLite. Running \`npx prisma db push\` applies schema changes.`,
};

function buildPrompt(description: string, editType: EditType, locale: Locale): string {
  const typeLabel = TYPE_LABELS[editType][locale];
  const typeContext = TYPE_CONTEXT[editType];

  return `## نوع التعديل: ${typeLabel}

### الوصف
${description.trim()}

---

### سياق المشروع

هذا مشروع **SRB Internal Management** — نظام إدارة داخلي لوكالة إبداعية قطرية.

**Stack التقني:**
- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma ORM + SQLite (better-sqlite3)
- next-auth v5 (Google OAuth)
- Tailwind CSS v4
- واجهة عربية بالكامل + دعم إنجليزي

**هيكل الملفات الرئيسي:**
\`\`\`
app/              # صفحات وAPI routes
components/       # React components
lib/
  db/            # prisma.ts, helpers.ts, audit.ts
  i18n/          # dict.ts (ar/en translations)
  auth-guards.ts # requireAuth, requireManagerOrAdmin
  input-limits.ts
prisma/
  schema.prisma  # Prisma schema
  app.db         # SQLite database
\`\`\`

**أنماط مهمة:**
- Server Actions في \`app/*/actions.ts\` مع \`"use server"\`
- Auth guards: \`requireActiveUser()\` أو \`requireManagerOrAdmin()\`
- Translations: \`translate(key, locale)\` (server) / \`useT()\` (client)
- Input validation: \`safeString()\`, \`safeAmount()\` من \`lib/input-limits.ts\`
- Audit logs: \`logAudit({ action, target, metadata })\`

---

### تخصص التعديل
${typeContext}

---

### المطلوب منك

نفّذ التعديل المطلوب مع مراعاة:
1. اتبع أنماط الكود الموجودة في المشروع
2. استخدم TypeScript كامل بدون \`any\`
3. لا تكسر الكود الموجود
4. أضف مفاتيح الترجمة الجديدة في \`lib/i18n/dict.ts\` إذا لزم
5. اذكر كل الملفات التي تحتاج تعديل أو إنشاء
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
      {/* Edit type selector */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <label className="mb-2 block text-xs font-medium text-zinc-400">
          {t("smartEdit.typeLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          {EDIT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setEditType(type)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                editType === type
                  ? type === "ui"
                    ? "border border-sky-500/30 bg-sky-500/20 text-sky-300"
                    : type === "logic"
                    ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
                    : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                  : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"
              )}
            >
              {TYPE_LABELS[type][locale]}
            </button>
          ))}
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
