import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { StoryboardView } from "@/components/storyboard/StoryboardView";
import { getRepository } from "@/lib/db/repository";

const loadProject = cache((id: string) => getRepository().getProject(id));

export async function generateMetadata({ params }: PageProps<"/storyboard/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await loadProject(id).catch(() => null);
  return { title: project ? project.storyboard.project.title : "Storyboard" };
}

export default async function StoryboardPage({ params }: PageProps<"/storyboard/[id]">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();

  return (
    <>
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-4 pt-6 text-sm sm:px-6">
        <Link href={`/projects/${project.id}`} className="text-fog hover:text-chalk">
          Project details
        </Link>
        <Link href="/projects" className="text-fog hover:text-chalk">
          All projects
        </Link>
        <Link href="/create" className="text-fog hover:text-chalk">
          Create another video
        </Link>
      </div>
      <StoryboardView project={project} />
    </>
  );
}
