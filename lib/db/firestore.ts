import "server-only";
import { randomUUID } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { AppError, logError } from "@/lib/errors";
import { StoredProjectSchema } from "@/lib/schemas/storyboard";
import type { ContinuityCheck, ProjectSummary, Scene, StoredProject, Storyboard } from "@/types";
import type { ProjectRepository, SceneLocation } from "./repository";

// Cloud Firestore implementation (Firebase Admin SDK, server-only).
//
// One document per project in `projects/{uuid}`: the summary fields used by the list view, the full
// storyboard, and `sceneIds` so a scene can be found with an `array-contains` query. A storyboard is
// well under Firestore's 1 MiB document limit, and keeping it in one document makes every write atomic.
// Client access is denied by firestore.rules; only this server (service account) can read or write.

const COLLECTION = "projects";
const APP_NAME = "video-story-ai-builder";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUMMARY_FIELDS = ["title", "theme", "genre", "duration", "aspectRatio", "language", "sceneCount", "createdAt"] as const;

export interface FirestoreCredentials {
  projectId: string;
  /** Service-account credentials. Omit when FIRESTORE_EMULATOR_HOST is set (local emulator). */
  clientEmail?: string;
  privateKey?: string;
}

interface ProjectDoc {
  title: string;
  theme: string;
  genre: string;
  duration: number;
  aspectRatio: string;
  language: string;
  sceneCount: number;
  sceneIds: string[];
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  storyboard: Storyboard;
}

function toDoc(project: StoredProject): ProjectDoc {
  const p = project.storyboard.project;
  return {
    title: p.title,
    theme: p.theme,
    genre: p.genre,
    duration: p.duration,
    aspectRatio: p.aspectRatio,
    language: p.language,
    sceneCount: project.storyboard.scenes.length,
    sceneIds: project.storyboard.scenes.map((s) => s.id!),
    ownerId: null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    storyboard: project.storyboard,
  };
}

/** Validates a stored document; returns null (and logs) if it no longer matches the schema. */
function fromDoc(id: string, data: DocumentData | undefined): StoredProject | null {
  if (!data) return null;
  const parsed = StoredProjectSchema.safeParse({
    id,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    storyboard: data.storyboard,
  });
  if (!parsed.success) {
    logError("firestore", new Error(`Project ${id} failed schema validation; ignoring`));
    return null;
  }
  return parsed.data;
}

function connect(credentials: FirestoreCredentials): Firestore {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return getFirestore(existing);

  const { projectId, clientEmail, privateKey } = credentials;
  const app = initializeApp(
    clientEmail && privateKey
      ? { projectId, credential: cert({ projectId, clientEmail, privateKey }) }
      : { projectId }, // emulator: FIRESTORE_EMULATOR_HOST routes all traffic locally, no credentials needed
    APP_NAME,
  );
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export class FirestoreRepository implements ProjectRepository {
  readonly driver = "firestore" as const;
  private readonly db: Firestore;

  constructor(credentials: FirestoreCredentials) {
    this.db = connect(credentials);
  }

  private get projects() {
    return this.db.collection(COLLECTION);
  }

  private async guard<T>(context: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("DB_FAILED", { cause: error, detail: `firestore ${context}` });
    }
  }

  listProjects(limit = 100): Promise<ProjectSummary[]> {
    return this.guard("list", async () => {
      const snap = await this.projects
        .orderBy("createdAt", "desc")
        .limit(limit)
        .select(...SUMMARY_FIELDS)
        .get();
      return snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          title: x.title,
          theme: x.theme,
          genre: x.genre,
          duration: x.duration,
          aspectRatio: x.aspectRatio,
          language: x.language,
          sceneCount: x.sceneCount,
          createdAt: x.createdAt,
        };
      });
    });
  }

  getProject(id: string): Promise<StoredProject | null> {
    if (!UUID_RE.test(id)) return Promise.resolve(null);
    return this.guard("get", async () => {
      const snap = await this.projects.doc(id).get();
      return fromDoc(snap.id, snap.data());
    });
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
      // create() fails instead of overwriting if the id somehow already exists.
      await this.projects.doc(project.id).create(toDoc(project));
      return project;
    });
  }

  deleteProject(id: string): Promise<boolean> {
    if (!UUID_RE.test(id)) return Promise.resolve(false);
    return this.guard("delete", () =>
      this.db.runTransaction(async (tx) => {
        const ref = this.projects.doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) return false;
        tx.delete(ref);
        return true;
      }),
    );
  }

  findScene(sceneId: string): Promise<SceneLocation | null> {
    if (!UUID_RE.test(sceneId)) return Promise.resolve(null);
    return this.guard("findScene", async () => {
      const snap = await this.projects.where("sceneIds", "array-contains", sceneId).limit(1).get();
      const doc = snap.docs[0];
      const project = doc ? fromDoc(doc.id, doc.data()) : null;
      const scene = project?.storyboard.scenes.find((s) => s.id === sceneId);
      return project && scene ? { projectId: project.id, sceneNumber: scene.sceneNumber, project } : null;
    });
  }

  updateScene(sceneId: string, scene: Scene, continuity: ContinuityCheck): Promise<void> {
    if (!UUID_RE.test(sceneId)) return Promise.reject(new AppError("NOT_FOUND", { detail: "scene not found" }));
    return this.guard("updateScene", () =>
      // Read-modify-write in one transaction so concurrent regenerations cannot overwrite each other.
      this.db.runTransaction(async (tx) => {
        const snap = await tx.get(this.projects.where("sceneIds", "array-contains", sceneId).limit(1));
        const doc = snap.docs[0];
        const project = doc ? fromDoc(doc.id, doc.data()) : null;
        if (!doc || !project) throw new AppError("NOT_FOUND", { detail: "scene not found" });

        const storyboard: Storyboard = {
          ...project.storyboard,
          continuityCheck: continuity,
          scenes: project.storyboard.scenes.map((s) => (s.id === sceneId ? { ...scene, id: sceneId } : s)),
        };
        tx.update(doc.ref, { storyboard, updatedAt: new Date().toISOString() });
      }),
    );
  }
}
