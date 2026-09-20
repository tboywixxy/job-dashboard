import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return <Link href="/" aria-label="Mastaskillz home" className={`brand-logo ${compact ? "brand-logo-compact" : "brand-logo-expanded"} ${className}`}>
    <Image src={compact ? "/MASTASKILLZ.svg" : "/logo.svg"} alt="Mastaskillz" width={compact ? 41 : 167} height={compact ? 54 : 41} unoptimized priority />
  </Link>;
}


