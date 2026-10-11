import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, logError } from "@/lib/errors";
import { StoredProjectSchema } from "@/lib/schemas/storyboard";
import type { ContinuityCheck, ProjectSummary, Scene, StoredProject, Storyboard } from "@/types";
import { toSummary } from "./mappers";
import type { ProjectRepository, SceneLocation } from "./repository";

// Development-only store: one JSON file per project under LOCAL_DATA_DIR/projects.
// Not suitable for serverless deployments (ephemeral, per-instance file systems) — use Firestore there.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LocalFileRepository implements ProjectRepository {
  readonly driver = "local" as const;
  private readonly dir: string;

  constructor(baseDir: string) {
    this.dir = path.resolve(baseDir, "projects");
  }

  private file(id: string): string {
    // ids are validated as UUIDs, so they can never escape the data directory.
    if (!UUID_RE.test(id)) throw new AppError("NOT_FOUND", { detail: "invalid id" });
    return path.join(this.dir, `${id}.json`);
  }

  private async guard<T>(context: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("DB_FAILED", { cause: error, detail: `local store: ${context}` });
    }
  }

  private async read(id: string): Promise<StoredProject | null> {
    let raw: string;
    try {
      raw = await readFile(this.file(id), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    const parsed = StoredProjectSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logError("local-store", new Error(`Project ${id} failed validation; ignoring`));
      return null;
    }
    return parsed.data;
  }

  private async write(project: StoredProject): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const target = this.file(project.id);
    const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(project, null, 2), "utf8");
    await rename(temp, target); // atomic replace
  }

  private async all(): Promise<StoredProject[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const ids = names.filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).filter((id) => UUID_RE.test(id));
    const projects = await Promise.all(ids.map((id) => this.read(id)));
    return projects.filter((p): p is StoredProject => p !== null);
  }

  listProjects(limit = 100): Promise<ProjectSummary[]> {
    return this.guard("list", async () =>
      (await this.all())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(toSummary),
    );
  }

  getProject(id: string): Promise<StoredProject | null> {
    if (!UUID_RE.test(id)) return Promise.resolve(null);
    return this.guard("get", () => this.read(id));
  }

  createProject(storyboard: Storyboard): Promise<StoredProject> {
    return this.guard("create", async () => {
      const now = new Date().toISOString();
      const project: StoredProject = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        storyboard: { ...storyboard, scenes: storyboard.scenes.map((s) => ({ ...s, id: randomUUID() })) },
      };
      await this.write(project);
      return project;
    });
  }

  deleteProject(id: string): Promise<boolean> {
    if (!UUID_RE.test(id)) return Promise.resolve(false);
    return this.guard("delete", async () => {
      if (!(await this.read(id))) return false;
      await rm(this.file(id));
      return true;
    });
  }

  findScene(sceneId: string): Promise<SceneLocation | null> {
    return this.guard("findScene", async () => {
      for (const project of await this.all()) {
        const scene = project.storyboard.scenes.find((s) => s.id === sceneId);
        if (scene) return { projectId: project.id, sceneNumber: scene.sceneNumber, project };
      }
      return null;
    });
  }

  updateScene(sceneId: string, scene: Scene, continuity: ContinuityCheck): Promise<void> {
    return this.guard("updateScene", async () => {
      const location = await this.findScene(sceneId);
      if (!location) throw new AppError("NOT_FOUND", { detail: "scene not found" });
      const { project } = location;
      await this.write({
        ...project,
        updatedAt: new Date().toISOString(),
        storyboard: {
          ...project.storyboard,
          continuityCheck: continuity,
          scenes: project.storyboard.scenes.map((s) => (s.id === sceneId ? { ...scene, id: sceneId } : s)),
        },
      });
    });
  }
}
