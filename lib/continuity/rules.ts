import { CONTINUITY_GROUPS, type ContinuityCategory, type ContinuityGroup } from "@/lib/constants";
import type { Character, ContinuityCheck, ContinuityIssue, Scene, Storyboard } from "@/types";

// Deterministic continuity rules. Pure functions: they never call AI or I/O, so they are fast,
// testable and run twice per generation (before and after the AI review applies its fixes).

export type DraftStoryboard = Omit<Storyboard, "continuityCheck">;

/** Words that fit comfortably in a scene (≈2.8 words/second, a brisk but natural pace). */
export const MAX_WORDS_PER_SECOND = 2.8;

export function characterLockPhrase(c: Character): string {
  return `${c.name}, ${c.age}-year-old ${c.nationality} ${c.gender}, ${c.hair}, wearing ${c.clothing}${
    c.accessories && c.accessories.toLowerCase() !== "none" ? `, ${c.accessories}` : ""
  }`;
}

function mentionsCharacter(prompt: string, c: Character): boolean {
  const p = prompt.toLowerCase();
  return p.includes(c.name.toLowerCase()) || p.includes(`${c.age}-year-old`.toLowerCase());
}

function countWords(lines: { text: string }[]): number {
  return lines.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0);
}

function derivedAudioMode(scene: Scene): Scene["audioMode"] {
  const d = scene.dialogue.length > 0;
  const v = scene.voiceOver.length > 0;
  return d && v ? "mixed" : d ? "dialogue" : v ? "voice_over" : "silence";
}

/** Splits a total duration over N scenes; remainder goes to the middle scenes (where the story develops). */
export function allocateDurations(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const durations = Array.from({ length: count }, () => base);
  let remainder = total - base * count;
  const order = Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2),
  );
  for (const i of order) {
    if (remainder === 0) break;
    durations[i] += 1;
    remainder -= 1;
  }
  return durations;
}

export interface RuleResult {
  storyboard: DraftStoryboard;
  issues: ContinuityIssue[];
}

