import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
export const metadata: Metadata = {
  title: "Chính sách đổi trả và hoàn tiền",
  description: "Thời hạn tiếp nhận, cách gửi yêu cầu đổi trả và cách tính tiền hoàn tại Gói Huế.",
};

export default function Page() {
  return <PolicyPage kind="returns" />;
}
