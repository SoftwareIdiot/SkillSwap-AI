import { openWorkspace } from "@/lib/open-workspace";
export const dynamic = "force-dynamic";
export default function Teacher() {
  return openWorkspace("Teacher", true);
}
