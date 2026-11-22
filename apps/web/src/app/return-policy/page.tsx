import type { Metadata } from "next";
import { Policies } from "@/components/policies";
export const metadata: Metadata = { title: "Chính sách đổi trả" };

export default function Page() {
  return <Policies returns />;
}
