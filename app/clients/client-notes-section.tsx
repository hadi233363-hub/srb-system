"use client";

// Communication log section on the client profile. Adds and deletes
// touchpoint entries via server actions, keeping the list ordered newest
// first. Times are rendered with `formatRelativeAr` (locale-aware Arabic /
// English) — the underlying createdAt is preserved as a tooltip so the team
// can recover the exact timestamp if the relative copy is ambiguous.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import {
  createClientNoteAction,
  deleteClientNoteAction,
} from "./note-actions";

interface NoteAuthor {
  id: string;
  name: string;
}

export interface ClientNoteRow {
  id: string;
  content: string;
  createdAt: Date | string;
  author: NoteAuthor | null;
}

interface Props {
  clientId: string;
  notes: ClientNoteRow[];
  currentUserId: string;
  currentUserIsOwner: boolean;
}

export function ClientNotesSection({
  clientId,
  notes,
  currentUserId,
  currentUserIsOwner,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createClientNoteAction(clientId, formData);
      if (res.ok) {
        setContent("");
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm(t("clients.notes.deleteConfirm"))) return;
    startTransition(async () => {
      const res = await deleteClientNoteAction(id);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message ?? t("common.errorGeneric"));
      }
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <MessageSquare className="h-4 w-4" />
        {t("clients.notes.title")}
      </h2>

      {error && (
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      <form action={onSubmit} className="space-y-2">
        <textarea
          name="content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("clients.notes.placeholder")}
          required
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isPending ? t("clients.notes.adding") : t("clients.notes.add")}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500">
          {t("clients.notes.empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const canDelete =
              (n.author && n.author.id === currentUserId) || currentUserIsOwner;
            const created = new Date(n.createdAt);
            const authorName =
              n.author?.name ?? t("clients.notes.deletedAuthor");
            return (
              <li
                key={n.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-zinc-200">
                    {authorName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <time
                      title={created.toLocaleString(
                        locale === "ar" ? "ar-EG" : "en-US"
                      )}
                      className="text-zinc-500 tabular-nums"
                    >
                      {formatRelativeAr(created, locale)}
                    </time>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(n.id)}
                        title={t("clients.notes.delete")}
                        className={cn(
                          "rounded p-1 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400",
                          isPending && "opacity-50"
                        )}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-300">
                  {n.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Locale-aware relative formatter ("منذ ٣ ساعات" / "أمس" / explicit date).
// Stays under a minute for "now", then switches to minutes / hours / days,
// and falls back to a short date once we cross 7 days. Western digits are
// kept on purpose so the rest of the system's tabular alignment works.
function formatRelativeAr(d: Date, locale: "ar" | "en"): string {
  const ms = Date.now() - d.getTime();
  if (ms < 0) {
    // Future-dated note — shouldn't happen, but if clocks drift, fall back
    // to an absolute date instead of crashing.
    return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US");
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return locale === "ar" ? "الآن" : "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return locale === "ar"
      ? `منذ ${min} ${min === 1 ? "دقيقة" : "دقيقة"}`
      : `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return locale === "ar"
      ? `منذ ${hr} ${hr === 1 ? "ساعة" : "ساعة"}`
      : `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  if (day === 1) return locale === "ar" ? "أمس" : "yesterday";
  if (day < 7) {
    return locale === "ar" ? `منذ ${day} أيام` : `${day}d ago`;
  }
  // > 1 week: explicit date.
  return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
