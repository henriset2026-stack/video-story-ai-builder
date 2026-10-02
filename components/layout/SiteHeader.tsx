import Link from "next/link";
import { getPublicStatus } from "@/lib/config";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  const status = getPublicStatus();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-graphite/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="type-billing text-xl text-chalk sm:text-2xl">
          Video Story AI Builder
        </Link>
        {status.mockMode && (
          <Link
            href="/settings"
            className="rounded-full border border-bluehour/60 px-2.5 py-0.5 text-xs text-bluehour hover:border-bluehour"
            title="No AI provider key is configured, so storyboards use deterministic mock data."
          >
            Mock data
          </Link>
        )}
        <NavLinks />
      </div>
    </header>
  );
}
