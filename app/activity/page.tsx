import { redirect } from "next/navigation";

// النشاط في Phase 2 جاي مع نظام المهام — نحوّل للرئيسية مؤقتاً.
export default function ActivityPage() {
  redirect("/");
}
