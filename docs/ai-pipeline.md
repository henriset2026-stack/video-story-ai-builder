# AI Pipeline

How one idea becomes a validated storyboard. Code lives in `lib/ai/` (engines, providers, orchestrator), `prompts/` (prompt builders) and `lib/schemas/` (contracts).

## 1. Flow

```
POST /api/generate  (input validated by GenerationInputSchema)
  │
  ├─ 1 understand      allocate scene durations (sum = requested total)
  ├─ 2 story           title, logline, synopsis, tone, emotion, character seeds, scene outline
  ├─ 3 characters      Character Bible (locked visual description per character)
  ├─ 4 visual          Visual Bible (style, lighting, palette, lenses, camera language)
  ├─ 5 scenes          per-scene details, camera, motion, transition
  ├─ 6 imagePrompts ┐
  ├─ 7 videoPrompts ├─ run in parallel
  ├─ 8 audio        ┘  dialogue / VO, music, SFX
  └─ 9 continuity      rules → AI review → apply fixes → rules again
        │
        └─ final StoryboardSchema validation → repository.createProject
```

Each step emits `{"type":"progress","step":…,"status":"running"|"done"|"error"}` over NDJSON, so the 9 steps in the UI reflect real work, not a timer. A full generation makes **8 AI calls**, 6 of them sequential. Regenerating a scene makes **2** (rewrite + continuity review).

| Engine | File | Prompt | Output schema |
| --- | --- | --- | --- |
| Story | `engines/story.ts` | `prompts/story.ts` | `StoryEngineOutputSchema` |
| Characters | `engines/story.ts` | `prompts/story.ts` | `CharacterEngineOutputSchema` |
| Visual | `engines/visual.ts` | `prompts/visual.ts` | `VisualEngineOutputSchema` |
| Scenes | `engines/scenes.ts` | `prompts/scenes.ts` | `SceneEngineOutputSchema` |
| Image prompts | `engines/media.ts` | `prompts/media.ts` | `ImagePromptEngineOutputSchema` |
| Video prompts | `engines/media.ts` | `prompts/media.ts` | `VideoPromptEngineOutputSchema` |
| Audio | `engines/audio.ts` | `prompts/audio.ts` | `AudioEngineOutputSchema` |
| Continuity review | `engines/continuity.ts` | `prompts/continuity.ts` | `ContinuityReviewOutputSchema` |
| Scene regeneration | `engines/regenerate.ts` | `prompts/regenerate.ts` | `RegenerateSceneEngineOutputSchema` |

Engines are independent: each takes plain data, builds its prompt, and calls the provider. Only `lib/ai/orchestrator.ts` knows the order.

## 2. Prompt design

Every prompt starts from shared fragments in `prompts/shared.ts`:

- **Persona** — film director, cinematographer, sound designer and prompt engineer.
- **Quality rules** — name concrete things (ages, garments and materials, light direction and color temperature, focal length, camera movement); ground details in the culture of the idea (default Indonesia); keep continuity; no logos, celebrities or on-screen text. Generic lines like "a cinematic scene" are forbidden.
- **Language rule** — story text and spoken lines use the project language (Indonesian or English). Image prompts, video prompts, negative prompts and technical direction are always English, because generators follow English best.
- **Character lock** — `characterLock()` turns each Character Bible entry into one line that is repeated inside every image and video prompt, so each prompt works stand-alone in any generator.
- **Story structure** — `beatFor()` assigns Setup → Development/Conflict → Climax → Resolution / Payoff by scene position.

Image and video prompts are deliberately separate engines. The image prompt describes one frozen frame (subject, expression, foreground/midground/background, light, composition, lens, grade). The video prompt describes change over time: start state → body, face and object movement → camera movement and focus changes → lighting changes → physics → end state → transition.

The audio engine gets a word budget per scene (≈2.3 words per second) so dialogue fits the duration.

## 3. Validation — uncontrolled output never reaches the app

1. **Structured output at the provider.** Each engine's Zod schema is converted to JSON Schema (`toJsonSchema`) and sent as the vendor's structured-output format: Anthropic forced tool use, OpenAI `json_schema` response format, Gemini `responseJsonSchema`.
2. **Zod validation** of every response, including request-specific checks via `superRefine`: exactly N scenes numbered 1..N, character names that exist in the Bible, audio mode consistent with the spoken lines.
3. **One repair retry.** On failure, the provider re-asks with the validation errors appended. A second failure becomes `AI_INVALID_RESPONSE`.
4. **Truncation is an error.** `max_tokens` / `length` / `MAX_TOKENS` stop reasons are rejected instead of parsed.
5. **Final validation** of the assembled storyboard against `StoryboardSchema` before saving.
6. **Read-back validation.** Rows loaded from Supabase or the local store are validated again; invalid rows are ignored, not rendered.

Minimum lengths in the schemas (e.g. 160 characters for image and video prompts) enforce the quality bar mechanically.

## 4. Continuity engine

