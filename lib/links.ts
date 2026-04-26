// Smart link-type detector. Looks at the host of a URL and returns an emoji
// + Arabic label + Tailwind tone classes so the submission UI can render
// a contextual badge ("🎨 Figma", "📁 Google Drive", etc.) without needing
// to ship per-service icon assets.
//
// All matchers are case-insensitive. A URL the helper doesn't recognize
// falls back to the generic "🔗 رابط" badge.

export interface LinkType {
  /** Single emoji shown next to the label. */
  icon: string;
  /** Human-readable label (Arabic / English brand name). */
  label: string;
  /** Tailwind classes — bg + text + border tone. */
  toneClass: string;
}

const GENERIC: LinkType = {
  icon: "🔗",
  label: "رابط",
  toneClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const RULES: { test: RegExp; type: LinkType }[] = [
  {
    test: /(?:^|\.)figma\.com/i,
    type: {
      icon: "🎨",
      label: "Figma",
      toneClass: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    },
  },
  {
    test: /drive\.google\.com|docs\.google\.com|sheets\.google\.com|slides\.google\.com/i,
    type: {
      icon: "📁",
      label: "Google Drive",
      toneClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    },
  },
  {
    test: /(?:^|\.)youtube\.com|(?:^|\.)youtu\.be/i,
    type: {
      icon: "🎬",
      label: "YouTube",
      toneClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    },
  },
  {
    test: /(?:^|\.)github\.com/i,
    type: {
      icon: "💻",
      label: "GitHub",
      toneClass: "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
    },
  },
  {
    test: /(?:^|\.)notion\.so|(?:^|\.)notion\.site/i,
    type: {
      icon: "📝",
      label: "Notion",
      toneClass: "bg-zinc-500/15 text-zinc-200 border-zinc-500/30",
    },
  },
  {
    test: /(?:^|\.)dropbox\.com/i,
    type: {
      icon: "📦",
      label: "Dropbox",
      toneClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    },
  },
  {
    test: /(?:^|\.)behance\.net/i,
    type: {
      icon: "🎨",
      label: "Behance",
      toneClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    },
  },
  {
    test: /(?:^|\.)vimeo\.com/i,
    type: {
      icon: "🎬",
      label: "Vimeo",
      toneClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    },
  },
  {
    test: /(?:^|\.)loom\.com/i,
    type: {
      icon: "🎥",
      label: "Loom",
      toneClass: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    },
  },
];

export function detectLinkType(url: string | null | undefined): LinkType {
  if (!url) return GENERIC;
  let host = url.toLowerCase();
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
  } catch {
    // Not a parseable URL — fall through to raw substring match below.
  }
  for (const rule of RULES) {
    if (rule.test.test(host)) return rule.type;
  }
  return GENERIC;
}
