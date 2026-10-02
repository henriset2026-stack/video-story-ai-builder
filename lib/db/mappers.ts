import { StoredProjectSchema } from "@/lib/schemas/storyboard";
import type { ProjectSummary, Scene, StoredProject, Storyboard } from "@/types";

// Row <-> domain mapping for the Supabase schema. Rows read back from the database are validated
// again with Zod, so a manual DB edit can never feed malformed data into the UI.

export interface SceneRow {
  id?: string;
  scene_number: number;
  title: string;
  duration: number;
  location: string;
  time_of_day: string;
  purpose: string;
  emotional_beat: string;
  characters: string[];
  action: string;
  image_prompt: string;
  video_prompt: string;
  dialogue: { mode: Scene["audioMode"]; lines: Scene["dialogue"] };
  voice_over: Scene["voiceOver"];
  music: Scene["music"];
  sfx: Scene["sfx"];
  camera: Scene["camera"];
  motion: Scene["motion"];
  transition: Scene["transition"];
  negative_prompt: string;
}

export interface StoryboardRow {
  id: string;
  project_id: string;
  logline: string;
  synopsis: string;
  tone: string;
  target_emotion: string;
  character_bible: Storyboard["characters"];
  visual_bible: Storyboard["visualBible"];
  global_negative_prompt: string;
  continuity_check: Storyboard["continuityCheck"];
  scenes: SceneRow[];
}

export interface ProjectRow {
  id: string;
  title: string;
  theme: string;
  genre: string;
  duration: number;
  aspect_ratio: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export function sceneToRow(s: Scene): SceneRow {
  return {
    scene_number: s.sceneNumber,
    title: s.title,
    duration: s.duration,
    location: s.location,
    time_of_day: s.timeOfDay,
    purpose: s.purpose,
    emotional_beat: s.emotionalBeat,
    characters: s.characters,
    action: s.action,
    image_prompt: s.imagePrompt,
    video_prompt: s.videoPrompt,
    dialogue: { mode: s.audioMode, lines: s.dialogue },
    voice_over: s.voiceOver,
    music: s.music,
    sfx: s.sfx,
    camera: s.camera,
    motion: s.motion,
    transition: s.transition,
    negative_prompt: s.negativePrompt,
  };
}

export function rowToScene(r: SceneRow): Scene {
  return {
    id: r.id,
    sceneNumber: r.scene_number,
    title: r.title,
    duration: r.duration,
    location: r.location,
    timeOfDay: r.time_of_day,
    purpose: r.purpose,
    emotionalBeat: r.emotional_beat,
    characters: r.characters,
    action: r.action,
    imagePrompt: r.image_prompt,
    videoPrompt: r.video_prompt,
    audioMode: r.dialogue.mode,
    dialogue: r.dialogue.lines,
    voiceOver: r.voice_over,
    music: r.music,
    sfx: r.sfx,
    camera: r.camera,
    motion: r.motion,
    transition: r.transition,
    negativePrompt: r.negative_prompt,
  };
}

/** Payload for the create_project_with_storyboard RPC. */
export function toCreatePayload(sb: Storyboard) {
  const p = sb.project;
  return {
    project: {
      title: p.title,
      theme: p.theme,
      genre: p.genre,
      duration: p.duration,
      aspect_ratio: p.aspectRatio,
      language: p.language,
    },
    storyboard: {
      logline: p.logline,
      synopsis: p.synopsis,
      tone: p.tone,
      target_emotion: p.targetEmotion,
      character_bible: sb.characters,
      visual_bible: sb.visualBible,
      global_negative_prompt: sb.globalNegativePrompt,
      continuity_check: sb.continuityCheck,
    },
    scenes: sb.scenes.map(sceneToRow),
  };
}

/** Returns null when the stored data no longer matches the schema. */
export function rowsToStoredProject(project: ProjectRow, storyboard: StoryboardRow): StoredProject | null {
  const candidate = {
    id: project.id,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    storyboard: {
      project: {
        title: project.title,
        logline: storyboard.logline,
        synopsis: storyboard.synopsis,
        theme: project.theme,
        genre: project.genre,
        tone: storyboard.tone,
        targetEmotion: storyboard.target_emotion,
        duration: project.duration,
        aspectRatio: project.aspect_ratio,
        language: project.language,
      },
      characters: storyboard.character_bible,
      visualBible: storyboard.visual_bible,
      scenes: [...storyboard.scenes].sort((a, b) => a.scene_number - b.scene_number).map(rowToScene),
      globalNegativePrompt: storyboard.global_negative_prompt,
      continuityCheck: storyboard.continuity_check,
    },
  };
  const parsed = StoredProjectSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function toSummary(p: StoredProject): ProjectSummary {
  const m = p.storyboard.project;
  return {
    id: p.id,
    title: m.title,
    theme: m.theme,
    genre: m.genre,
    duration: m.duration,
    aspectRatio: m.aspectRatio,
    language: m.language,
    sceneCount: p.storyboard.scenes.length,
    createdAt: p.createdAt,
  };
}
