// Privacy-aware display helpers.
//
// Rule of thumb across the app:
//   - Show NICKNAME when set, falling back to NAME, never an email.
//   - Real emails are visible only to the president (role=admin).
//   - Everyone else sees a masked "a***@gmail.com" or just nothing.

export type RoleLike = "admin" | "manager" | "department_head" | "employee";

interface UserLike {
  nickname?: string | null;
  name: string;
  email?: string | null;
}

// What to show in lists, mentions, assignee pickers, sidebar.
// Always prefers the chosen nickname so users don't leak real names either.
export function displayName(u: UserLike): string {
  const nick = u.nickname?.trim();
  if (nick) return nick;
  return u.name;
}

// "ahmed.ali@gmail.com" → "a***@gmail.com"
// "x@gmail.com"          → "x***@gmail.com"
// Returns "" for falsy input so it's safe to drop into JSX.
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

// Email shown to the viewer. President sees the raw address; everyone else
// sees the mask (or nothing if `hideForOthers` is true).
export function visibleEmail(
  email: string | null | undefined,
  viewerRole: RoleLike | null | undefined,
  options: { hideForOthers?: boolean } = {}
): string {
  if (!email) return "";
  if (viewerRole === "admin") return email;
  if (options.hideForOthers) return "";
  return maskEmail(email);
}
