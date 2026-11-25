export type PolicyTopic = "privacy" | "shipping" | "returns";

export const policyInfo = {
  privacy: { href: "/privacy-policy", title: "Chính sách quyền riêng tư" },
  shipping: { href: "/shipping-payment-policy", title: "Chính sách đặt hàng, thanh toán và giao hàng" },
  returns: { href: "/return-policy", title: "Chính sách đổi trả và hoàn tiền" },
} satisfies Record<PolicyTopic, { href: string; title: string }>;

export type PolicyVersion = {
  id: string;
  topic?: PolicyTopic;
  title: string;
  version: string;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  content: string;
  revision: number;
  createdAt: string;
  publishedAt?: string;
};

export function policySections(content: string) {
  const sections: { id: string; title: string; content: string }[] = [];
  let current: (typeof sections)[number] | undefined;
  for (const line of content.split(/\r?\n/u)) {
    if (/^### +\S/u.test(line)) {
      current = { id: `dieu-${sections.length + 1}`, title: line.slice(4).trim(), content: "" };
      sections.push(current);
    } else if (current) {
      current.content += line + "\n";
    } else if (line.trim()) {
      current = { id: "dieu-1", title: "Nội dung chính sách", content: line + "\n" };
      sections.push(current);
    }
  }
  return sections;
}
