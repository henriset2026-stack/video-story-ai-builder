"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-2 transition-colors hover:text-chalk ${active ? "text-chalk" : "text-fog"}`}
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/create"
        aria-current={pathname === "/create" ? "page" : undefined}
        className="ml-1 rounded bg-tungsten px-3.5 py-2 font-semibold text-ink transition-colors hover:bg-[#f3bd5e]"
      >
        Create video
      </Link>
    </nav>
  );
}
