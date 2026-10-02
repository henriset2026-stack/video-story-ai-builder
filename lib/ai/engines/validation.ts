import type { z } from "zod";

// Request-dependent validation that a static schema cannot express (e.g. "exactly N scenes").
// Implemented as superRefine checks so the provider's repair retry can feed the message back to the model.

export function exactSceneNumbers(
  items: { sceneNumber: number }[],
  expected: number,
  ctx: z.RefinementCtx,
  path: string,
): void {
  if (items.length !== expected) {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: `Must contain exactly ${expected} item(s), one per scene; got ${items.length}`,
    });
    return;
  }
  items.forEach((item, i) => {
    if (item.sceneNumber !== i + 1) {
      ctx.addIssue({
        code: "custom",
        path: [path, i, "sceneNumber"],
        message: `Scenes must be numbered 1..${expected} in order; expected ${i + 1}`,
      });
    }
  });
}
