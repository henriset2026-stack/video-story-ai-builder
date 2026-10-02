import type { Metadata } from "next";
import Link from "next/link";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { getRepository } from "@/lib/db/repository";

export const metadata: Metadata = { title: "Projects" };

// Always read the latest projects; never prerender this list at build time.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function ProjectsPage() {
  const projects = await getRepository().listProjects();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-billing text-5xl sm:text-6xl">Projects</h1>
          <p className="mt-2 text-fog">
            {projects.length === 0
              ? "Nothing here yet."
              : `${projects.length} saved ${projects.length === 1 ? "storyboard" : "storyboards"}, newest first.`}
          </p>
        </div>
        <Link href="/create" className="rounded bg-tungsten px-5 py-3 font-semibold text-ink hover:bg-[#f3bd5e]">
          Create video
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded border border-dashed border-line p-10 text-center">
          <p className="type-billing text-3xl">Your first storyboard is one idea away</p>
          <p className="mx-auto mt-3 max-w-md text-fog">
            Write an idea, pick a genre and length, and the builder saves the full storyboard here.
          </p>
          <Link href="/create" className="mt-6 inline-block rounded bg-tungsten px-5 py-3 font-semibold text-ink hover:bg-[#f3bd5e]">
            Create my video
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-col rounded border border-line bg-graphite-2 p-5">
              <h2 className="type-billing text-2xl">
                <Link href={`/storyboard/${p.id}`} className="hover:text-tungsten">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-2 line-clamp-2 text-fog">{p.theme}</p>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-fog">Genre</dt>
                  <dd>{p.genre}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fog">Duration</dt>
                  <dd>{p.duration} seconds</dd>
                </div>
                <div>
                  <dt className="text-xs text-fog">Scenes</dt>
                  <dd>{p.sceneCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fog">Created</dt>
                  <dd>
                    <time dateTime={p.createdAt}>{dateFormat.format(new Date(p.createdAt))}</time>
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Link href={`/storyboard/${p.id}`} className="rounded border border-line px-4 py-2 text-sm font-semibold hover:border-tungsten">
                  Open storyboard
                </Link>
                <Link href={`/projects/${p.id}`} className="rounded px-3 py-2 text-sm text-fog hover:text-chalk">
                  Details
                </Link>
                <div className="ml-auto">
                  <DeleteProjectButton projectId={p.id} title={p.title} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
