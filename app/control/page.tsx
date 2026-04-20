import { redirect } from "next/navigation";

// غرفة القرارات كانت للمحاكاة — Phase 2 ما يحتاجها.
// نحوّل للرئيسية إذا فتحها أحد.
export default function ControlPage() {
  redirect("/");
}
