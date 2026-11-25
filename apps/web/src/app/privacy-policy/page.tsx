import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư",
  description: "Cách Gói Huế xử lý dữ liệu tài khoản, đơn hàng và yêu cầu quyền riêng tư.",
};

export default function Page() {
  return <PolicyPage kind="privacy" />;
}
