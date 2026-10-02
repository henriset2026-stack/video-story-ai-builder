"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

interface Props {
  projectId: string;
  title: string;
  /** Where to go after deleting; defaults to refreshing the current page. */
  redirectTo?: string;
}

/** Two-step delete: the first click asks for confirmation inline, the second deletes. */
export function DeleteProjectButton({ projectId, title, redirectTo }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Couldn’t delete the project. Please try again.");
        setDeleting(false);
        return;
      }
      startTransition(() => {
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      });
    } catch {
      setError("Connection lost. Check your internet connection and try again.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setConfirming(true);
          requestAnimationFrame(() => cancelRef.current?.focus());
        }}
        className="rounded px-3 py-2 text-sm text-fog transition-colors hover:text-slate-red"
        aria-label={`Delete ${title}`}
      >
        Delete
      </button>
    );
  }

  return (
    <div role="group" aria-label={`Confirm deleting ${title}`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-chalk">Delete this project for good?</span>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="rounded bg-slate-red px-3 py-2 text-sm font-semibold text-ink hover:bg-[#dc6a56] disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "Delete project"}
      </button>
      <button
        ref={cancelRef}
        type="button"
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className="rounded px-3 py-2 text-sm text-fog hover:text-chalk"
      >
        Keep it
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-slate-red">
          {error}
        </p>
      )}
    </div>
  );
}
