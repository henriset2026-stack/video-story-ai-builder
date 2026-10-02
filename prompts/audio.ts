import type { AudioInput } from "@/lib/ai/engines/types";
import { describeCharacters, describeInput, describeScenes, DIRECTOR_PERSONA, jsonInstruction, QUALITY_RULES } from "./shared";

/** Comfortable speaking rate used to keep lines short enough for the scene duration. */
const WORDS_PER_SECOND = 2.3;

export function audioPrompt({ input, story, characters, scenes }: AudioInput) {
  const budgets = scenes
    .map((s) => `Scene ${s.sceneNumber}: max ~${Math.max(3, Math.floor(s.duration * WORDS_PER_SECOND))} spoken words`)
    .join("; ");

  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the AUDIO stage: dialogue, voice-over, music and sound design.\n\n${QUALITY_RULES}\n\nWrite spoken lines (dialogue and voice-over text) in ${input.language}. Write all other audio direction in English.`,
    prompt: `${describeInput(input)}

STORY: ${story.title} — ${story.logline}
Tone: ${story.tone} | Target emotion: ${story.targetEmotion}

${describeCharacters(characters)}

SCENES
${describeScenes(scenes)}

TASK
For each scene decide audioMode:
- "dialogue" (characters speak on screen), "voice_over" (narration / inner voice off screen), "mixed" (both) or "silence" (no spoken words — often the strongest choice for emotional peaks).
- dialogue / voiceOver: arrays of lines with speaker (character name or "Narrator"), voiceType, age, emotion, pacing and the exact text. Empty arrays when not used; both empty when audioMode is "silence".
- Word budget per scene so lines fit: ${budgets}.
- music: genre, mood, bpm (integer), instrumentation (culturally fitting instruments are welcome, e.g. gamelan, kecapi, suling), intensity (low | medium | high | peak) and direction (how it evolves within the scene). Music must follow the emotional arc across scenes — build toward the climax and resolve at the end.
- sfx: only sounds that physically exist in the scene (footsteps on the actual floor material, specific weather, specific machines, room tone). Give each a timing. No irrelevant or decorative effects.

${jsonInstruction("audio")}`,
  };
}
