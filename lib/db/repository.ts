import "server-only";
import { getConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import type { ContinuityCheck, ProjectSummary, Scene, StoredProject, Storyboard } from "@/types";
import { LocalFileRepository } from "./local";
import { SupabaseRepository } from "./supabase";

// Storage abstraction. Route handlers and pages depend on this interface only.

export interface SceneLocation {
  projectId: string;
  sceneNumber: number;
  project: StoredProject;
}

export interface ProjectRepository {
  readonly driver: "supabase" | "local";
  listProjects(limit?: number): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<StoredProject | null>;
  /** Persists a new project atomically and returns it with generated ids. */
  createProject(storyboard: Storyboard): Promise<StoredProject>;
  /** Returns false when the project did not exist. */
  deleteProject(id: string): Promise<boolean>;
  findScene(sceneId: string): Promise<SceneLocation | null>;
  /** Replaces one scene's content and the storyboard continuity check atomically. */
  updateScene(sceneId: string, scene: Scene, continuity: ContinuityCheck): Promise<void>;
}

let instance: ProjectRepository | null = null;

export function getRepository(): ProjectRepository {
  if (instance) return instance;
  const { storage } = getConfig();
  if (storage.driver === "supabase") {
    if (!storage.supabaseUrl || !storage.supabaseServiceRoleKey) {
      throw new AppError("DB_FAILED", {
        detail: "STORAGE_DRIVER=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      });
    }
    instance = new SupabaseRepository(storage.supabaseUrl, storage.supabaseServiceRoleKey);
  } else {
    instance = new LocalFileRepository(storage.localDataDir);
  }
  return instance;
}
