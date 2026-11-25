"use client";

import styles from "@/components/recommendation-rail.module.css";
import { RecommendationRail } from "@/components/recommendation-rail";

export default function RecommendationsPage() {
  return (
    <main className={`gh-wrap ${styles.page}`}>
      <header className={styles.pageHeading}><span>Đặc sản đất Cố Đô</span><h1>Gợi ý từ cửa hàng</h1><p>Một vài thức quà để bạn tiếp tục khám phá hương vị Huế.</p></header>
      <RecommendationRail surface="home" />
    </main>
  );
}
