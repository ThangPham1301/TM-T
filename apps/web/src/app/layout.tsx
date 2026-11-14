import type { Metadata } from "next";
import localFont from "next/font/local";
import { StoreProvider } from "@/lib/store";
import {
  SiteHeader,
  SiteFooter,
  StatusMessages,
} from "@/components/site-shell";
import "@/styles/heritage.css";
import "@/styles/tokens.css";
import "@/styles/store.css";

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
      <body>
        <StoreProvider>
          <SiteHeader />
          <StatusMessages />
          {children}
          <SiteFooter />
        </StoreProvider>
      </body>
    </html>
  );
}
