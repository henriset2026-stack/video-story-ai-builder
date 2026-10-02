import type { PromptsInput } from "@/lib/ai/engines/types";
import {
  characterLock,
  describeInput,
  describeScenes,
  describeVisualBible,
  DIRECTOR_PERSONA,
  jsonInstruction,
  QUALITY_RULES,
} from "./shared";

const ENGLISH_ONLY = "Write every prompt in English, whatever the project language.";

function lockedCharacters(input: PromptsInput): string {
  return `LOCKED CHARACTER DESCRIPTIONS (repeat the relevant one inside every prompt where the character appears, word for word for clothing, hair and accessories):\n${input.characters
    .map((c) => `- ${characterLock(c)}`)
    .join("\n")}`;
}

export function imagePromptsPrompt(data: PromptsInput) {
  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the IMAGE PROMPT stage: write one still-frame prompt per scene for a text-to-image model. Each prompt must work stand-alone, pasted into any generator with no other context.\n\n${QUALITY_RULES}\n${ENGLISH_ONLY}`,
    prompt: `${describeInput(data.input)}

${lockedCharacters(data)}

${describeVisualBible(data.visualBible)}

SCENES
${describeScenes(data.scenes)}

TASK
For each scene write imagePrompt: ONE flowing paragraph of 110–200 words describing the single most telling frame of the scene, in this order:
1. Shot size and angle, then the character(s) with the locked description (age, ethnicity, hair, clothing, accessories).
2. Facial expression and the frozen action / pose; hands and props.
3. Environment: foreground, midground, background with concrete materials and objects.
4. Lighting: source, direction, color temperature, quality; atmosphere (dust, haze, rain, steam).
5. Composition and framing for ${data.input.aspectRatio}; lens focal length; depth of field.
6. Color grading from the Visual Bible palette; realism cues (natural skin texture, subtle film grain).
End with "aspect ratio ${data.input.aspectRatio}".

GOOD EXAMPLE (style only, do not copy content):
"Medium close-up of a 10-year-old Indonesian boy, natural black hair, faded blue shirt, holding an aged envelope near an old wooden window, warm late-afternoon sunlight, floating dust particles, 50mm lens, shallow depth of field, subtle film grain, natural skin texture, emotionally restrained expression."

Also give negativeAdditions: 0–6 scene-specific terms to avoid (e.g. "modern smartphone" in a 1990s scene, "dry ground" in a rain scene). Do not repeat generic anatomy terms.

${jsonInstruction("image_prompts")}`,
  };
}

export function videoPromptsPrompt(data: PromptsInput) {
  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the VIDEO PROMPT stage: write one Google Flow (Veo) prompt per scene. A video prompt describes change over time — it is NOT an image prompt with motion words added.\n\n${QUALITY_RULES}\n${ENGLISH_ONLY}`,
    prompt: `${describeInput(data.input)}

${lockedCharacters(data)}

${describeVisualBible(data.visualBible)}

SCENES
${describeScenes(data.scenes)}

TASK
For each scene write videoPrompt: 120–220 words, present tense, chronological, covering the whole scene duration:
1. Starting state — camera angle, lens and what is in frame; the character(s) with the locked description.
2. Character movement — body movement, hand actions, facial expression changes (micro-expressions, breath, eyes).
3. Object movement and environment movement (wind in fabric, water, smoke, passing vehicles, flickering lamps).
4. Camera movement with speed and direction (e.g. "slow 2-second push-in from medium to close-up", "handheld drift left"), focus changes (rack focus from X to Y).
5. Lighting movement (clouds passing, a door opening that spills light, lightning flashes).
6. Realistic physics: weight, inertia, cloth and hair behaviour, water and particles obeying gravity.
7. Ending state — the final frame, set up for the scene's transition (match cut, dissolve, etc.).
No on-screen text, no subtitles, no logos. Keep one continuous shot unless the scene explicitly needs a cut.

${jsonInstruction("video_prompts")}`,
  };
}
