import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Chính sách đặt hàng, thanh toán và giao hàng",
  description: "Hướng dẫn đặt hàng, thanh toán, xem phí giao và tra cứu đơn tại Gói Huế.",
};

export default function Page() {
  return <PolicyPage kind="shipping" />;
}
