-- Video Story AI Builder — initial schema.
-- Access model (MVP, no end-user auth): only the server talks to the database, using the
-- service_role key. RLS is enabled on every table with NO policies for anon/authenticated,
-- so the public anon key can neither read nor write. When accounts arrive (roadmap V10),
-- add policies on owner_id = auth.uid().

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,                                   -- reserved for accounts (V10)
  title        text not null check (char_length(title) between 1 and 200),
  theme        text not null check (char_length(theme) between 1 and 1000),
  genre        text not null,
  duration     integer not null check (duration between 5 and 600),
  aspect_ratio text not null,
  language     text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.storyboards (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null unique references public.projects (id) on delete cascade,
  logline                text not null,
  synopsis               text not null,
  tone                   text not null,
  target_emotion         text not null,
  character_bible        jsonb not null check (jsonb_typeof(character_bible) = 'array'),
  visual_bible           jsonb not null check (jsonb_typeof(visual_bible) = 'object'),
  global_negative_prompt text not null,
  continuity_check       jsonb not null check (jsonb_typeof(continuity_check) = 'object'),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.scenes (
  id              uuid primary key default gen_random_uuid(),
  storyboard_id   uuid not null references public.storyboards (id) on delete cascade,
  scene_number    integer not null check (scene_number between 1 and 20),
  title           text not null,
  duration        integer not null check (duration between 1 and 90),
  location        text not null,
  time_of_day     text not null,
  purpose         text not null,
  emotional_beat  text not null,
  characters      jsonb not null default '[]'::jsonb check (jsonb_typeof(characters) = 'array'),
  action          text not null,
  image_prompt    text not null,
  video_prompt    text not null,
  dialogue        jsonb not null,  -- { "mode": audioMode, "lines": SpokenLine[] }
  voice_over      jsonb not null default '[]'::jsonb check (jsonb_typeof(voice_over) = 'array'),
  music           jsonb not null,
  sfx             jsonb not null default '[]'::jsonb check (jsonb_typeof(sfx) = 'array'),
  camera          jsonb not null,
  motion          jsonb not null,
  transition      jsonb not null,
  negative_prompt text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint scenes_storyboard_scene_number_key unique (storyboard_id, scene_number)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- storyboards.project_id and scenes(storyboard_id, scene_number) are covered by their unique
-- constraints (the latter's leading column serves FK lookups and cascades).
-- ---------------------------------------------------------------------------

create index projects_created_at_idx on public.projects (created_at desc);
create index projects_owner_id_created_at_idx on public.projects (owner_id, created_at desc) where owner_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger storyboards_set_updated_at before update on public.storyboards
  for each row execute function public.set_updated_at();
create trigger scenes_set_updated_at before update on public.scenes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, no anon/authenticated policies (server-only access).
-- ---------------------------------------------------------------------------

alter table public.projects    enable row level security;
alter table public.storyboards enable row level security;
alter table public.scenes      enable row level security;

revoke all on public.projects, public.storyboards, public.scenes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic write functions (called via RPC by the server)
-- ---------------------------------------------------------------------------

-- Inserts a project, its storyboard and all scenes in one transaction. Returns the project id.
create or replace function public.create_project_with_storyboard(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id    uuid;
  v_storyboard_id uuid;
begin
  insert into public.projects (title, theme, genre, duration, aspect_ratio, language)
  select p.title, p.theme, p.genre, p.duration, p.aspect_ratio, p.language
  from jsonb_to_record(payload -> 'project') as p(
    title text, theme text, genre text, duration integer, aspect_ratio text, language text)
  returning id into v_project_id;

  insert into public.storyboards (
    project_id, logline, synopsis, tone, target_emotion, character_bible, visual_bible,
    global_negative_prompt, continuity_check)
  select v_project_id, s.logline, s.synopsis, s.tone, s.target_emotion, s.character_bible,
         s.visual_bible, s.global_negative_prompt, s.continuity_check
  from jsonb_to_record(payload -> 'storyboard') as s(
    logline text, synopsis text, tone text, target_emotion text, character_bible jsonb,
    visual_bible jsonb, global_negative_prompt text, continuity_check jsonb)
  returning id into v_storyboard_id;

  insert into public.scenes (
    storyboard_id, scene_number, title, duration, location, time_of_day, purpose, emotional_beat,
    characters, action, image_prompt, video_prompt, dialogue, voice_over, music, sfx, camera,
    motion, transition, negative_prompt)
  select v_storyboard_id, x.scene_number, x.title, x.duration, x.location, x.time_of_day, x.purpose,
         x.emotional_beat, x.characters, x.action, x.image_prompt, x.video_prompt, x.dialogue,
         x.voice_over, x.music, x.sfx, x.camera, x.motion, x.transition, x.negative_prompt
  from jsonb_to_recordset(payload -> 'scenes') as x(
    scene_number integer, title text, duration integer, location text, time_of_day text,
    purpose text, emotional_beat text, characters jsonb, action text, image_prompt text,
    video_prompt text, dialogue jsonb, voice_over jsonb, music jsonb, sfx jsonb, camera jsonb,
    motion jsonb, transition jsonb, negative_prompt text);

  return v_project_id;
end;
$$;

-- Replaces one scene's content and the storyboard's continuity check in one transaction.
create or replace function public.apply_scene_regeneration(p_scene_id uuid, p_scene jsonb, p_continuity jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_storyboard_id uuid;
begin
  update public.scenes as sc
  set title           = x.title,
      location        = x.location,
      time_of_day     = x.time_of_day,
      purpose         = x.purpose,
      emotional_beat  = x.emotional_beat,
      characters      = x.characters,
      action          = x.action,
      image_prompt    = x.image_prompt,
      video_prompt    = x.video_prompt,
      dialogue        = x.dialogue,
      voice_over      = x.voice_over,
      music           = x.music,
      sfx             = x.sfx,
      camera          = x.camera,
      motion          = x.motion,
      transition      = x.transition,
      negative_prompt = x.negative_prompt
  from jsonb_to_record(p_scene) as x(
    title text, location text, time_of_day text, purpose text, emotional_beat text,
    characters jsonb, action text, image_prompt text, video_prompt text, dialogue jsonb,
    voice_over jsonb, music jsonb, sfx jsonb, camera jsonb, motion jsonb, transition jsonb,
    negative_prompt text)
  where sc.id = p_scene_id
  returning sc.storyboard_id into v_storyboard_id;

  if v_storyboard_id is null then
    raise exception 'scene % not found', p_scene_id using errcode = 'P0002';
  end if;

  update public.storyboards set continuity_check = p_continuity where id = v_storyboard_id;
end;
$$;

revoke execute on function public.create_project_with_storyboard(jsonb) from public, anon, authenticated;
revoke execute on function public.apply_scene_regeneration(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_project_with_storyboard(jsonb) to service_role;
grant execute on function public.apply_scene_regeneration(uuid, jsonb, jsonb) to service_role;
