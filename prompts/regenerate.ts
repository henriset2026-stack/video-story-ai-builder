import { TRANSITION_TYPES } from "@/lib/constants";
import type { RegenerateSceneInput } from "@/lib/ai/engines/types";
import { describeFullScene } from "./continuity";
import {
  characterLock,
  describeCharacters,
  describeVisualBible,
  DIRECTOR_PERSONA,
  jsonInstruction,
  languageRule,
  QUALITY_RULES,
} from "./shared";

export function regenerateScenePrompt({ storyboard, sceneNumber, instruction }: RegenerateSceneInput) {
  const p = storyboard.project;
  const scenes = storyboard.scenes;
  const index = scenes.findIndex((s) => s.sceneNumber === sceneNumber);
  const current = scenes[index];
  const prev = scenes[index - 1];
  const next = scenes[index + 1];

  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are REWRITING ONE SCENE of an existing storyboard. Everything outside this scene is locked.\n\n${QUALITY_RULES}\n\n${languageRule(p)}`,
    prompt: `PROJECT: ${p.title} — ${p.genre}, ${p.duration}s, ${p.aspectRatio}
Logline: ${p.logline}
Synopsis: ${p.synopsis}
Tone: ${p.tone} | Target emotion: ${p.targetEmotion}

${describeCharacters(storyboard.characters)}

${describeVisualBible(storyboard.visualBible)}

PREVIOUS SCENE (locked):
${prev ? describeFullScene(prev) : "None — this is the opening scene."}

CURRENT SCENE (to rewrite):
${describeFullScene(current)}

NEXT SCENE (locked):
${next ? describeFullScene(next) : "None — this is the final scene."}

USER INSTRUCTION: ${instruction ? `"${instruction}"` : "No specific instruction — produce a stronger, more specific version of the same scene."}

RULES
- Keep sceneNumber ${sceneNumber} and duration ${current.duration}.
- Apply the instruction only to this scene. Do NOT change the Character Bible or Visual Bible; characters keep their locked look:
${storyboard.characters.map((c) => `  • ${characterLock(c)}`).join("\n")}
- The scene must still start where the previous scene ends and hand off cleanly to the next scene.
- It must keep its narrative role in the overall story.
- Write every field: title, location, timeOfDay, purpose, emotionalBeat, characters, action, imagePrompt (110–200 words, stand-alone, ends with "aspect ratio ${p.aspectRatio}"), videoPrompt (120–220 words, start state → movement → end state), audioMode, dialogue, voiceOver, music, sfx, camera, motion, transition (type from [${TRANSITION_TYPES.join(", ")}]), negativeAdditions.

${jsonInstruction("regenerated_scene")}`,
  };
}
