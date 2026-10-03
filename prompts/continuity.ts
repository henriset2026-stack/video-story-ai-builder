import { CONTINUITY_CATEGORIES } from "@/lib/constants";
import { FIXABLE_SCENE_FIELDS } from "@/lib/schemas/engines";
import type { Scene, Storyboard } from "@/types";
import { describeCharacters, describeVisualBible, DIRECTOR_PERSONA, jsonInstruction } from "./shared";

export function describeFullScene(s: Scene): string {
  const spoken = [...s.dialogue.map((l) => `${l.speaker}: "${l.text}"`), ...s.voiceOver.map((l) => `VO ${l.speaker}: "${l.text}"`)];
  return `SCENE ${s.sceneNumber} — "${s.title}" (${s.duration}s) — ${s.location}, ${s.timeOfDay}
  Characters: ${s.characters.join(", ") || "none"} | Beat: ${s.emotionalBeat}
  Action: ${s.action}
  Camera: ${s.camera.shot}, ${s.camera.angle}, ${s.camera.lens}; ${s.camera.movement}
  Transition: ${s.transition.type} — ${s.transition.description}
  imagePrompt: ${s.imagePrompt}
  videoPrompt: ${s.videoPrompt}
  Audio (${s.audioMode}): ${spoken.join(" | ") || "no spoken lines"}; music ${s.music.genre}, ${s.music.bpm} BPM, ${s.music.intensity}; sfx: ${s.sfx.map((x) => x.sound).join(", ") || "none"}`;
}

export function continuityPrompt(storyboard: Storyboard) {
  const p = storyboard.project;
  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are the SCRIPT SUPERVISOR. You check continuity across a finished storyboard and write precise fixes. You never invent problems: if something is consistent, do not report it.`,
    prompt: `PROJECT: ${p.title} — ${p.genre}, ${p.duration}s, ${p.aspectRatio}, language ${p.language}
Logline: ${p.logline}

${describeCharacters(storyboard.characters)}

${describeVisualBible(storyboard.visualBible)}

STORYBOARD
${storyboard.scenes.map(describeFullScene).join("\n\n")}

TASK
Check these categories across all scenes: ${CONTINUITY_CATEGORIES.join(", ")}.
Typical real problems: a prompt that changes a character's hair, clothing or accessories vs. the Character Bible; a prop that appears/disappears without cause; time of day or weather jumping without a transition; lighting contradicting the Visual Bible; a character in a prompt who is not in the scene; narrative steps that do not follow; music intensity that breaks the emotional arc; dialogue that contradicts the action.

EVIDENCE RULE: every issue's description must quote the exact conflicting words from the storyboard (e.g. prompt says "mud-caked boots" but the Character Bible says "always barefoot"). If you cannot quote a real contradiction, do not report it.
Do NOT report: scene durations or scene count (fixed by the system), the layout of this summary, missing fields in this summary, or style preferences.

For each REAL issue give category, sceneNumber (null if global), severity, description and a fix when one of these scene fields can resolve it: ${FIXABLE_SCENE_FIELDS.join(", ")}. The fix value is the COMPLETE corrected field text (English for prompts; project language for action). Set fix to null when it cannot be fixed by rewriting one of those fields.
Return an empty issues array if the storyboard is consistent.

${jsonInstruction("continuity_review")}`,
  };
}
