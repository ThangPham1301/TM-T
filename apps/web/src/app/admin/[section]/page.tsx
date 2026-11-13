import { Account } from "@/components/account";
import { CatalogAdmin } from "@/components/catalog-admin";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    section === "products" ||
    section === "categories" ||
    section === "settings"
  )
    return <CatalogAdmin key={section} section={section} />;
  if (
    !["orders", "products", "returns", "privacy", "policies", "audit"].includes(
      section,
    )
  )
    notFound();
  return <Account key={section} admin section={section} />;
}
