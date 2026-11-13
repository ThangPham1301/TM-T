import { Catalog } from "@/components/commerce";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <Catalog slug={(await params).slug} />;
}
