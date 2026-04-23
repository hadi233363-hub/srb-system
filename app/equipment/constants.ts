// Plain constants — cannot live in actions.ts (that file is "use server"
// which restricts exports to async functions only).

export const EQUIPMENT_CATEGORIES = [
  "camera",
  "lens",
  "light",
  "tripod",
  "microphone",
  "drone",
  "audio",
  "storage",
  "accessory",
  "other",
] as const;

export const EQUIPMENT_CONDITIONS = [
  "new",
  "good",
  "fair",
  "needs_repair",
  "broken",
] as const;
