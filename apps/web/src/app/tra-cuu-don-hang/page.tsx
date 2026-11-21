import type { Metadata } from "next";
import { GuestOrderPage } from "@/components/guest-order";
import { normalizeOrderNumber } from "@/lib/guest-order";

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng",
  description: "Theo dõi đơn hàng Gói Huế bằng mã đơn và mã tra cứu của bạn.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const number = normalizeOrderNumber(query.don);
  return <GuestOrderPage key={number} number={number} confirmation={query["xac-nhan"] === "1"} />;
}
