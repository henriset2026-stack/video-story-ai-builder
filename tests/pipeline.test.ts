import { describe, expect, it } from "vitest";
import { GENERATION_STEPS, EXAMPLE_THEMES } from "@/lib/constants";
import { generateStoryboard, regenerateScene } from "@/lib/ai/orchestrator";
import { MockProvider } from "@/lib/ai/mock/provider";
import { selectPreset } from "@/lib/ai/mock/build";
import { GenerationInputSchema } from "@/lib/schemas/input";
import { StoryboardSchema } from "@/lib/schemas/storyboard";
import type { GenerationInput } from "@/types";

const provider = new MockProvider(0);

function input(theme: string, overrides: Partial<GenerationInput> = {}): GenerationInput {
  return GenerationInputSchema.parse({ theme, ...overrides });
}

describe("generation pipeline (mock provider)", () => {
  it.each(EXAMPLE_THEMES)("produces a valid, continuous storyboard for %s", async (theme) => {
    const events: string[] = [];
    const sb = await generateStoryboard(provider, input(theme), {
      onProgress: (step, status) => events.push(`${step}:${status}`),
    });

    expect(StoryboardSchema.safeParse(sb).success).toBe(true);
    expect(sb.scenes).toHaveLength(3);
    expect(sb.scenes.reduce((n, s) => n + s.duration, 0)).toBe(30);
    expect(sb.continuityCheck.status).toBe("PASS");
    for (const step of GENERATION_STEPS) expect(events).toContain(`${step.id}:done`);

    for (const scene of sb.scenes) {
      expect(scene.imagePrompt).toContain("aspect ratio 16:9");
      expect(scene.videoPrompt).not.toBe(scene.imagePrompt);
      expect(scene.negativePrompt).toContain("extra fingers");
      for (const name of scene.characters) expect(sb.characters.map((c) => c.name)).toContain(name);
    }
  });

  it("handles the acceptance example and routes it to the farmer preset", async () => {
    const theme = "Video tentang seorang petani Indonesia yang menggunakan AI.";
    expect(selectPreset(theme).key).toBe("farmer");
    const sb = await generateStoryboard(provider, input(theme));
    expect(sb.project.language).toBe("Indonesian");
    expect(sb.characters.map((c) => c.name)).toContain("Pak Darto");
  });

  it.each([
    { sceneCount: 1, duration: 15 },
    { sceneCount: 5, duration: 45 },
    { sceneCount: 8, duration: 90 },
    { sceneCount: 5, duration: 15 },
  ])("supports $sceneCount scenes over $duration s", async ({ sceneCount, duration }) => {
    const sb = await generateStoryboard(provider, input(EXAMPLE_THEMES[0], { sceneCount, duration }));
    expect(sb.scenes).toHaveLength(sceneCount);
    expect(sb.scenes.map((s) => s.sceneNumber)).toEqual(Array.from({ length: sceneCount }, (_, i) => i + 1));
    expect(sb.scenes.reduce((n, s) => n + s.duration, 0)).toBe(duration);
    expect(sb.continuityCheck.status).toBe("PASS");
  });

  it("writes English story text when language is English", async () => {
    const sb = await generateStoryboard(provider, input(EXAMPLE_THEMES[0], { language: "English", aspectRatio: "9:16" }));
    expect(sb.project.title).toBe("Father's Last Letter");
    expect(sb.scenes[0].imagePrompt).toContain("aspect ratio 9:16");
  });

  it("quotes the idea in the fallback preset", async () => {
    const sb = await generateStoryboard(provider, input("Seekor kucing belajar bermain gitar di Bandung."));
    expect(sb.project.logline).toContain("kucing belajar bermain gitar");
  });
});

describe("scene regeneration", () => {
  it("changes only the selected scene and preserves the bibles", async () => {
    const sb = await generateStoryboard(provider, input(EXAMPLE_THEMES[5]));
    const { storyboard, scene } = await regenerateScene(provider, sb, 2, "Make the lighting more dramatic.");

    expect(scene.sceneNumber).toBe(2);
    expect(scene.action).toContain("Make the lighting more dramatic.");
    expect(scene.duration).toBe(sb.scenes[1].duration);
    expect(storyboard.characters).toEqual(sb.characters);
    expect(storyboard.visualBible).toEqual(sb.visualBible);
    expect(storyboard.scenes[0]).toEqual(sb.scenes[0]);
    expect(storyboard.scenes[2]).toEqual(sb.scenes[2]);
    expect(storyboard.scenes[1]).not.toEqual(sb.scenes[1]);
  });

  it("does not stack director's notes when regenerating repeatedly", async () => {
    const sb = await generateStoryboard(provider, input(EXAMPLE_THEMES[5]));
    const first = await regenerateScene(provider, sb, 1, "Slower camera.");
    const second = await regenerateScene(provider, first.storyboard, 1, "Change the location to Jakarta.");
    expect(second.scene.action).toContain("Change the location to Jakarta.");
    expect(second.scene.action).not.toContain("Slower camera.");
  });

  it("rejects an unknown scene number", async () => {
    const sb = await generateStoryboard(provider, input(EXAMPLE_THEMES[0]));
    await expect(regenerateScene(provider, sb, 9, undefined)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
