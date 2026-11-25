import Link from "next/link";
import type { ReactNode } from "react";

function inlineFormatting(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(\/[^)\n]*\))/g).map((part, index) => {
    const link = /^\[([^\]\n]+)\]\((\/[a-z0-9/-]*(?:#[a-z0-9-]+)?)\)$/u.exec(part);
    if (link && !link[2].startsWith("//")) return <Link key={index} href={link[2]}>{link[1]}</Link>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function PolicyPreview({ content, className = "operations-policy-copy" }: { content: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  function finishList() {
    if (!list.length) return;
    blocks.push(<ul key={blocks.length}>{list.map((item, i) => <li key={i}>{inlineFormatting(item)}</li>)}</ul>);
    list = [];
  }
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*[-*] /.test(line)) {
      list.push(line.trimStart().slice(2));
      continue;
    }
    finishList();
    if (line.startsWith("### ")) {
      blocks.push(<h4 key={blocks.length}>{inlineFormatting(line.slice(4))}</h4>);
    } else if (line.trim()) {
      blocks.push(<p key={blocks.length}>{inlineFormatting(line)}</p>);
    }
  }
  finishList();
  return <div className={className}>{blocks}</div>;
}
