import "server-only";
import { applyContinuityRules, summarizeContinuity, type DraftStoryboard } from "@/lib/continuity/rules";
import { logError } from "@/lib/errors";
import { ContinuityReviewOutputSchema } from "@/lib/schemas/engines";
import { PROMPT_MIN_LENGTH } from "@/lib/schemas/storyboard";
import { continuityPrompt } from "@/prompts/continuity";
import type { ContinuityIssue, Scene, Storyboard } from "@/types";
import type { AIProvider } from "../provider";
import type { ContinuityReviewOutput } from "./types";

// CONTINUITY ENGINE
// 1. Deterministic rules fix mechanical problems (durations, cast list, character locks, aspect ratio, audio mode).
// 2. An AI script-supervisor reviews the result and proposes rewrites for specific scene fields.
// 3. Valid rewrites are applied, then the rules run again so an AI rewrite can never break a lock.
// The user only sees the corrected storyboard plus the issue log.

const MIN_FIELD_LENGTH: Record<string, number> = {
  imagePrompt: PROMPT_MIN_LENGTH,
  videoPrompt: PROMPT_MIN_LENGTH,
  action: 10,
  location: 3,
  timeOfDay: 2,
};

export interface ContinuityOptions {
  /** Restrict AI rewrites to these scene numbers (used by scene regeneration). Default: all scenes. */
  editableScenes?: number[];
  signal?: AbortSignal;
}

function issueKey(i: ContinuityIssue) {
  return `${i.category}|${i.sceneNumber}|${i.description}`;
}

export function applyReviewFixes(
  draft: DraftStoryboard,
  review: ContinuityReviewOutput,
  editableScenes?: number[],
): { storyboard: DraftStoryboard; issues: ContinuityIssue[] } {
  let scenes: Scene[] = draft.scenes;
  const issues: ContinuityIssue[] = review.issues.map((r) => {
    const base = { category: r.category, sceneNumber: r.sceneNumber, severity: r.severity, description: r.description };
    const fix = r.fix;
    const target = r.sceneNumber !== null ? scenes.find((s) => s.sceneNumber === r.sceneNumber) : undefined;
    const allowed = target && (!editableScenes || editableScenes.includes(target.sceneNumber));
    if (!fix || !target || !allowed || fix.value.trim().length < MIN_FIELD_LENGTH[fix.field]) {
      return { ...base, resolution: null, fixed: false };
    }
    scenes = scenes.map((s) => (s.sceneNumber === target.sceneNumber ? { ...s, [fix.field]: fix.value.trim() } : s));
    return { ...base, resolution: `Rewrote ${fix.field} to resolve the inconsistency.`, fixed: true };
  });
  return { storyboard: { ...draft, scenes }, issues };
}

export async function runContinuityEngine(
  provider: AIProvider,
  draft: DraftStoryboard,
  options: ContinuityOptions = {},
): Promise<Storyboard> {
  const first = applyContinuityRules(draft);
  const withInterimCheck = { ...first.storyboard, continuityCheck: summarizeContinuity(first.issues) };

  let reviewed: { storyboard: DraftStoryboard; issues: ContinuityIssue[] };
  try {
    const review = await provider.generateStructured({
      task: "continuity",
      schemaName: "continuity_review",
      schema: ContinuityReviewOutputSchema,
      input: { storyboard: withInterimCheck },
      signal: options.signal,
      ...continuityPrompt(withInterimCheck),
    });
    reviewed = applyReviewFixes(first.storyboard, review, options.editableScenes);
  } catch (error) {
    // The storyboard is still valid without the AI review — degrade visibly instead of failing the whole run.
    logError("continuity-review", error);
    reviewed = {
      storyboard: first.storyboard,
      issues: [
        {
          category: "Narrative",
          sceneNumber: null,
          severity: "low",
          description: "The AI continuity review was unavailable; automated rule checks were applied.",
          resolution: null,
          fixed: false,
        },
      ],
    };
  }

  const second = applyContinuityRules(reviewed.storyboard);
  const seen = new Set<string>();
  const issues = [...first.issues, ...reviewed.issues, ...second.issues].filter((i) => {
    const key = issueKey(i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ...second.storyboard, continuityCheck: summarizeContinuity(issues) };
}
