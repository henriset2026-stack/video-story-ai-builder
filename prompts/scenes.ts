import { TRANSITION_TYPES } from "@/lib/constants";
import type { ScenesInput } from "@/lib/ai/engines/types";
import {
  beatFor,
  describeCharacters,
  describeInput,
  describeVisualBible,
  DIRECTOR_PERSONA,
  jsonInstruction,
  languageRule,
  QUALITY_RULES,
} from "./shared";

export function scenesPrompt({ input, story, characters, visualBible, durations }: ScenesInput) {
  const outline = story.outline
    .map(
      (o, i) =>
        `Scene ${o.sceneNumber} [${beatFor(i, story.outline.length)}] — ${durations[i]}s — ${o.location}, ${o.timeOfDay}. ${o.summary} (Emotion: ${o.emotionalBeat})`,
    )
    .join("\n");

  return {
    system: `${DIRECTOR_PERSONA}\n\nYou are in the SCENE BREAKDOWN stage: turn the outline into shootable scenes with precise camera and motion direction.\n\n${QUALITY_RULES}\n\n${languageRule(input)}`,
    prompt: `${describeInput(input)}

STORY: ${story.title} — ${story.logline}

OUTLINE (fixed — keep scene count, order and durations):
${outline}

${describeCharacters(characters)}

${describeVisualBible(visualBible)}

TASK
For each outline scene write:
- title: 2–5 words in the story language, naming this scene only — no film title, no "Scene N" prefix (e.g. "Daun yang Menguning").
- duration (use the fixed value), location (specific: place + details), timeOfDay, purpose (its narrative job), emotionalBeat.
- characters: exact names from the Character Bible who appear on screen.
- action: what physically happens, beat by beat, filmable in the duration. No internal thoughts.
- camera: shot size, angle, lens (focal length in mm), framing, movement (dolly, push-in, handheld, crane, static…), focus behaviour. Use professional terminology and follow the Visual Bible's lens language.
- motion: subjectMovement (body, hands, face) and environmentMovement (wind, water, smoke, crowds, light).
- transition: type from [${TRANSITION_TYPES.join(", ")}] plus how it connects to the NEXT scene (the last scene ends the film, e.g. "Fade to Black").

CONTINUITY
- Each scene starts where the previous one logically ended (props in hand, time of day, weather, wardrobe).
- If time or location changes, the action or transition must justify it.

${jsonInstruction("scenes")}`,
  };
}
