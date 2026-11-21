import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string | string[] }>;
}) {
  return <AuthForm returnToCheckout={(await searchParams).returnUrl === "/checkout"} />;
}
