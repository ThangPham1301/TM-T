import { Catalog } from "@/components/commerce";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Catalog key={JSON.stringify(await searchParams)} />;
}
