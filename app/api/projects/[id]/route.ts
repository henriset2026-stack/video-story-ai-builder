import { getRepository } from "@/lib/db/repository";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { UuidParamSchema } from "@/lib/schemas/input";

async function projectId(ctx: RouteContext<"/api/projects/[id]">): Promise<string> {
  const { id } = await ctx.params;
  const parsed = UuidParamSchema.safeParse(id);
  if (!parsed.success) throw new AppError("NOT_FOUND");
  return parsed.data;
}

// GET /api/projects/[id] — full project with storyboard and scenes.
export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const project = await getRepository().getProject(await projectId(ctx));
    if (!project) throw new AppError("NOT_FOUND");
    return Response.json({ project });
  } catch (error) {
    return errorResponse(error, "projects/get");
  }
}

// DELETE /api/projects/[id] — deletes the project; storyboard and scenes cascade.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const deleted = await getRepository().deleteProject(await projectId(ctx));
    if (!deleted) throw new AppError("NOT_FOUND");
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error, "projects/delete");
  }
}
