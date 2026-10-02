# Product Specification — Video Story AI Builder

> **Tagline:** Turn Your Idea Into a Complete Video.
> **Promise:** One idea → a complete, production-ready video blueprint.

## 1. Problem

Creators using AI video tools (Google Flow / Veo, Runway, Kling, Midjourney, etc.) need
long, precise prompts per shot, and they need those prompts to stay consistent across
shots (same face, same clothes, same light). Most people cannot write these prompts, and
even skilled prompt writers lose continuity between scenes.

## 2. Solution

A web studio that acts like an **AI video director**. The user types one idea, e.g.
_"Seorang anak menemukan surat lama ayahnya."_, picks a few settings, and receives:

| Output | Description |
| --- | --- |
| Story concept | Title, logline, synopsis, genre, tone, target emotion, duration, aspect ratio |
| Character Bible | Locked visual + personality description per character |
| Visual Bible | Style, cinematography, lighting, palette, lens and camera language |
| Storyboard | N scenes with purpose, emotional beat, location, time, action |
| Image prompt | Copy-ready still-frame prompt per scene |
| Google Flow video prompt | Motion-oriented prompt per scene (start state → movement → end state) |
| Dialogue / VO | Speaker, voice, emotion, pacing, exact lines — or deliberate silence |
| Music | Genre, mood, BPM, instrumentation, intensity per scene |
| SFX | Only sounds that exist in the scene |
| Camera & motion | Shot, angle, lens, framing, movement, focus, subject/environment motion |
| Transition | How each scene hands off to the next |
| Negative prompt | Global + scene-specific |
| Continuity check | Automatic check + fix; final status `PASS` / `NEEDS_REVISION` |

## 3. Users

- **Content creators / UMKM marketers** who want cinematic ads without a production team.
- **Filmmakers / students** who want a fast pre-visualization blueprint.
- **AI video hobbyists** who use Google Flow and want consistent multi-shot results.

Primary locale: Indonesia (default language Indonesian), with English supported.

## 4. User journey

```
Landing (/) → Create (/create) → Generate (live progress) → Storyboard (/storyboard/[id])
                                                              ↓
                                   Copy prompts · Regenerate a scene · Revisit in /projects
```

1. User enters a theme (required, 10–1,000 chars).
2. Chooses genre, duration, aspect ratio, language, scene count (sensible defaults:
   Cinematic · 30 s · 16:9 · Indonesian · 3 scenes).
3. Clicks **CREATE MY VIDEO**. The server streams real pipeline progress (9 steps).
4. The storyboard is auto-saved and the user is taken to it.
5. User copies prompts, or regenerates one scene with an optional instruction
   ("Make the lighting more dramatic"). Only that scene changes.
6. Projects are listed in **/projects** where they can be opened or deleted.

## 5. MVP scope

In scope: landing page, create page, generation settings, AI generation with real
progress, storyboard result, scene cards, copy buttons, scene regeneration, save
(auto-save + manual retry), project history, open, delete, continuity validation,
mock mode, settings/status page, docs.

Out of scope for MVP (architecture keeps room for them): actual image/video/voice/music
generation, payments, video editing, social login / accounts, team collaboration,
templates, brand kits, public API.

## 6. Settings (create form)

| Setting | Options | Default |
| --- | --- | --- |
| Genre | Cinematic, Drama, Documentary, Commercial, Inspirational, Mystery / Horror, Sci-Fi, Comedy | Cinematic |
| Duration (s) | 15, 30, 45, 60, 90 | 30 |
| Aspect ratio | 16:9, 9:16, 1:1, 4:5, 2.39:1 | 16:9 |
| Language | Indonesian, English | Indonesian |
| Scene count | 1–8 (min. 3 s per scene) | 3 |

**Language rule:** the selected language governs story text, scene descriptions and
dialogue/VO. Image prompts, video prompts, negative prompts and technical direction
(camera, music, SFX) are always written in **English**, because image/video models
follow English prompts most reliably.

## 7. Quality bar

Prompts must be specific, visual, actionable and production-ready. Every image prompt
restates the locked character description (age, ethnicity, hair, clothing, accessories)
so it works stand-alone in any generator. A prompt like "Create a cinematic scene" is a
defect. See `docs/ai-pipeline.md` for how this is enforced.

## 8. Story structure

- 3 scenes: Setup → Conflict / Development → Resolution / Payoff.
- N scenes: first = Setup, last = Resolution / Payoff, middle scenes escalate
  (Development → Conflict → Climax).
- Scene durations sum to the requested total duration.

## 9. Error handling (user-facing copy)

| Situation | Message |
| --- | --- |
| Empty / too short input | "Please describe your video idea (at least 10 characters)." |
| AI failure / invalid AI output | "Something went wrong while creating your story. Please try again." |
| Timeout | "The AI took too long to respond. Please try again." |
| Rate limit | "You're creating videos too quickly. Please wait a moment and try again." |
| Database failure | "Your storyboard was created but could not be saved. Try saving again." |
| Network failure (client) | "Connection lost. Check your internet connection and try again." |
| Not found | "This project doesn't exist or was deleted." |

Raw errors and stack traces are never shown to users or returned by the API.

## 10. Definition of done

See the checklist in the master prompt (§46). Status is tracked in `README.md`.

## 11. Roadmap (not implemented)

V2 image generation · V3 video generation · V4 voice · V5 music · V6 editor ·
V7 brand kit · V8 character memory · V9 templates · V10 team collaboration ·
V11 public API · V12 billing. Extension points are described in `docs/architecture.md`.
