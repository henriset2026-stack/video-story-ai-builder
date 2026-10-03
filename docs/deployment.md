# Deployment

The app is a standard Next.js 16 project (no custom server), so it deploys to Vercel or any Node.js host. Production needs two things the local setup doesn't: **Supabase** for storage and an **AI provider key**.

## 1. Supabase

### Create the database

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migration `supabase/migrations/20260923000000_init.sql`, either:
   - **CLI:** link the project, then push the migration.

     ```bash
     supabase link --project-ref <your-project-ref>
     ```

     ```bash
     supabase db push
     ```

   - **Dashboard:** open SQL Editor, paste the file's contents, run it once.

The migration creates `projects`, `storyboards` and `scenes` (foreign keys with cascade delete, indexes, `updated_at` triggers), enables Row Level Security, and adds two functions the app calls through RPC:

- `create_project_with_storyboard(payload)` — inserts a project, its storyboard and all scenes in one transaction.
- `apply_scene_regeneration(scene_id, scene, continuity)` — replaces one scene and the continuity check in one transaction.

### Keys

From **Project Settings → API**:

| Value | Env variable | Exposure |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | public |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **server-only secret** |
| `anon` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional, unused by the MVP |

### Access model

There are no user accounts yet, so the server is the only database client. It uses the service-role key, which only ever runs in route handlers and server components (`server-only` guards fail the build if a client component imports it).

RLS is enabled on all tables with **no** policies for `anon` or `authenticated`, and table privileges and function execute rights are revoked from those roles. Even if the anon key leaks, it cannot read or write projects.

To confirm after setup, this request with the anon key should return an error or an empty list — never project data:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

When accounts are added, set `projects.owner_id` and add policies on `owner_id = auth.uid()` (see the roadmap in `docs/architecture.md`).

## 2. Vercel

1. Import the GitHub repository in Vercel. The framework preset (Next.js), build command (`npm run build`) and output are detected automatically.
2. Add environment variables for Production (and Preview if you want previews to work):

   | Variable | Value |
   | --- | --- |
   | `AI_PROVIDER` | `anthropic`, `openai` or `gemini` |
   | `AI_PROVIDER_API_KEY` | your provider key |
   | `AI_MODEL` | optional model override |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
   | `STORAGE_DRIVER` | `supabase` |

3. Deploy.

### Why set `STORAGE_DRIVER=supabase`

Without it, the app picks local-file storage whenever the Supabase variables are missing. Serverless file systems are read-only and per-instance, so saving would fail and projects would never persist. With `STORAGE_DRIVER=supabase`, a missing variable fails loudly instead of silently falling back.

### Function duration

`/api/generate` sets `maxDuration = 300` (seconds) and `/api/scenes/[id]/regenerate` sets `120`. A full generation is about 6 sequential AI calls. If your plan caps functions lower, generations can be cut off: reduce `AI_TIMEOUT_MS`, use a faster model via `AI_MODEL`, or upgrade the plan. Progress is streamed, so the browser connection stays active during the run.

### Rate limiting

The built-in limiter (5 generations and 15 regenerations per minute per IP) is in memory, so each serverless instance counts separately. For a public deployment, implement the `RateLimiter` interface in `lib/http.ts` on a shared store such as Upstash Redis.

## 3. Other Node.js hosts

```bash
npm ci
```

```bash
npm run build
```

```bash
npm start
```

Set the same environment variables. On a single long-running server, local-file storage works (projects in `LOCAL_DATA_DIR`), but Supabase is still recommended for backups and multiple instances.

## 4. Production checklist

- [ ] Migration applied; anon-key request above returns no data
- [ ] `STORAGE_DRIVER=supabase`, URL and service-role key set as server-side env vars
- [ ] `AI_PROVIDER_API_KEY` set; `/settings` shows the provider (not "Mock data") and "Supabase"
- [ ] `AI_MOCK_MODE` unset or `false`
- [ ] One full generation and one scene regeneration succeed on the deployed URL
- [ ] Function duration limit is at least what a generation needs on your plan
- [ ] Shared rate limiter in place if the app is public
- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass on the commit being deployed

## 5. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Header shows "Mock data" in production | `AI_PROVIDER_API_KEY` missing or `AI_MOCK_MODE=true` |
| "Your storyboard was created but could not be saved" | Storage misconfigured: wrong Supabase URL/key, migration not applied, or local storage on a serverless host |
| Every generation fails with the generic AI error | Invalid key or model name — check the server logs (keys are redacted) and `AI_MODEL` |
| "The AI took too long to respond" | `AI_TIMEOUT_MS` too low for the model, or the platform's function limit was reached |
| Projects page shows an error | Supabase unreachable or the migration is missing — check the server logs |
