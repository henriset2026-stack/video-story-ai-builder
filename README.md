# Video Story AI Builder

**Turn your idea into a complete video story.** Type one idea — _"Video tentang seorang petani Indonesia yang menggunakan AI."_ — and get a production-ready blueprint:

- Story concept (title, logline, synopsis, tone, target emotion)
- Character Bible and Visual Bible, locked across every shot
- A storyboard of 1–8 scenes, each with:
  - a copy-ready **image prompt**
  - a separate **Google Flow (Veo) video prompt** written for motion
  - dialogue / voice-over, music, SFX, camera & motion, transition, negative prompt
- A continuity check that fixes problems automatically and reports PASS / NEEDS_REVISION

Scenes can be regenerated one at a time ("Make the lighting more dramatic") without touching the characters, the look, or the other scenes. Projects are saved and can be reopened or deleted.

No API key? The app runs in **mock mode** with deterministic, theme-aware sample storyboards, so the whole flow works out of the box.

## Quick start

Requires Node.js 20.9+ (developed on Node 24) and npm.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000. With an empty `.env.local` you get mock AI and local-file storage — no accounts needed.

To generate real stories, set `AI_PROVIDER` and `AI_PROVIDER_API_KEY` in `.env.local` and restart.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AI_PROVIDER` | no | `anthropic` | `anthropic`, `openai` or `gemini` |
| `AI_PROVIDER_API_KEY` | for real AI | — | Server-only. Empty ⇒ mock mode |
| `AI_MODEL` | no | per provider | Defaults: `claude-sonnet-5`, `gpt-5-mini`, `gemini-2.5-flash` |
| `AI_MOCK_MODE` | no | `false` | Force mock data even when a key is set |
| `AI_TIMEOUT_MS` | no | `120000` | Timeout per AI call |
| `AI_MOCK_LATENCY_MS` | no | `250` | Delay per mock step so progress is visible |
| `NEXT_PUBLIC_SUPABASE_URL` | for Supabase | — | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for Supabase | — | Server-only. Never expose to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | — | Reserved for future user auth; unused by the MVP |
| `STORAGE_DRIVER` | no | auto | `supabase` when URL + service key are set, else `local` |
| `LOCAL_DATA_DIR` | no | `.data` | Folder for the local development store |

`.env*` files are git-ignored (except `.env.example`). Keys are only read on the server; the Settings page shows which provider and storage are active without revealing any key.

## Storage

- **Local files (default)** — one JSON file per project in `.data/projects/`. Good for development. Not suitable for serverless hosting.
- **Supabase** — apply `supabase/migrations/20260923000000_init.sql`, then set the two Supabase variables. See [docs/deployment.md](docs/deployment.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (Turbopack) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit` |
| `npm test` | Vitest: pipeline (all 8 sample ideas), continuity rules, providers, persistence |

## Pages and API

| Route | Purpose |
| --- | --- |
| `/` | Landing page and example ideas |
| `/create` | Idea + settings, live generation progress (`?theme=` pre-fills the idea) |
| `/storyboard/[id]` | Full storyboard with copy buttons and scene regeneration |
| `/projects`, `/projects/[id]` | Project history and details, delete |
| `/settings` | Default video settings (per browser) and service status |
| `POST /api/generate` | Run the pipeline; streams NDJSON progress, then the saved storyboard |
| `GET`/`POST /api/projects` | List projects / save a storyboard |
| `GET`/`DELETE /api/projects/[id]` | Read / delete one project |
| `POST /api/scenes/[id]/regenerate` | Rewrite one scene, optionally with an instruction |

## Project layout

```
app/          pages, layouts and route handlers
components/   UI (create, storyboard, projects, settings, layout)
lib/ai/       provider interface, providers, engines, mock data, orchestrator
lib/continuity/  deterministic continuity rules
lib/db/       repository interface, Supabase and local implementations
lib/schemas/  Zod schemas — the contract for input, AI output and storage
prompts/      prompt builders, one per engine (never inside UI code)
supabase/     database migration
tests/        Vitest suites
docs/         product spec, architecture, AI pipeline, deployment
```

## Documentation

- [Product specification](docs/product-spec.md) — what the product does and for whom
- [Architecture](docs/architecture.md) — system design, data model, decisions
- [AI pipeline](docs/ai-pipeline.md) — engines, prompts, validation, continuity, mock mode, adding a provider
- [Deployment](docs/deployment.md) — Supabase setup, Vercel, production checklist

## Status

The MVP is feature-complete and verified in mock mode: lint, typecheck, build and 33 tests pass, and the main flows were exercised in a browser (create, progress, storyboard, copy, regenerate, projects, delete, error states, mobile width).

Not yet verified against live services:

- Real AI providers (Anthropic, OpenAI, Gemini) — implemented to each vendor's HTTP API but not yet run with a key.
- Supabase storage — the migration and repository are written and the row mapping is unit-tested, but they haven't run against a real database.

Out of scope for the MVP (see the roadmap in the product spec): image/video/voice/music generation, user accounts, payments, video editing.
