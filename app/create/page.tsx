import type { Metadata } from "next";
import { CreateVideoForm } from "@/components/create/CreateVideoForm";
import { THEME_MAX_LENGTH } from "@/lib/constants";

export const metadata: Metadata = { title: "Create video" };

export default async function CreatePage({ searchParams }: PageProps<"/create">) {
  const { theme } = await searchParams;
  const initialTheme = (typeof theme === "string" ? theme : "").slice(0, THEME_MAX_LENGTH);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <CreateVideoForm initialTheme={initialTheme} />
    </div>
  );
}