export function applyContinuityRules(input: DraftStoryboard): RuleResult {
  const issues: ContinuityIssue[] = [];
  const issue = (
    category: ContinuityCategory,
    sceneNumber: number | null,
    severity: ContinuityIssue["severity"],
    description: string,
    resolution: string | null,
  ) => issues.push({ category, sceneNumber, severity, description, resolution, fixed: resolution !== null });

  const { project, characters } = input;
  let scenes = input.scenes.map((s) => ({ ...s }));

  // Narrative: scenes numbered 1..N in order.
  if (scenes.some((s, i) => s.sceneNumber !== i + 1)) {
    scenes = scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    issue("Narrative", null, "medium", "Scene numbers were out of sequence.", "Renumbered scenes 1..N in story order.");
  }

  // Narrative: durations must add up to the requested total.
  const sum = scenes.reduce((n, s) => n + s.duration, 0);
  if (sum !== project.duration) {
    const fixed = allocateDurations(project.duration, scenes.length);
    scenes = scenes.map((s, i) => ({ ...s, duration: fixed[i] }));
    issue(
      "Narrative",
      null,
      "medium",
      `Scene durations added up to ${sum}s instead of ${project.duration}s.`,
      `Rebalanced durations to ${fixed.join(" + ")} = ${project.duration}s.`,
    );
  }

  const byName = new Map(characters.map((c) => [c.name, c]));

  scenes = scenes.map((scene) => {
    let s = scene;

    // Character: only characters from the Character Bible may appear.
    const unknown = s.characters.filter((n) => !byName.has(n));
    if (unknown.length) {
      s = { ...s, characters: s.characters.filter((n) => byName.has(n)) };
      issue(
        "Character",
        s.sceneNumber,
        "medium",
        `Scene referenced characters not in the Character Bible: ${unknown.join(", ")}.`,
        "Removed unknown characters from the scene cast list.",
      );
    }

    // Character / Clothing: every prompt must carry the locked description of each character on screen.
    for (const field of ["imagePrompt", "videoPrompt"] as const) {
      const missing = s.characters.map((n) => byName.get(n)!).filter((c) => !mentionsCharacter(s[field], c));
      if (missing.length) {
        const clause = missing.map(characterLockPhrase).join("; ");
        s = { ...s, [field]: `${s[field].trim().replace(/\.?$/, ".")} Consistent character reference: ${clause}.` };
        issue(
          "Clothing",
          s.sceneNumber,
          "medium",
          `${field === "imagePrompt" ? "Image" : "Video"} prompt did not restate the locked look of ${missing
            .map((c) => c.name)
            .join(", ")}.`,
          "Appended the locked character description from the Character Bible.",
        );
      }
    }

    // Camera: the image prompt must state the project aspect ratio.
    if (!s.imagePrompt.includes(project.aspectRatio)) {
      s = { ...s, imagePrompt: `${s.imagePrompt.trim().replace(/\.?$/, ",")} aspect ratio ${project.aspectRatio}.` };
      issue("Camera", s.sceneNumber, "low", "Image prompt did not state the aspect ratio.", `Added "aspect ratio ${project.aspectRatio}".`);
    }

    // Audio: mode must match the spoken lines.
    const mode = derivedAudioMode(s);
    if (mode !== s.audioMode) {
      issue("Audio", s.sceneNumber, "low", `Audio mode "${s.audioMode}" did not match the spoken lines.`, `Set audio mode to "${mode}".`);
      s = { ...s, audioMode: mode };
    }

    // Audio: spoken lines must fit in the scene.
    const words = countWords([...s.dialogue, ...s.voiceOver]);
    const budget = Math.floor(s.duration * MAX_WORDS_PER_SECOND);
    if (words > budget) {
      issue(
        "Audio",
        s.sceneNumber,
        "medium",
        `Spoken lines (${words} words) are too long for a ${s.duration}s scene (≈${budget} words max). Regenerate this scene with shorter dialogue.`,
        null,
      );
    }
    return s;
  });

  // Time: flag unmotivated time-of-day jumps on hard cuts (a warning, not auto-fixed).
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const cur = scenes[i];
    const hardCut = ["Cut", "Smash Cut", "Match Cut", "Whip Transition"].includes(prev.transition.type);
    if (hardCut && prev.timeOfDay.trim().toLowerCase() !== cur.timeOfDay.trim().toLowerCase()) {
      issue(
        "Time",
        cur.sceneNumber,
        "low",
        `Time of day changes from "${prev.timeOfDay}" to "${cur.timeOfDay}" across a ${prev.transition.type}. Make sure the edit motivates the jump.`,
        null,
      );
    }
  }

  return { storyboard: { ...input, scenes }, issues };
}

/** Low-severity unfixed issues are advisory; unfixed medium/high issues mean NEEDS_REVISION. */
export function summarizeContinuity(issues: ContinuityIssue[], now = new Date()): ContinuityCheck {
  const blocking = (i: ContinuityIssue) => !i.fixed && i.severity !== "low";
  const group = (key: ContinuityGroup) => {
    const categories = CONTINUITY_GROUPS[key] as readonly ContinuityCategory[];
    const mine = issues.filter((i) => categories.includes(i.category));
    return {
      status: mine.some(blocking) ? ("fail" as const) : mine.some((i) => i.fixed) ? ("fixed" as const) : ("pass" as const),
      checked: [...categories],
    };
  };
  const groups = { character: group("character"), visual: group("visual"), narrative: group("narrative"), audio: group("audio") };
  const failed = Object.values(groups).some((g) => g.status === "fail");
  return {
    status: failed ? "NEEDS_REVISION" : "PASS",
    checkedAt: now.toISOString(),
    groups,
    issues: issues.slice(0, 60),
  };
}
