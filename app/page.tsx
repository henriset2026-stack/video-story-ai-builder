import Link from "next/link";
import { EXAMPLE_THEMES } from "@/lib/constants";

// Landing page. The hero's film strip shows real output from one example idea, frame by frame.

const STRIP = [
  {
    label: "Idea",
    body: <p className="text-lg leading-snug">“Video tentang seorang petani Indonesia yang menggunakan AI.”</p>,
  },
  {
    label: "Story",
    body: (
      <>
        <p className="type-billing text-2xl">The Field That Speaks</p>
        <p className="mt-2 text-sm text-ink-muted">
          A skeptical veteran rice farmer must trust his daughter’s AI to save the harvest from a pest outbreak.
        </p>
      </>
    ),
  },
  {
    label: "Scenes",
    body: (
      <ol className="space-y-1.5 text-sm">
        <li><span className="font-semibold">1</span> Yellowing leaves — dawn, 10s</li>
        <li><span className="font-semibold">2</span> Alert from the eastern plot — midday, 10s</li>
        <li><span className="font-semibold">3</span> Golden harvest — golden hour, 10s</li>
      </ol>
    ),
  },
  {
    label: "Prompts",
    body: (
      <p className="font-script text-[13px] leading-snug">
        Extreme wide shot, high angle crane down, of Pak Darto, a 58-year-old Javanese man with short cropped
        salt-and-pepper hair, wearing a faded indigo work shirt… soft cool dawn light, 6000K, 24mm lens…
      </p>
    ),
  },
  {
    label: "Video",
    body: (
      <p className="text-sm leading-relaxed">
        Paste each shot into Google Flow. Three shots, 30 seconds, 16:9, with dialogue, music, SFX and transitions
        already directed.
      </p>
    ),
  },
];

const OUTPUTS = [
  ["Story concept", "Title, logline, synopsis, tone and the emotion you want the audience to feel."],
  ["Character Bible", "Locked face, hair, clothing and accessories so every shot shows the same person."],
  ["Visual Bible", "Style, lighting, palette, lenses and camera language shared by every scene."],
  ["Image prompts", "One stand-alone still-frame prompt per scene, ready to paste."],
  ["Google Flow video prompts", "Written for motion: start state, movement, camera, physics, end state."],
  ["Dialogue and voice-over", "Exact lines with speaker, voice, emotion and pacing — or deliberate silence."],
  ["Music and SFX", "Genre, BPM, instruments and intensity per scene; only sounds that belong in the shot."],
  ["Camera, motion, transitions", "Shot size, angle, lens, movement, focus and how each scene hands off."],
  ["Continuity check", "Characters, props, time, lighting and audio are checked and fixed before you see them."],
] as const;

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <h1 className="type-billing max-w-4xl text-5xl text-chalk sm:text-7xl lg:text-[5.5rem]">
          Turn your idea into a complete video story.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-fog">
          Write one simple idea. Get the story, storyboard, image prompts, Google Flow video prompts, dialogue, music,
          SFX and camera direction — consistent from the first shot to the last.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded bg-tungsten px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-[#f3bd5e]"
          >
            Create my video
          </Link>
          <Link
            href="#examples"
            className="rounded border border-line px-6 py-3.5 text-base font-semibold text-chalk transition-colors hover:border-fog"
          >
            View examples
          </Link>
        </div>

        <figure className="mt-16" aria-labelledby="strip-caption">
          <figcaption id="strip-caption" className="mb-3 text-sm text-fog">
            One idea, five frames: what the builder produces
          </figcaption>
          <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
            <ol className="flex min-w-[900px] rounded-sm bg-[#0e1012] px-2">
              {STRIP.map((frame, i) => (
                <li key={frame.label} className="flex flex-1 flex-col">
                  <div className="sprockets" aria-hidden="true" />
                  <div className="sheet mx-1.5 flex min-h-48 flex-1 flex-col p-4">
                    <p className="mb-3 flex items-baseline gap-2 text-xs text-ink-muted">
                      <span className="font-semibold text-ink">{i + 1}</span>
                      {frame.label}
                    </p>
                    {frame.body}
                  </div>
                  <div className="sprockets" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </div>
        </figure>
      </section>

      <section className="border-t border-line" aria-labelledby="outputs-heading">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="outputs-heading" className="type-billing text-4xl">
              Everything a shoot needs
            </h2>
            <p className="mt-4 max-w-sm text-fog">
              You never write a prompt yourself. The builder directs every department and keeps them in sync.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {OUTPUTS.map(([term, detail]) => (
              <div key={term} className="border-t border-line pt-3">
                <dt className="font-semibold text-chalk">{term}</dt>
                <dd className="mt-1 text-sm text-fog">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="examples" className="scroll-mt-20 border-t border-line" aria-labelledby="examples-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="examples-heading" className="type-billing text-4xl">
            Start from an example
          </h2>
          <p className="mt-4 max-w-xl text-fog">Pick an idea to open it in the builder. You can edit it before creating.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {EXAMPLE_THEMES.map((theme) => (
              <li key={theme}>
                <Link
                  href={`/create?theme=${encodeURIComponent(theme)}`}
                  className="block rounded border border-line px-4 py-3.5 text-chalk transition-colors hover:border-tungsten hover:bg-graphite-2"
                >
                  {theme}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
