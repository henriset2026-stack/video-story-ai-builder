import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { applyReviewFixes } from "@/lib/ai/engines/continuity";
import { MockProvider } from "@/lib/ai/mock/provider";
import { generateStoryboard } from "@/lib/ai/orchestrator";
import { extractJson, HttpProvider, type RawStructuredCall } from "@/lib/ai/providers/base";
import { allocateDurations, applyContinuityRules, summarizeContinuity } from "@/lib/continuity/rules";
import { LocalFileRepository } from "@/lib/db/local";
import { rowsToStoredProject, sceneToRow, toCreatePayload } from "@/lib/db/mappers";
import { redactSecrets } from "@/lib/errors";
import { MemoryRateLimiter } from "@/lib/http";
import { GenerationInputSchema, RegenerateSceneInputSchema } from "@/lib/schemas/input";
import type { Storyboard } from "@/types";

async function sample(): Promise<Storyboard> {
  return generateStoryboard(new MockProvider(0), GenerationInputSchema.parse({ theme: "Robot AI membantu petani Indonesia." }));
}

function draftOf(sb: Storyboard) {
  const { continuityCheck: _check, ...draft } = sb;
  void _check;
  return draft;
}

describe("input validation", () => {
  it("rejects empty and too-short ideas with a friendly message", () => {
    const r = GenerationInputSchema.safeParse({ theme: "  hi " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/at least 10 characters/);
  });

  it("applies the product defaults", () => {
    expect(GenerationInputSchema.parse({ theme: "Seorang anak menemukan surat lama ayahnya." })).toMatchObject({
      genre: "Cinematic",
      duration: 30,
      aspectRatio: "16:9",
      language: "Indonesian",
      sceneCount: 3,
    });
  });

  it("rejects unsupported durations and too many scenes for the duration", () => {
    expect(GenerationInputSchema.safeParse({ theme: "x".repeat(20), duration: 31 }).success).toBe(false);
    expect(GenerationInputSchema.safeParse({ theme: "x".repeat(20), duration: 15, sceneCount: 8 }).success).toBe(false);
  });

  it("treats a blank regeneration instruction as none", () => {
    expect(RegenerateSceneInputSchema.parse({ instruction: "   " }).instruction).toBeUndefined();
  });
});

describe("continuity rules", () => {
  it("allocates durations that always add up", () => {
    expect(allocateDurations(30, 3)).toEqual([10, 10, 10]);
    expect(allocateDurations(45, 4).reduce((a, b) => a + b)).toBe(45);
    expect(allocateDurations(15, 5)).toEqual([3, 3, 3, 3, 3]);
  });

  it("fixes durations, unknown characters, missing locks, aspect ratio and audio mode", async () => {
    const draft = draftOf(await sample());
    // The untouched storyboard may already carry low-severity advisories (e.g. a time-of-day jump);
    // those are warnings by design, so only the problems introduced below must be auto-fixed.
    const baseline = new Set(applyContinuityRules(draft).issues.map((i) => i.description));
    draft.scenes[0] = {
      ...draft.scenes[0],
      duration: 20,
      characters: [...draft.scenes[0].characters, "Stranger"],
      imagePrompt: "A".repeat(200),
      audioMode: "silence",
    };
    const { storyboard, issues } = applyContinuityRules(draft);
    const s = storyboard.scenes[0];

    expect(storyboard.scenes.reduce((n, x) => n + x.duration, 0)).toBe(30);
    expect(s.characters).not.toContain("Stranger");
    expect(s.imagePrompt).toContain("Consistent character reference: Pak Darto");
    expect(s.imagePrompt).toContain("aspect ratio 16:9");
    expect(s.audioMode).not.toBe("silence");
    const introduced = issues.filter((i) => !baseline.has(i.description));
    expect(introduced.length).toBeGreaterThanOrEqual(5);
    expect(introduced.every((i) => i.fixed)).toBe(true);
    expect(summarizeContinuity(issues).status).toBe("PASS");
  });

  it("marks dialogue that cannot fit the scene as NEEDS_REVISION", async () => {
    const draft = draftOf(await sample());
    const line = { ...draft.scenes[1].dialogue[0], text: "kata ".repeat(60).trim() };
    draft.scenes[1] = { ...draft.scenes[1], dialogue: [line], audioMode: "dialogue", voiceOver: [] };
    const { issues } = applyContinuityRules(draft);
    const check = summarizeContinuity(issues);
    expect(check.status).toBe("NEEDS_REVISION");
    expect(check.groups.audio.status).toBe("fail");
  });

  it("applies AI review fixes only to editable scenes and rejects too-short rewrites", async () => {
    const draft = draftOf(await sample());
    const longPrompt = "Wide shot of the valley at dawn with consistent wardrobe. ".repeat(5);
    const { storyboard, issues } = applyReviewFixes(
      draft,
      {
        issues: [
          { category: "Lighting", sceneNumber: 1, severity: "medium", description: "a", fix: { field: "imagePrompt", value: longPrompt } },
          { category: "Lighting", sceneNumber: 2, severity: "medium", description: "b", fix: { field: "imagePrompt", value: longPrompt } },
          { category: "Props", sceneNumber: 1, severity: "low", description: "c", fix: { field: "videoPrompt", value: "too short" } },
        ],
      },
      [1],
    );
    expect(storyboard.scenes[0].imagePrompt).toBe(longPrompt.trim());
    expect(storyboard.scenes[1].imagePrompt).toBe(draft.scenes[1].imagePrompt);
    expect(issues.map((i) => i.fixed)).toEqual([true, false, false]);
  });
});

describe("provider contract", () => {
  class FakeProvider extends HttpProvider {
    readonly name = "fake";
    calls = 0;
    constructor(private readonly responses: unknown[]) {
      super({ apiKey: "k", model: "m", timeoutMs: 5_000 });
    }
    protected async callText() {
      return "ok";
    }
    protected async callStructured(call: RawStructuredCall) {
      this.calls++;
      if (this.calls === 2) expect(call.prompt).toContain("failed validation");
      return this.responses[this.calls - 1];
    }
  }
  const schema = z.object({ title: z.string().min(3) });

  it("repairs invalid output once", async () => {
    const p = new FakeProvider([{ title: "x" }, { title: "Fixed" }]);
    await expect(p.generateStructured({ task: "story", schemaName: "s", schema, system: "", prompt: "p", input: null })).resolves.toEqual({ title: "Fixed" });
    expect(p.calls).toBe(2);
  });

  it("fails with AI_INVALID_RESPONSE when repair also fails", async () => {
    const p = new FakeProvider([{}, {}]);
    await expect(
      p.generateStructured({ task: "story", schemaName: "s", schema, system: "", prompt: "p", input: null }),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });

  it("extracts JSON wrapped in prose or code fences", () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('text {"a":2} more')).toEqual({ a: 2 });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("security helpers", () => {
  it("redacts API keys and JWTs from log lines", () => {
    const line = "failed with sk-ant-abcdefghijklmnop and eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3.abcdefghijklmnop";
    expect(redactSecrets(line)).toBe("failed with [redacted] and [redacted]");
  });

  it("rate limiter blocks after the limit within the window", async () => {
    const rl = new MemoryRateLimiter(2, 60_000);
    expect((await rl.hit("a")).allowed).toBe(true);
    expect((await rl.hit("a")).allowed).toBe(true);
    expect((await rl.hit("a")).allowed).toBe(false);
    expect((await rl.hit("b")).allowed).toBe(true);
  });
});

describe("persistence", () => {
  const dirs: string[] = [];
  afterAll(async () => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

  it("local repository: create, list, get, update scene, delete", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vsab-"));
    dirs.push(dir);
    const repo = new LocalFileRepository(dir);
    const sb = await sample();

    const created = await repo.createProject(sb);
    expect(created.storyboard.scenes.every((s) => s.id)).toBe(true);
    expect((await repo.listProjects()).map((p) => p.id)).toEqual([created.id]);
    expect((await repo.getProject(created.id))?.storyboard.project.title).toBe(sb.project.title);

    const target = created.storyboard.scenes[1];
    const loc = await repo.findScene(target.id!);
    expect(loc?.sceneNumber).toBe(2);
    await repo.updateScene(target.id!, { ...target, title: "New title" }, created.storyboard.continuityCheck);
    expect((await repo.getProject(created.id))?.storyboard.scenes[1].title).toBe("New title");

    expect(await repo.getProject("../../etc/passwd")).toBeNull();
    expect(await repo.deleteProject(created.id)).toBe(true);
    expect(await repo.deleteProject(created.id)).toBe(false);
    expect(await repo.listProjects()).toEqual([]);
  });

  it("Supabase mappers round-trip a storyboard", async () => {
    const sb = await sample();
    const payload = toCreatePayload(sb);
    const now = new Date().toISOString();
    const stored = rowsToStoredProject(
      { id: crypto.randomUUID(), created_at: now, updated_at: now, ...payload.project },
      {
        id: crypto.randomUUID(),
        project_id: crypto.randomUUID(),
        ...payload.storyboard,
        scenes: sb.scenes.map((s) => ({ ...sceneToRow(s), id: crypto.randomUUID() })).reverse(),
      },
    );
    expect(stored).not.toBeNull();
    expect(stored!.storyboard.scenes.map((s) => s.sceneNumber)).toEqual([1, 2, 3]);
    // toEqual ignores undefined properties, so clearing the DB-assigned ids compares content only.
    expect({ ...stored!.storyboard, scenes: stored!.storyboard.scenes.map((s) => ({ ...s, id: undefined })) }).toEqual(sb);
  });
});
