export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureStarted } = await import("./lib/sim/engine");
    ensureStarted();
  }
}
