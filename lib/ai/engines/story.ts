import "server-only";
import { CharacterEngineOutputSchema, StoryEngineOutputSchema } from "@/lib/schemas/engines";
import { charactersPrompt, storyPrompt } from "@/prompts/story";
import type { GenerationInput } from "@/types";
import type { AIProvider } from "../provider";
import type { CharactersInput, CharactersOutput, StoryOutput } from "./types";
import { exactSceneNumbers } from "./validation";

/** STORY ENGINE — concept, logline, synopsis, character seeds and a scene outline. */
export async function runStoryEngine(
  provider: AIProvider,
  input: GenerationInput,
  signal?: AbortSignal,
): Promise<StoryOutput> {
  const schema = StoryEngineOutputSchema.superRefine((out, ctx) =>
    exactSceneNumbers(out.outline, input.sceneCount, ctx, "outline"),
  );
  return provider.generateStructured({
    task: "story",
    schemaName: "story",
    schema,
    input,
    signal,
    ...storyPrompt(input),
  });
}

/** CHARACTER ENGINE — the locked Character Bible. */
export async function runCharacterEngine(
  provider: AIProvider,
  data: CharactersInput,
  signal?: AbortSignal,
): Promise<CharactersOutput> {
  const schema = CharacterEngineOutputSchema.superRefine((out, ctx) => {
    const names = new Set(out.characters.map((c) => c.name.toLowerCase()));
    if (names.size !== out.characters.length) {
      ctx.addIssue({ code: "custom", path: ["characters"], message: "Character names must be unique" });
    }
  });
  return provider.generateStructured({
    task: "characters",
    schemaName: "characters",
    schema,
    input: data,
    signal,
    ...charactersPrompt(data.input, data.story),
  });
}