`lib/continuity/rules.ts` (pure, unit-tested) runs before and after the AI review:

| Rule | Category | Auto-fix |
| --- | --- | --- |
| Scene numbers out of order | Narrative | Renumber |
| Durations don't sum to the total | Narrative | Rebalance |
| Scene lists a character not in the Bible | Character | Remove from cast |
| Prompt doesn't restate a character's locked look | Clothing | Append the locked description |
| Image prompt missing the aspect ratio | Camera | Append it |
| Audio mode contradicts the lines | Audio | Derive the correct mode |
| Spoken lines too long for the scene (>2.8 words/s) | Audio | No — flagged medium |
| Time of day jumps across a hard cut | Time | No — flagged low (advisory) |

Then the **AI script supervisor** (`prompts/continuity.ts`) reviews the whole storyboard for the 14 categories (character, face, hair, clothing, accessories, props, location, time, lighting, weather, camera, narrative, emotion, audio). It may propose a complete replacement for one of these scene fields: `imagePrompt`, `videoPrompt`, `action`, `location`, `timeOfDay`. It can never rewrite the bibles. Rewrites shorter than the field's minimum are rejected. The rules run again afterwards, so an AI rewrite cannot break a character lock.

**Status:** `NEEDS_REVISION` if any unfixed issue is medium or high severity; otherwise `PASS`. Low-severity issues are shown as "Worth a look".

If the AI review call fails, generation still succeeds with the rule-based result plus a visible low-severity note — the user is never left without a storyboard because the reviewer timed out.

## 5. Scene regeneration

`regenerateScene()` in the orchestrator:

1. Sends the full context — both bibles, the previous and next scenes, the story, and the optional user instruction — with the rule that only this scene may change.
2. Keeps the scene's number and duration.
3. Runs the continuity engine with AI rewrites restricted to the regenerated scene.
4. Re-assembles the result from the **original** bibles and other scenes, so nothing else can change even if a step misbehaves.
5. Persists the scene and the new continuity check atomically (`apply_scene_regeneration` RPC in Supabase).

## 6. Negative prompts

The global negative prompt is the fixed list from the product spec (`BASE_NEGATIVE_PROMPT_TERMS`). Each scene's negative prompt is that list plus up to 8 scene-specific terms from the image prompt engine (e.g. "modern smartphone" in a period scene), de-duplicated.

## 7. Mock mode

`MockProvider` (`lib/ai/mock/`) implements the same `AIProvider` interface and is used when `AI_MOCK_MODE=true` or no `AI_PROVIDER_API_KEY` is set.

- It receives the engine's structured input (`input` field of the request) rather than parsing prompts, and returns deterministic data for each task.
- Ideas are matched by keyword to themed presets: father's letter, farmer + AI, fisherman in a storm, business / UMKM transformation, Indonesia 2045 city, coffee commercial, mystery house. Anything else uses a fallback preset that quotes the idea.
- Presets hold four beats; 1–8 scenes are mapped onto them. Story text and spoken lines are bilingual (Indonesian / English).
- Output still goes through the same schemas, so a broken fixture fails loudly.
- `AI_MOCK_LATENCY_MS` adds a small delay per step so the progress UI is visible.

Mock regeneration appends the instruction as a director's note rather than truly rewriting the scene.

## 8. Errors

Provider failures map to safe `AppError` codes (`lib/errors.ts`):

| Situation | Code | Shown to the user |
| --- | --- | --- |
| HTTP 429 from the provider | `AI_RATE_LIMITED` | "The AI service is busy right now…" |
| Timeout / 408 / 504 | `AI_TIMEOUT` | "The AI took too long to respond…" |
| Invalid or truncated output after repair | `AI_INVALID_RESPONSE` | "Something went wrong while creating your story…" |
| Any other provider failure | `AI_FAILED` | same as above |
| Too many requests from one client | `RATE_LIMITED` | "You're creating videos too quickly…" |

Details go to server logs only, with API keys and JWTs redacted (`redactSecrets`). Vendor error bodies are truncated to 300 characters.

## 9. Adding a provider

1. Create `lib/ai/providers/<name>.ts` extending `HttpProvider` and implement `callText` and `callStructured` (return parsed JSON; throw `AppError` on truncation or empty output). `postJson` already handles timeouts and HTTP error mapping.
2. Add the name to `AI_PROVIDERS` and a default model to `DEFAULT_MODELS` in `lib/config.ts`.
3. Add a `case` in `getAIProvider()` (`lib/ai/index.ts`).

Nothing else changes: engines, schemas, validation and the repair retry are shared.

## 10. Known limits

- Real providers are implemented against each vendor's HTTP API but have not yet been exercised with live keys; model defaults may need updating as vendors rename models (`AI_MODEL` overrides them).
- The rate limiter is in memory, so limits apply per server instance; use a shared store (e.g. Redis) behind the `RateLimiter` interface for multi-instance hosting.
- A generation takes roughly as long as 6 sequential AI calls; `maxDuration` on `/api/generate` is 300 s.
