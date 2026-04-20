import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function ReportsPage() {
  return (
    <ComingSoon
      title="التقارير"
      description="تقارير شهرية وربع سنوية · أداء الفريق · ربحية المشاريع · تصدير Excel."
      session={5}
      icon={FileText}
    />
  );
}
