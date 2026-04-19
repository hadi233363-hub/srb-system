import { broadcast, getSim } from "./state";
import { tickAgents } from "./agents";
import {
  maybeGenerateProject,
  maybeScopeCreep,
  maybeTriggerCrisis,
  pruneOldProjects,
  tickProjectDeadlines,
} from "./projects";
import { tickFinance } from "./finance";
import { maybeSpawnScenario, pruneExpiredScenarios } from "./decisions";

const REAL_TICK_MS = 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function simulateOneHour() {
  const sim = getSim();
  const state = sim.state;

  state.simTime += MS_PER_HOUR;

  tickAgents(state);
  tickProjectDeadlines(state);
  maybeScopeCreep(state);
  maybeTriggerCrisis(state);
  maybeSpawnScenario(state);
  pruneExpiredScenarios(state);

  const simHour = Math.floor(state.simTime / MS_PER_HOUR) % 24;
  if (simHour === 0) {
    tickFinance(state);
    if (!state.settings.hiringPaused) maybeGenerateProject(state);
  }

  if (simHour === 12 && Math.floor(state.simTime / MS_PER_DAY) % 7 === 0) {
    pruneOldProjects(state);
  }
}

function tick() {
  const sim = getSim();
  const state = sim.state;

  if (state.paused || state.speedMultiplier <= 0) {
    broadcastSnapshot();
    return;
  }

  const hours = Math.max(1, state.speedMultiplier);
  for (let i = 0; i < hours; i++) {
    simulateOneHour();
  }

  broadcastSnapshot();
}

function broadcastSnapshot() {
  broadcast({ type: "snapshot", payload: getSim().state });
}

export function ensureStarted(): void {
  const sim = getSim();
  if (sim.tickHandle) return;
  sim.tickHandle = setInterval(tick, REAL_TICK_MS);
  console.log("[sim] engine started · tick=1000ms · speed=10×");
}

export function setSpeed(multiplier: number): void {
  const state = getSim().state;
  state.speedMultiplier = Math.max(0, Math.min(1000, Math.round(multiplier)));
  broadcastSnapshot();
}

export function setPaused(paused: boolean): void {
  const state = getSim().state;
  state.paused = paused;
  broadcastSnapshot();
}
