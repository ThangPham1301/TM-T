import type { Metadata } from "next";
import { Policies } from "@/components/policies";
export const metadata: Metadata = { title: "Chính sách bảo mật" };

export default function Page() {
  return <Policies />;
}
