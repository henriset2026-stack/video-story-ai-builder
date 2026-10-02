import type { Character, GenerationInput, Scene, VisualBible } from "@/types";

// Shared prompt fragments. Pure functions only — no I/O, no provider-specific wording.

export const DIRECTOR_PERSONA = `You are an award-winning film director, cinematographer, sound designer and AI video prompt engineer.
You turn a single idea into a production-ready blueprint for AI image and video generators (Google Flow / Veo, Midjourney, Runway, Kling).`;

export const QUALITY_RULES = `QUALITY RULES (mandatory):
- Be specific, visual and actionable. Never write generic lines such as "a cinematic scene" or "beautiful lighting".
- Name concrete things: ages, ethnicity, garments and their colors/materials, props, surfaces, weather, light direction and color temperature, lens focal length, camera height and movement.
- Ground everything in the culture and geography implied by the idea (default: Indonesia — real places, architecture, clothing, food, vehicles, weather).
- Keep characters, wardrobe, props, locations, time of day and lighting logically continuous across scenes unless the story explicitly changes them.
- Everything must be physically plausible and filmable.
- Avoid real celebrities, brand logos, trademarks and on-screen text.`;

export function languageRule(input: Pick<GenerationInput, "language">): string {
  return `LANGUAGE RULES:
- Write story text (title, logline, synopsis, tone, emotions, scene titles, purpose, action, personality, emotional arc) and all spoken dialogue / voice-over in ${input.language}.
- Write image prompts, video prompts, negative prompts, camera, motion, music and SFX direction, and all visual descriptions (appearance, face, hair, clothing, accessories, visual bible) in English, because generators follow English prompts best.`;
}

export function describeInput(input: GenerationInput): string {
  return `PROJECT BRIEF
- Idea: "${input.theme}"
- Genre: ${input.genre}
- Total duration: ${input.duration} seconds
- Aspect ratio: ${input.aspectRatio}
- Language: ${input.language}
- Number of scenes: ${input.sceneCount}`;
}

/** Dramatic role of each scene position, following the product spec's story structure. */
export function beatFor(index: number, total: number): string {
  if (total === 1) return "Complete micro-story (setup and payoff in one shot)";
  if (index === 0) return "Setup";
  if (index === total - 1) return "Resolution / Payoff";
  if (total === 3) return "Conflict / Development";
  if (index === total - 2) return "Climax";
  return index === 1 ? "Development" : "Conflict / Escalation";
}

export function beatPlan(total: number): string {
  return Array.from({ length: total }, (_, i) => `Scene ${i + 1}: ${beatFor(i, total)}`).join("\n");
}

/** One-line locked description used verbatim inside every image/video prompt. */
export function characterLock(c: Character): string {
  return `${c.name} — ${c.age}-year-old ${c.nationality} ${c.gender}; ${c.appearance}; face: ${c.face}; hair: ${c.hair}; wearing ${c.clothing}; accessories: ${c.accessories}`;
}

export function describeCharacters(characters: Character[]): string {
  return `CHARACTER BIBLE (locked — do not change any visual detail):\n${characters
    .map((c) => `- ${characterLock(c)}. Role: ${c.role}. Personality: ${c.personality}. Arc: ${c.emotionalArc}`)
    .join("\n")}`;
}

export function describeVisualBible(v: VisualBible): string {
  return `VISUAL BIBLE (locked):
- Style: ${v.visualStyle}
- Cinematography: ${v.cinematography}
- Lighting: ${v.lighting}
- Color palette: ${v.colorPalette.join(", ")}
- Environment: ${v.environment}
- Atmosphere: ${v.atmosphere}
- Realism: ${v.realism}
- Lens language: ${v.lensLanguage}
- Camera language: ${v.cameraLanguage}
- Depth of field: ${v.depthOfField}`;
}

type SceneLike = Pick<
  Scene,
  "sceneNumber" | "title" | "duration" | "location" | "timeOfDay" | "purpose" | "emotionalBeat" | "characters" | "action" | "camera" | "motion" | "transition"
>;

export function describeScene(s: SceneLike): string {
  return `SCENE ${s.sceneNumber} — "${s.title}" (${s.duration}s)
  Location: ${s.location} | Time: ${s.timeOfDay}
  Purpose: ${s.purpose} | Emotional beat: ${s.emotionalBeat}
  Characters: ${s.characters.join(", ") || "none"}
  Action: ${s.action}
  Camera: ${s.camera.shot}, ${s.camera.angle}, ${s.camera.lens}, ${s.camera.framing}; movement: ${s.camera.movement}; focus: ${s.camera.focus}
  Motion: subject — ${s.motion.subjectMovement}; environment — ${s.motion.environmentMovement}
  Transition out: ${s.transition.type} — ${s.transition.description}`;
}

export function describeScenes(scenes: SceneLike[]): string {
  return scenes.map(describeScene).join("\n\n");
}

export function jsonInstruction(schemaName: string): string {
  return `Return ONLY the structured result for "${schemaName}". Every field is required unless marked nullable. Do not add commentary.`;
}
