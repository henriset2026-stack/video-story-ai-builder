import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="type-billing text-5xl sm:text-6xl">This page isn’t in the edit</h1>
      <p className="mt-4 text-lg text-fog">The project may have been deleted, or the link is wrong.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/projects" className="rounded bg-tungsten px-5 py-3 font-semibold text-ink hover:bg-[#f3bd5e]">
          Go to projects
        </Link>
        <Link href="/create" className="rounded border border-line px-5 py-3 font-semibold hover:border-fog">
          Create a video
        </Link>
      </div>
    </div>
  );
}
