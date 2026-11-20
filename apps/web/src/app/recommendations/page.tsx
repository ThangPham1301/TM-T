"use client";

import { RecommendationRail } from "@/components/recommendation-rail";

export default function RecommendationsPage() {
  return (
    <main className="gh-wrap" style={{ padding: "40px 16px 72px" }}>
      <RecommendationRail surface="home" />
    </main>
  );
}
