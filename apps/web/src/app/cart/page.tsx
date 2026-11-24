import { Cart } from "@/components/cart";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const source = typeof query.reorder === "string" ? query.reorder : undefined;
  return <Cart reorderOrderId={source} />;
}
