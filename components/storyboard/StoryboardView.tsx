import { CONTINUITY_GROUP_LABELS, type ContinuityGroup } from "@/lib/constants";
import type { Character, ContinuityCheck, Scene, SpokenLine, StoredProject, VisualBible } from "@/types";
import { PromptBlock } from "./PromptBlock";
import { RegenerateScene } from "./RegenerateScene";

// Server-rendered storyboard. Only PromptBlock (copy) and RegenerateScene are client islands.

const pad = (n: number) => String(n).padStart(2, "0");

function Meta({ items }: { items: [string, string][] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-fog">{k}</dt>
          <dd className="text-chalk">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionHeading({ id, children, note }: { id: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
      <h2 id={id} className="type-billing text-3xl sm:text-4xl">
        {children}
      </h2>
      {note && <p className="text-sm text-fog">{note}</p>}
    </div>
  );
}

function CharacterCard({ c }: { c: Character }) {
  const rows: [string, string][] = [
    ["Age", c.age],
    ["Gender", c.gender],
    ["Nationality", c.nationality],
    ["Appearance", c.appearance],
    ["Face", c.face],
    ["Hair", c.hair],
    ["Clothing", c.clothing],
    ["Accessories", c.accessories],
    ["Personality", c.personality],
    ["Emotional arc", c.emotionalArc],
  ];
  return (
    <article className="sheet p-5">
      <h3 className="type-billing text-2xl">{c.name}</h3>
      <p className="mt-0.5 text-sm text-ink-muted">{c.role}</p>
      <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="mb-1 sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Swatch({ label }: { label: string }) {
  const hex = label.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/i)?.[0];
  return (
    <li className="flex items-center gap-2.5">
      <span className="size-6 shrink-0 rounded-sm border border-white/15" style={{ background: hex ?? "transparent" }} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </li>
  );
}

function VisualBibleSection({ v }: { v: VisualBible }) {
  const rows: [string, string][] = [
    ["Visual style", v.visualStyle],
    ["Cinematography", v.cinematography],
    ["Lighting", v.lighting],
    ["Environment", v.environment],
    ["Atmosphere", v.atmosphere],
    ["Realism", v.realism],
    ["Lens language", v.lensLanguage],
    ["Camera language", v.cameraLanguage],
    ["Depth of field", v.depthOfField],
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map(([k, val]) => (
          <div key={k}>
            <dt className="text-sm text-fog">{k}</dt>
            <dd className="mt-0.5 text-chalk">{val}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="text-sm text-fog">Color palette</h3>
        <ul className="mt-2 space-y-2">
          {v.colorPalette.map((c) => (
            <Swatch key={c} label={c} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Lines({ lines, kind }: { lines: SpokenLine[]; kind: string }) {
  return (
    <ul className="space-y-3">
      {lines.map((l, i) => (
        <li key={i}>
          <p className="font-script text-[15px] font-bold text-chalk">
            {l.speaker} <span className="font-normal text-fog">({kind})</span>
          </p>
          <p className="font-script text-[15px] text-chalk">“{l.text}”</p>
          <p className="mt-0.5 text-xs text-fog">
            {l.voiceType}, {l.age}; {l.emotion}; {l.pacing}
          </p>
        </li>
      ))}
    </ul>
  );
}

function DirectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-line p-4">
      <h4 className="mb-2 text-sm font-semibold text-tungsten">{title}</h4>
      <div className="text-sm text-chalk">{children}</div>
    </section>
  );
}

function SceneCard({ scene, total }: { scene: Scene; total: number }) {
  const spoken = scene.dialogue.length + scene.voiceOver.length > 0;
  return (
    <article
      id={`scene-${scene.sceneNumber}`}
      aria-labelledby={`scene-${scene.sceneNumber}-title`}
      className="scroll-mt-24 rounded border border-line bg-graphite-2 p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <p className="type-billing text-6xl leading-none text-tungsten" aria-hidden="true">
          {pad(scene.sceneNumber)}
        </p>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fog">
            Scene {scene.sceneNumber} of {total}
          </p>
          <h3 id={`scene-${scene.sceneNumber}-title`} className="type-billing text-3xl text-chalk">
            {scene.title}
          </h3>
        </div>
      </header>

      <div className="mt-5">
        <Meta
          items={[
            ["Duration", `${scene.duration} seconds`],
            ["Location", scene.location],
            ["Time", scene.timeOfDay],
            ["Characters", scene.characters.join(", ") || "None"],
          ]}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-fog">Purpose</p>
          <p className="text-chalk">{scene.purpose}</p>
        </div>
        <div>
          <p className="text-sm text-fog">Emotional beat</p>
          <p className="text-chalk">{scene.emotionalBeat}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-fog">Story</p>
        <p className="max-w-3xl text-lg leading-relaxed text-chalk">{scene.action}</p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <PromptBlock title="Image prompt" content={scene.imagePrompt} />
        <PromptBlock title="Google Flow video prompt" content={scene.videoPrompt} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DirectionBlock title="Dialogue / VO">
          {spoken ? (
            <div className="space-y-3">
              <Lines lines={scene.dialogue} kind="on screen" />
              <Lines lines={scene.voiceOver} kind="V.O." />
            </div>
          ) : (
            <p>Silence — no spoken words. Let the image and sound carry the moment.</p>
          )}
        </DirectionBlock>

        <DirectionBlock title="Music">
          <p>
            {scene.music.genre}, {scene.music.mood.toLowerCase()} — {scene.music.bpm} BPM, {scene.music.intensity} intensity
          </p>
          <p className="mt-1 text-fog">{scene.music.instrumentation.join(", ")}</p>
          <p className="mt-1">{scene.music.direction}</p>
        </DirectionBlock>

        <DirectionBlock title="SFX">
          {scene.sfx.length ? (
            <ul className="space-y-1.5">
              {scene.sfx.map((s, i) => (
                <li key={i}>
                  <span className="font-semibold">{s.sound}</span> <span className="text-fog">({s.timing})</span> — {s.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p>No sound effects.</p>
          )}
        </DirectionBlock>

        <DirectionBlock title="Camera & motion">
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1">
            {(
              [
                ["Shot", scene.camera.shot],
                ["Angle", scene.camera.angle],
                ["Lens", scene.camera.lens],
                ["Framing", scene.camera.framing],
                ["Movement", scene.camera.movement],
                ["Focus", scene.camera.focus],
                ["Subject", scene.motion.subjectMovement],
                ["Environment", scene.motion.environmentMovement],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-fog">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </DirectionBlock>
      </div>

      <div className="mt-4">
        <DirectionBlock title="Transition">
          <p>
            <span className="font-semibold">{scene.transition.type}</span> — {scene.transition.description}
          </p>
        </DirectionBlock>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-fog hover:text-chalk">Scene negative prompt</summary>
        <div className="mt-3">
          <PromptBlock title="Negative prompt" content={scene.negativePrompt} tone="quiet" />
        </div>
      </details>

      {scene.id && (
        <div className="mt-6 border-t border-line pt-5">
          <RegenerateScene sceneId={scene.id} sceneNumber={scene.sceneNumber} />
        </div>
      )}
    </article>
  );
}

function ContinuitySection({ check }: { check: ContinuityCheck }) {
  const fixed = check.issues.filter((i) => i.fixed);
  const open = check.issues.filter((i) => !i.fixed);
  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <div>
        <p className={`type-billing text-4xl ${check.status === "PASS" ? "text-bluehour" : "text-slate-red"}`}>
          {check.status === "PASS" ? "Pass" : "Needs revision"}
        </p>
        <ul className="mt-4 space-y-2">
          {(Object.keys(check.groups) as ContinuityGroup[]).map((g) => {
            const status = check.groups[g].status;
            return (
              <li key={g} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`flex size-5 items-center justify-center rounded-full text-xs font-bold text-ink ${
                    status === "fail" ? "bg-slate-red" : "bg-bluehour"
                  }`}
                >
                  {status === "fail" ? "!" : "✓"}
                </span>
                <span>
                  {CONTINUITY_GROUP_LABELS[g]}
                  <span className="sr-only">
                    : {status === "fail" ? "needs revision" : status === "fixed" ? "fixed automatically" : "passed"}
                  </span>
                  {status === "fixed" && <span className="ml-2 text-sm text-fog">auto-fixed</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-6">
        {open.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold text-chalk">Worth a look</h3>
            <ul className="space-y-2 text-sm">
              {open.map((i, n) => (
                <li key={n} className="border-l-2 border-slate-red/70 pl-3">
                  <span className="text-fog">
                    {i.category}
                    {i.sceneNumber ? `, scene ${i.sceneNumber}` : ""}:
                  </span>{" "}
                  {i.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        {fixed.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold text-chalk">Fixed automatically</h3>
            <ul className="space-y-2 text-sm">
              {fixed.map((i, n) => (
                <li key={n} className="border-l-2 border-bluehour/70 pl-3">
                  <span className="text-fog">
                    {i.category}
                    {i.sceneNumber ? `, scene ${i.sceneNumber}` : ""}:
                  </span>{" "}
                  {i.description} {i.resolution}
                </li>
              ))}
            </ul>
          </div>
        )}
        {check.issues.length === 0 && (
          <p className="text-fog">No continuity problems found across characters, visuals, narrative and audio.</p>
        )}
      </div>
    </div>
  );
}

export function StoryboardView({ project }: { project: StoredProject }) {
  const sb = project.storyboard;
  const p = sb.project;
  const sections: [string, string][] = [
    ["#story", "Story"],
    ["#characters", "Characters"],
    ["#visual", "Visual bible"],
    ...sb.scenes.map((s): [string, string] => [`#scene-${s.sceneNumber}`, `Scene ${s.sceneNumber}`]),
    ["#negative", "Negative prompt"],
    ["#continuity", "Continuity"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <p className="text-sm text-fog">Video storyboard</p>
        <h1 className="type-billing mt-1 text-5xl text-chalk sm:text-7xl">{p.title}</h1>
        <div className="mt-6">
          <Meta
            items={[
              ["Genre", p.genre],
              ["Duration", `${p.duration} seconds`],
              ["Aspect ratio", p.aspectRatio],
              ["Language", p.language],
              ["Scenes", String(sb.scenes.length)],
              ["Continuity", sb.continuityCheck.status === "PASS" ? "Pass" : "Needs revision"],
            ]}
          />
        </div>
      </header>

      <nav aria-label="Storyboard sections" className="mb-12 flex flex-wrap gap-2 text-sm">
        {sections.map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-line px-3 py-1.5 text-fog hover:border-fog hover:text-chalk">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-16">
        <section aria-labelledby="story" className="scroll-mt-24">
          <SectionHeading id="story">Story concept</SectionHeading>
          <div className="sheet p-6 sm:p-8">
            <p className="text-sm text-ink-muted">Logline</p>
            <p className="mt-1 max-w-3xl text-xl leading-snug sm:text-2xl">{p.logline}</p>
            <p className="mt-6 text-sm text-ink-muted">Synopsis</p>
            <p className="mt-1 max-w-3xl leading-relaxed">{p.synopsis}</p>
            <dl className="mt-6 grid gap-4 border-t border-rule pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-ink-muted">Tone</dt>
                <dd>{p.tone}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Target emotion</dt>
                <dd>{p.targetEmotion}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Idea</dt>
                <dd>{p.theme}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-labelledby="characters" className="scroll-mt-24">
          <SectionHeading id="characters" note="Locked across every scene">
            Character bible
          </SectionHeading>
          <div className="grid gap-4 md:grid-cols-2">
            {sb.characters.map((c) => (
              <CharacterCard key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section aria-labelledby="visual" className="scroll-mt-24">
          <SectionHeading id="visual">Visual bible</SectionHeading>
          <VisualBibleSection v={sb.visualBible} />
        </section>

        <section aria-labelledby="scenes-heading" className="space-y-8">
          <SectionHeading id="scenes-heading" note={`${sb.scenes.length} scenes, ${p.duration} seconds`}>
            Scenes
          </SectionHeading>
          {sb.scenes.map((s) => (
            <SceneCard key={s.id ?? s.sceneNumber} scene={s} total={sb.scenes.length} />
          ))}
        </section>

        <section aria-labelledby="negative" className="scroll-mt-24">
          <SectionHeading id="negative" note="Use with every image and video prompt">
            Global negative prompt
          </SectionHeading>
          <PromptBlock title="Global negative prompt" content={sb.globalNegativePrompt} />
        </section>

        <section aria-labelledby="continuity" className="scroll-mt-24">
          <SectionHeading id="continuity">Continuity check</SectionHeading>
          <ContinuitySection check={sb.continuityCheck} />
        </section>
      </div>
    </div>
  );
}
