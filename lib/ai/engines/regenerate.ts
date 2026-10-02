import "server-only";
import { RegenerateSceneEngineOutputSchema } from "@/lib/schemas/engines";
import { regenerateScenePrompt } from "@/prompts/regenerate";
import type { AIProvider } from "../provider";
import { audioModeProblem } from "./audio";
import type { RegeneratedScene, RegenerateSceneInput } from "./types";

/** SCENE REGENERATION ENGINE — rewrites one scene with everything else locked. */
export async function runRegenerateSceneEngine(
  provider: AIProvider,
  data: RegenerateSceneInput,
  signal?: AbortSignal,
): Promise<RegeneratedScene> {
  const known = new Set(data.storyboard.characters.map((c) => c.name));
  const schema = RegenerateSceneEngineOutputSchema.superRefine(({ scene }, ctx) => {
    if (scene.sceneNumber !== data.sceneNumber) {
      ctx.addIssue({ code: "custom", path: ["scene", "sceneNumber"], message: `Must be ${data.sceneNumber}` });
    }
    scene.characters.forEach((name, j) => {
      if (!known.has(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["scene", "characters", j],
          message: `Unknown character "${name}". Use exact names: ${[...known].join(", ")}`,
        });
      }
    });
    const problem = audioModeProblem(scene);
    if (problem) ctx.addIssue({ code: "custom", path: ["scene", "audioMode"], message: problem });
  });

  const { scene } = await provider.generateStructured({
    task: "regenerateScene",
    schemaName: "regenerated_scene",
    schema,
    input: data,
    signal,
    ...regenerateScenePrompt(data),
  });
  return scene;
}
