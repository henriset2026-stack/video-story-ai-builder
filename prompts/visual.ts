import type { VisualInput } from "@/lib/ai/engines/types";
import { describeCharacters, describeInput, DIRECTOR_PERSONA, jsonInstruction, languageRule, QUALITY_RULES } from "./shared";

export function visualPrompt({ input, story, characters }: VisualInput) {
  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the VISUAL BIBLE stage: define one coherent look that every shot will share.\n\n${QUALITY_RULES}\n\n${languageRule(input)}`,
    prompt: `${describeInput(input)}

STORY
Title: ${story.title}
Tone: ${story.tone} | Target emotion: ${story.targetEmotion}
Synopsis: ${story.synopsis}
Scene locations: ${story.outline.map((o) => `${o.sceneNumber}. ${o.location} (${o.timeOfDay})`).join("; ")}

${describeCharacters(characters)}

TASK
Write the Visual Bible for a ${input.genre} film in ${input.aspectRatio}.
- visualStyle: a concrete reference style (e.g. "photorealistic cinematic drama, naturalistic Southeast Asian realism"), not an adjective list.
- cinematography: shot philosophy, how coverage is used for this story.
- lighting: key/fill logic, source motivation, color temperature in Kelvin, how it shifts across the arc.
- colorPalette: 4–6 named colors, each with a hex code, e.g. "Faded teak brown #6B4A2F".
- environment: the recurring world — architecture, materials, vegetation, weather.
- atmosphere: air, particles, texture (dust, humidity haze, rain mist…).
- realism: skin texture, film grain, level of stylization.
- lensLanguage: focal lengths and why (e.g. "35mm for context, 85mm for emotion").
- cameraLanguage: how the camera moves and when it stays still.
- depthOfField: aperture feel and focus behaviour.
- Compose for ${input.aspectRatio}${input.aspectRatio === "9:16" ? " (vertical — stack subject and context vertically, keep faces in the upper third)" : ""}.

${jsonInstruction("visual_bible")}`,
  };
}
