import type { GenerationInput } from "@/types";
import type { StoryOutput } from "@/lib/ai/engines/types";
import { beatPlan, describeInput, DIRECTOR_PERSONA, jsonInstruction, languageRule, QUALITY_RULES } from "./shared";

export function storyPrompt(input: GenerationInput) {
  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the STORY stage: turn the idea into a tight short-film concept.\n\n${QUALITY_RULES}\n\n${languageRule(input)}`,
    prompt: `${describeInput(input)}

TASK
Develop a short video story from the idea.
- Title: evocative, max 6 words.
- Logline: one sentence — who wants what, what stands in the way, what is at stake.
- Synopsis: 3–5 sentences covering the whole arc.
- Tone and target emotion: precise words (e.g. "tender, restrained, nostalgic" rather than "emotional").
- Character seeds: 1–3 characters that actually appear on screen (a product ad may have 1). Culturally fitting names.
- Outline: EXACTLY ${input.sceneCount} scene(s), numbered from 1, following this structure:
${beatPlan(input.sceneCount)}
  Scene 2 must follow logically from Scene 1; the final scene must pay off the setup.
  Each outline item names a concrete, filmable location and a time of day, and the emotional beat.
- A ${input.duration}-second film has room for very little: favour one clear visual idea per scene.

${jsonInstruction("story")}`,
  };
}

export function charactersPrompt(input: GenerationInput, story: StoryOutput) {
  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the CHARACTER BIBLE stage. Your descriptions are reused word-for-word in every image and video prompt, so they must be visually exact and never ambiguous.\n\n${QUALITY_RULES}\n\n${languageRule(input)}`,
    prompt: `${describeInput(input)}

STORY
Title: ${story.title}
Logline: ${story.logline}
Synopsis: ${story.synopsis}
Character seeds:
${story.characterSeeds.map((c) => `- ${c.name} (${c.role}): ${c.summary}`).join("\n")}

TASK
Write the Character Bible for every seeded character (keep their names).
- id: "char-1", "char-2", … in the seed order.
- age: a specific number or a narrow range.
- appearance: build, height, skin tone, one distinctive feature.
- face: face shape, eyes, brows, any marks — enough for consistent regeneration.
- hair: color, length, texture, style.
- clothing: ONE locked outfit with garment types, colors and materials that stays the same in every scene (unless the story requires a change — then describe both).
- accessories: exact items or "None".
- personality and emotional arc: how they change from first to last scene.

LENGTH: every visual field (appearance, face, hair, clothing, accessories) is ONE compact phrase of at most 25 words — comma-separated details, no full sentences, no backstory. These phrases are pasted into every image and video prompt, so brevity matters.

${jsonInstruction("characters")}`,
  };
}
