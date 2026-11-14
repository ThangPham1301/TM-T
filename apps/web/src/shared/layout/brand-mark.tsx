import Link from "next/link";
import Image from "next/image";
import styles from "./layout.module.css";

export type BrandMarkProps = { logoSrc?: string; href?: string; label?: string };
/** Supply only an approved original asset; absent asset falls back to text. */
export function BrandMark({ logoSrc, href = "/", label = "Gói Huế" }: BrandMarkProps) {
  return <Link href={href} className={styles.brand} aria-label={label}>
    {logoSrc ? <Image src={logoSrc} alt={label} width={160} height={72} unoptimized className={styles.logo} /> : <span>{label}</span>}
  </Link>;
}

