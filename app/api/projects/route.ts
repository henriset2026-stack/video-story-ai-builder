import { getRepository } from "@/lib/db/repository";
import { errorResponse, parseBody } from "@/lib/http";
import { SaveProjectInputSchema } from "@/lib/schemas/input";

// GET /api/projects — project history (newest first).
export async function GET() {
  try {
    const projects = await getRepository().listProjects();
    return Response.json({ projects });
  } catch (error) {
    return errorResponse(error, "projects/list");
  }
}

// POST /api/projects — save a generated storyboard (used when auto-save failed).
export async function POST(request: Request) {
  try {
    const { storyboard } = await parseBody(request, SaveProjectInputSchema);
    const project = await getRepository().createProject(storyboard);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "projects/create");
  }
}
