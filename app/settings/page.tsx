import type { Metadata } from "next";
import { DefaultsForm } from "@/components/settings/DefaultsForm";
import { getPublicStatus } from "@/lib/config";

export const metadata: Metadata = { title: "Settings" };

// Reads environment status on every request (never cached into the static build).
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const status = getPublicStatus();

  const aiDescription = status.mockMode
    ? status.mockReason === "env"
      ? "Mock mode is on (AI_MOCK_MODE=true). Storyboards use deterministic sample data."
      : "No AI provider key is set, so storyboards use deterministic sample data. Add AI_PROVIDER_API_KEY to generate real stories."
    : `Stories are written by ${status.aiProvider} using ${status.aiModel}.`;

  const storageDescription =
    status.storage === "supabase"
      ? "Projects are saved to Supabase."
      : status.supabaseConfigured
        ? "Projects are saved as local files (STORAGE_DRIVER=local)."
        : "Supabase isn’t configured, so projects are saved as local files in .data/. Use Supabase for any shared or hosted deployment.";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="type-billing text-5xl sm:text-6xl">Settings</h1>

      <section aria-labelledby="defaults-heading" className="mt-10">
        <h2 id="defaults-heading" className="type-billing text-3xl">
          Default video settings
        </h2>
        <p className="mb-5 mt-2 text-fog">New videos start with these choices. They’re saved in this browser only.</p>
        <DefaultsForm />
      </section>

      <section aria-labelledby="status-heading" className="mt-14">
        <h2 id="status-heading" className="type-billing text-3xl">
          Service status
        </h2>
        <p className="mt-2 text-fog">Configured by the server’s environment variables. Keys are never shown here.</p>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-fog">AI</dt>
            <dd>
              <span className="font-semibold">{status.mockMode ? "Mock data" : status.aiProvider}</span>
              <p className="mt-1 text-sm text-fog">{aiDescription}</p>
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-fog">Project storage</dt>
            <dd>
              <span className="font-semibold">{status.storage === "supabase" ? "Supabase" : "Local files"}</span>
              <p className="mt-1 text-sm text-fog">{storageDescription}</p>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
