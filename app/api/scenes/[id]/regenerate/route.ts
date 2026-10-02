import { getAIProvider } from "@/lib/ai";
import { regenerateScene } from "@/lib/ai/orchestrator";
import { getRepository } from "@/lib/db/repository";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, errorResponse, parseBody, regenerationLimiter } from "@/lib/http";
import { RegenerateSceneInputSchema, UuidParamSchema } from "@/lib/schemas/input";

// POST /api/scenes/[id]/regenerate — rewrites one scene (optionally following an instruction),
// re-checks continuity, persists the scene and returns it. Other scenes and both bibles are untouched.

export const maxDuration = 120;

export async function POST(request: Request, ctx: RouteContext<"/api/scenes/[id]/regenerate">) {
  try {
    const { id } = await ctx.params;
    const sceneId = UuidParamSchema.safeParse(id);
    if (!sceneId.success) throw new AppError("NOT_FOUND", { userMessage: "This scene doesn't exist." });

    await enforceRateLimit(regenerationLimiter, request);
    const { instruction } = await parseBody(request, RegenerateSceneInputSchema);

    const repo = getRepository();
    const location = await repo.findScene(sceneId.data);
    if (!location) throw new AppError("NOT_FOUND", { userMessage: "This scene doesn't exist." });

    const { storyboard, scene } = await regenerateScene(
      getAIProvider(),
      location.project.storyboard,
      location.sceneNumber,
      instruction,
      request.signal,
    );
    await repo.updateScene(sceneId.data, scene, storyboard.continuityCheck);

    return Response.json({ scene: { ...scene, id: sceneId.data }, continuityCheck: storyboard.continuityCheck });
  } catch (error) {
    return errorResponse(error, "scenes/regenerate");
  }
}
