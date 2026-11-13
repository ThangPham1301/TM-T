import { Account } from "@/components/account";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["profile", "orders", "returns", "privacy", "addresses", "security"].includes(section))
    notFound();
  return <Account key={section} section={section} />;
}
