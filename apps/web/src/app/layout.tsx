import type { Metadata } from "next";
import localFont from "next/font/local";
import { StoreProvider } from "@/lib/store";
import {
  SiteHeader,
  SiteFooter,
  StatusMessages,
  StorePauseBanner,
} from "@/components/site-shell";
import "@/styles/heritage.css";
import "@/styles/tokens.css";
import "@/styles/store.css";
import "@/styles/lan.css";
import "@/styles/account-figma.css";

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
    <html lang="vi" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body>
        <StoreProvider>
          <SiteHeader />
          <StorePauseBanner />
          <StatusMessages />
          {children}
          <SiteFooter />
        </StoreProvider>
      </body>
    </html>
  );
}
