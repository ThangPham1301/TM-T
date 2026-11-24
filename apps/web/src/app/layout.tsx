import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@/components/analytics";
import localFont from "next/font/local";
import { StoreProvider } from "@/lib/store";
import {
  SiteHeader,
  SiteFooter,
  StatusMessages,
  StorePauseBanner,
} from "@/components/site-shell";
import { AssistantWidget } from "@/components/assistant-widget";
import floating from "@/components/assistant-widget.module.css";
import { StoreFeaturedOffer } from "@/components/discounts/offer-display";
import { PublicOffersProvider } from "@/components/discounts/use-public-offers";
import "@/styles/heritage.css";
import "@/styles/tokens.css";
import "@/styles/store.css";
import "@/styles/web-theme.css";
import "@/styles/lan.css";
import "@/styles/account-figma.css";
import "@/styles/gh-heritage.css";

const bodyFont = localFont({
  src: [
    { path: "../assets/fonts/BeVietnamPro-Regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/BeVietnamPro-Medium.ttf", weight: "500", style: "normal" },
    { path: "../assets/fonts/BeVietnamPro-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../assets/fonts/BeVietnamPro-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--gh-loaded-body",
});
const displayFont = localFont({
  src: [
    { path: "../assets/fonts/NotoSerif-Variable.ttf", weight: "100 900", style: "normal" },
    { path: "../assets/fonts/NotoSerif-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
  display: "swap",
  variable: "--gh-loaded-display",
});

export const metadata: Metadata = {
  title: { default: "Gói Huế · Phong vị Cố Đô", template: "%s · Gói Huế" },
  description:
    "Mè xửng, bánh mứt và quà biếu Huế. Mua sắm và chăm sóc sau bán hàng.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <StoreProvider>
          <Suspense fallback={null}><Analytics /></Suspense>
          <SiteHeader />
          <StorePauseBanner />
          <StatusMessages />
          <PublicOffersProvider>
            {children}
            <SiteFooter />
            <div className={floating.dock}>
              <StoreFeaturedOffer />
              <AssistantWidget />
            </div>
          </PublicOffersProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
