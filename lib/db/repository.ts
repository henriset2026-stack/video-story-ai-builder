import "server-only";
import { getConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import type { ContinuityCheck, ProjectSummary, Scene, StoredProject, Storyboard } from "@/types";
import { FirestoreRepository } from "./firestore";
import { LocalFileRepository } from "./local";

// Storage abstraction. Route handlers and pages depend on this interface only.

export interface SceneLocation {
  projectId: string;
  sceneNumber: number;
  project: StoredProject;
}

export interface ProjectRepository {
  readonly driver: "firestore" | "local";
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
  if (storage.driver === "firestore") {
    const fb = storage.firebase;
    if (!fb.projectId || (!fb.usingEmulator && (!fb.clientEmail || !fb.privateKey))) {
      throw new AppError("DB_FAILED", {
        detail: "STORAGE_DRIVER=firestore requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY",
      });
    }
    instance = new FirestoreRepository({ projectId: fb.projectId, clientEmail: fb.clientEmail, privateKey: fb.privateKey });
  } else {
    instance = new LocalFileRepository(storage.localDataDir);
  }
  return instance;
}
