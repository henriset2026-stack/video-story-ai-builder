import type { ProjectSummary, StoredProject } from "@/types";

// Shared mapping helpers for repository implementations.

export function toSummary(p: StoredProject): ProjectSummary {
  const m = p.storyboard.project;
  return {
    id: p.id,
    title: m.title,
    theme: m.theme,
    genre: m.genre,
    duration: m.duration,
    aspectRatio: m.aspectRatio,
    language: m.language,
    sceneCount: p.storyboard.scenes.length,
    createdAt: p.createdAt,
  };
}
