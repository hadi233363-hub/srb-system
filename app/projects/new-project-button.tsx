"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createProjectAction } from "./actions";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function NewProjectButton({ users }: { users: User[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createProjectAction(formData);
      if (res.ok && res.id) {
        setOpen(false);
        formRef.current?.reset();
        router.push(`/projects/${res.id}`);
      } else {
        setError(res.message ?? "حدث خطأ");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
      >
        <Plus className="h-4 w-4" />
        مشروع جديد
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">مشروع جديد</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form
              ref={formRef}
              action={onSubmit}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <Field label="اسم المشروع *" full>
                <input
                  name="title"
                  required
                  placeholder="مثال: حملة رمضان لبنك قطر"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label="العميل">
                <input
                  name="clientName"
                  placeholder="بنك قطر الوطني"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label="نوع المشروع">
                <select
                  name="type"
                  defaultValue=""
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="video">فيديو</option>
                  <option value="photo">تصوير</option>
                  <option value="event">فعالية</option>
                  <option value="digital_campaign">حملة رقمية</option>
                  <option value="web">ويب</option>
                  <option value="other">غير ذلك</option>
                </select>
              </Field>
              <Field label="الأولوية">
                <select
                  name="priority"
                  defaultValue="normal"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="low">منخفضة</option>
                  <option value="normal">عادية</option>
                  <option value="high">مرتفعة</option>
                  <option value="urgent">عاجلة</option>
                </select>
              </Field>
              <Field label="نوع التسعير *" full>
                <div className="grid grid-cols-2 gap-2">
                  <label className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm has-[:checked]:border-emerald-500/40 has-[:checked]:bg-emerald-500/10 has-[:checked]:text-emerald-400">
                    <input
                      type="radio"
                      name="billingType"
                      value="one_time"
                      defaultChecked
                      className="ml-2 accent-emerald-500"
                    />
                    مرة واحدة (مشروع منتهي بميزانية واحدة)
                  </label>
                  <label className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm has-[:checked]:border-emerald-500/40 has-[:checked]:bg-emerald-500/10 has-[:checked]:text-emerald-400">
                    <input
                      type="radio"
                      name="billingType"
                      value="monthly"
                      className="ml-2 accent-emerald-500"
                    />
                    شهري متكرر (الميزانية تُحتسب كل شهر)
                  </label>
                </div>
              </Field>
              <Field label="الميزانية (ر.ق)">
                <input
                  name="budgetQar"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="50000"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
                <div className="mt-0.5 text-[10px] text-zinc-600">
                  للمشاريع الشهرية: هذي قيمة الدفعة الشهرية
                </div>
              </Field>
              <Field label="الـ deadline">
                <input
                  name="deadlineAt"
                  type="date"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <Field label="المسؤول (Lead)" full>
                <select
                  name="leadId"
                  defaultValue=""
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">أنا</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="وصف مختصر" full>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="اختياري — تفاصيل المشروع"
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>

              <div className="flex items-center justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isPending ? "يُنشئ..." : "إنشاء المشروع"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
