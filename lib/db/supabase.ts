import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError, logError } from "@/lib/errors";
import type { ContinuityCheck, ProjectSummary, Scene, StoredProject, Storyboard } from "@/types";
import { rowsToStoredProject, sceneToRow, toCreatePayload, type ProjectRow, type StoryboardRow } from "./mappers";
import type { ProjectRepository, SceneLocation } from "./repository";

// Supabase implementation. Uses the service-role key on the server only; RLS blocks anon access.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST returns a to-one embed as an object, but older schemas may yield an array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type PgError = { code?: string; message: string } | null;

export class SupabaseRepository implements ProjectRepository {
  readonly driver = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private fail(context: string, error: PgError | unknown): never {
    const e = error as PgError;
    throw new AppError("DB_FAILED", { detail: `supabase ${context}: ${e?.code ?? ""} ${e?.message ?? String(error)}` });
  }

  async listProjects(limit = 100): Promise<ProjectSummary[]> {
    let rows: Record<string, unknown>[] | null = null;
    let fallbackMode = false;

    const res = await this.db
      .from("projects")
      .select("id, title, theme, genre, duration, aspect_ratio, language, created_at, storyboards(scenes(count))")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (res.error) {
      // Fallback query in case PostgREST schema cache doesn't support nested scenes(count)
      const fallbackRes = await this.db
        .from("projects")
        .select("id, title, theme, genre, duration, aspect_ratio, language, created_at, storyboards(scenes(id))")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fallbackRes.error) this.fail("list", fallbackRes.error);
      rows = (fallbackRes.data as unknown as Record<string, unknown>[]) ?? null;
      fallbackMode = true;
    } else {
      rows = (res.data as unknown as Record<string, unknown>[]) ?? null;
    }

    return (rows ?? []).map((row) => {
      const sb = one(row.storyboards as unknown as { scenes?: { count?: number; id?: string }[] | { count?: number } } | null);
      let sceneCount = 0;
      if (sb?.scenes) {
        if (fallbackMode) {
          sceneCount = Array.isArray(sb.scenes) ? sb.scenes.length : 0;
        } else {
          const first = Array.isArray(sb.scenes) ? sb.scenes[0] : sb.scenes;
          if (first && typeof first === "object" && "count" in first) {
            sceneCount = Number(first.count) || 0;
          } else if (Array.isArray(sb.scenes)) {
            sceneCount = sb.scenes.length;
          }
        }
      }
      return {
        id: row.id as string,
        title: row.title as string,
        theme: row.theme as string,
        genre: row.genre as string,
        duration: row.duration as number,
        aspectRatio: row.aspect_ratio as string,
        language: row.language as string,
        sceneCount,
        createdAt: row.created_at as string,
      };
    });
  }

  async getProject(id: string): Promise<StoredProject | null> {
    if (!UUID_RE.test(id)) return null;
    const { data, error } = await this.db
      .from("projects")
      .select("*, storyboards(*, scenes(*))")
      .eq("id", id)
      .maybeSingle();
    if (error) this.fail("get", error);
    if (!data) return null;

    const storyboard = one(data.storyboards as StoryboardRow | StoryboardRow[] | null);
    if (!storyboard) return null;
    const project = rowsToStoredProject(data as ProjectRow, storyboard);
    if (!project) logError("supabase", new Error(`Project ${id} failed schema validation`));
    return project;
  }

  async createProject(storyboard: Storyboard): Promise<StoredProject> {
    const { data, error } = await this.db.rpc("create_project_with_storyboard", { payload: toCreatePayload(storyboard) });
    if (error) this.fail("create", error);
    const project = await this.getProject(data as string);
    if (!project) this.fail("create", { message: "created project could not be read back" });
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!UUID_RE.test(id)) return false;
    const { data, error } = await this.db.from("projects").delete().eq("id", id).select("id");
    if (error) this.fail("delete", error);
    return (data ?? []).length > 0;
  }

  async findScene(sceneId: string): Promise<SceneLocation | null> {
    if (!UUID_RE.test(sceneId)) return null;
    const { data, error } = await this.db
      .from("scenes")
      .select("id, scene_number, storyboards!inner(project_id)")
      .eq("id", sceneId)
      .maybeSingle();
    if (error) this.fail("findScene", error);
    if (!data) return null;

    const projectId = one(data.storyboards as unknown as { project_id: string } | null)?.project_id;
    const project = projectId ? await this.getProject(projectId) : null;
    if (!project) return null;
    return { projectId: project.id, sceneNumber: data.scene_number, project };
  }

  async updateScene(sceneId: string, scene: Scene, continuity: ContinuityCheck): Promise<void> {
    // scene_number and duration are fixed for a regeneration; the RPC ignores them.
    const { error } = await this.db.rpc("apply_scene_regeneration", {
      p_scene_id: sceneId,
      p_scene: sceneToRow(scene),
      p_continuity: continuity,
    });
    if (error?.code === "P0002") throw new AppError("NOT_FOUND", { detail: "scene not found" });
    if (error) this.fail("updateScene", error);
  }
}
