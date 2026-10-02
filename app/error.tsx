"use client";

import Link from "next/link";

// Route error boundary. Shows a safe message only — raw error text and stack traces never reach users.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="type-billing text-5xl sm:text-6xl">This page couldn’t load</h1>
      <p className="mt-4 text-lg text-fog">
        We couldn’t reach the project database or something else went wrong. Your saved projects are not affected.
      </p>
      {error.digest && <p className="mt-2 text-sm text-fog">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="rounded bg-tungsten px-5 py-3 font-semibold text-ink hover:bg-[#f3bd5e]">
          Try again
        </button>
        <Link href="/" className="rounded border border-line px-5 py-3 font-semibold hover:border-fog">
          Go home
        </Link>
      </div>
    </div>
  );
}
