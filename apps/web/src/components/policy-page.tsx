import type { PolicyTopic, PolicyVersion } from "@/lib/policies";
import { Policies } from "./policies";

export async function PolicyPage({ kind }: { kind: PolicyTopic }) {
  let policy: PolicyVersion | null = null;
  try {
    const upstream = process.env.API_UPSTREAM_URL ?? "http://127.0.0.1:8088/api/v1";
    const response = await fetch(`${upstream}/policy/${kind}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const document: PolicyVersion = await response.json();
      if (document.status === "PUBLISHED" && document.topic === kind) policy = document;
    }
  } catch {
    // The page remains navigable while the policy service is unavailable.
  }
  return <Policies kind={kind} policy={policy} />;
}
