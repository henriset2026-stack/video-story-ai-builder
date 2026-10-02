import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { getRepository } from "@/lib/db/repository";

const loadProject = cache((id: string) => getRepository().getProject(id));
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" });

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await loadProject(id).catch(() => null);
  return { title: project ? `${project.storyboard.project.title} — details` : "Project" };
}

export default async function ProjectDetailPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();

  const sb = project.storyboard;
  const p = sb.project;
  const facts: [string, string][] = [
    ["Genre", p.genre],
    ["Duration", `${p.duration} seconds`],
    ["Aspect ratio", p.aspectRatio],
    ["Language", p.language],
    ["Scenes", String(sb.scenes.length)],
    ["Characters", sb.characters.map((c) => c.name).join(", ")],
    ["Continuity", sb.continuityCheck.status === "PASS" ? "Pass" : "Needs revision"],
    ["Created", dateFormat.format(new Date(project.createdAt))],
    ["Last updated", dateFormat.format(new Date(project.updatedAt))],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/projects" className="text-sm text-fog hover:text-chalk">
        All projects
      </Link>
      <h1 className="type-billing mt-3 text-5xl sm:text-6xl">{p.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-chalk">{p.logline}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`/storyboard/${project.id}`} className="rounded bg-tungsten px-5 py-3 font-semibold text-ink hover:bg-[#f3bd5e]">
          Open storyboard
        </Link>
        <DeleteProjectButton projectId={project.id} title={p.title} redirectTo="/projects" />
      </div>

      <section aria-labelledby="idea-heading" className="sheet mt-10 p-6">
        <h2 id="idea-heading" className="text-sm text-ink-muted">
          Original idea
        </h2>
        <p className="mt-1 text-lg">{p.theme}</p>
      </section>

      <dl className="mt-10 grid gap-x-8 gap-y-5 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="border-t border-line pt-3">
            <dt className="text-sm text-fog">{k}</dt>
            <dd className="mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="scenes-heading" className="mt-12">
        <h2 id="scenes-heading" className="type-billing text-3xl">
          Scenes
        </h2>
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {sb.scenes.map((s) => (
            <li key={s.id ?? s.sceneNumber}>
              <Link
                href={`/storyboard/${project.id}#scene-${s.sceneNumber}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5 hover:text-tungsten"
              >
                <span className="type-billing w-8 text-2xl text-tungsten">{s.sceneNumber}</span>
                <span className="flex-1 font-semibold">{s.title}</span>
                <span className="text-sm text-fog">
                  {s.timeOfDay}, {s.duration}s
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
