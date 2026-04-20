# SRB Company Simulator — Project Knowledge

Internal simulation system for **SRB** — a Qatari marketing/advertising agency. AI-agent employees run real projects, generate revenue, hit deadlines, fail tasks, and produce the kind of CEO-level problems that require decisions. The owner (user) operates a control room that modifies live state with measurable consequences.

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **Tailwind v4**
- **Single process** — simulation engine runs inside Next.js via `instrumentation.ts`
- **In-memory state** (globalThis singleton, no DB) — resets on server restart
- **Server-Sent Events** for live dashboard (no WebSocket)
- **Arabic-first RTL** · all copy in Qatari dialect

## Run

```bash
cd srb-sim
npm install
npm run dev           # http://localhost:3000
```

No env vars needed for Phase 1. Dev server also listed in `.claude/launch.json` for Claude Code.

## Architecture

```
lib/sim/
├── types.ts              SimState, Agent, Project, Scenario, DecisionChoice, Seniority
├── data.ts               Roles, archetypes, project/task templates, clients, Arabic strings
├── state.ts              globalThis singleton · seed · logActivity · postTransaction
├── engine.ts             setInterval tick (1 real sec = multiplier × sim hours)
├── agents.ts             task work · onboarding · morale · quits · archetype behaviors
├── projects.ts           intake gate · deadlines · scope creep · crises
├── finance.ts            monthly payroll · daily overhead
├── capacity.ts           weekly-hours capacity model · backlog weeks · intakeAcceptanceFactor
├── advisor.ts            company health · agent performance · project risk
├── hiring-advisor.ts     analyzeHire() → HireImpact (capacity delta, revenue opp, break-even)
├── growth.ts             30-day funnel: team → capacity → projects → revenue + bottleneck
├── decisions.ts          11 scenario builders + applyDecision + auto-spawn + forceSpawn
├── insights.ts           bottleneck detection · underperformer detection
└── actions.ts            hireAgent · fireAgent · raiseSalary · bonus · etc. + onboarding consts
```

## Key models

### Capacity
```ts
agentWeeklyCapacity = 40 × seniorityMult × (speed/100) × productivity × moraleMult
seniorityMult = { junior: 0.75, mid: 1.0, senior: 1.3 }
```
Department capacity = Σ over active agents. Backlog weeks = load / capacity → `intakeAcceptanceFactor` controls project intake.

### Onboarding curve
```ts
productivity = INITIAL_PRODUCTIVITY[seniority] + (1 - INITIAL_PRODUCTIVITY[seniority]) × onboardingProgress
```
| Seniority | Start | Full ramp |
|-----------|-------|-----------|
| junior    | 40%   | 60 days   |
| mid       | 65%   | 21 days   |
| senior    | 80%   | 7 days    |

Applied in `tickAgents`: `task.remainingHours -= agent.productivity`.

### Growth funnel (30 days)
Tracks: team → capacity → projects accepted → revenue. Each stage shows now vs prev-window delta. `hireROI = ΔRevenue / ΔPayroll`. Bottleneck = first stage where growth drops (`team | capacity | projects | revenue | profitability | none`). Displayed on `/` and `/control`.

### Scenarios
11 templates in `decisions.ts`:
- employee_risk: `external_offer`, `burnout_warning`, `underperformer`
- project_issue: `project_delayed`, `unhappy_client`, `scope_change`, `project_loss_risk`
- sales_opportunity: `sales_lead`, `high_value_opportunity`
- team_wellbeing: `low_morale`
- operations: `overload`

Each has 3–8 choices with:
- `managerOpinion` — **dynamic string** from state (e.g. "ولاؤه 72 · أداء: نجم")
- `probabilities[]` — **computed from state** (agent traits, company health, project risk). Clamped 5–95%.
- `financialImpact: { min, max }` — scaled (agent.salaryMonthly, project.budget)
- `teamImpact` — human label
- `riskLevel` — auto-assigned based on context

`recommendedChoiceKey` picked by `pickRecommended(choices)` via expected-value scoring:
```ts
expectedValue = Σpositive − 1.2 × Σnegative − riskPenalty[riskLevel]
```

### Apply
`applyDecision(state, scenarioId, choiceKey)`:
1. Rolls each probability.
2. Dispatches to `applyXxx` per templateId.
3. Mutates state (agents, projects, transactions, morale, etc.).
4. Writes `DecisionRecord` with `expectedOutcomes` vs `actualOutcomes` to `state.decisionLog`.

Ignored (expired) scenarios auto-apply the "nothing" choice as a consequence.

## Auto-spawn detection

In `maybeSpawnScenario` every sim hour:
- External offer if agent has ≥10 xp + moderate morale
- Delayed project / unhappy client from state
- Burnout if morale < 30 + xp > 15
- **Underperformer** if failRate > 45% AND onboarding done AND ≥5 tasks history
- Low morale if team avg < 45
- Sales lead if active projects < 5
- Overload if any role pending/avail > 4

## Routes

```
/           Overview — LiveKpis · GrowthFunnel · Cashflow · Activity · Agents · Bottlenecks
/control    CEO Mode — Section 1: Capacity + Funnel + Hire dialog
            Section 2: Scenario Library (10 cards)
            Section 3: Pending Decisions
            Section 4: Manual Actions
            Section 5: Decision Log
/projects   Project list
/team       Agent list + traits radar
/finance    Cashflow · P&L bars · donut · transactions
/activity   Full activity log
/reports    (placeholder)
```

## API

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/sim/stream` | GET | — | SSE stream: `snapshot` + `activity` events |
| `/api/sim/control` | POST | `{ action: "pause"\|"play"\|"speed"\|"reset", value? }` | Time controls |
| `/api/sim/decide` | POST | `{ scenarioId, choiceKey }` OR `{ templateId }` | Apply or spawn |
| `/api/sim/action` | POST | `{ type, params }` | hire, fire, raise, bonus, retreat, cancel_project, priority_boost, hiring_pause |

## State shape

```ts
SimState {
  simTime: number           // epoch ms (sim clock)
  startedAt: number
  speedMultiplier: number   // 1..1000
  paused: boolean
  agents: Agent[]           // with seniority, productivity, onboardingProgress, traits, morale, loyalty, stats, onReview
  projects: Project[]       // with tasks, actualCost, clientSatisfaction, scopeChanges, priority
  transactions: Transaction[]
  activityLog: ActivityEntry[]
  scenarios: Scenario[]     // pending CEO decisions (with optional reviewBullets)
  decisionLog: DecisionRecord[]
  actionLog: ManualActionRecord[]
  settings: { hiringPaused, autoScenarios }
  counters: { projectsCompleted, projectsFailed, agentsQuit, crisesHandled, decisionsMade, missedOpportunities }
}
```

## Design decisions (why)

- **In-memory state** → zero DB overhead; clean reset for demos; fast iteration.
- **SSE, not WebSocket** → one-way data flow, simpler than WS, browser-native `EventSource`.
- **globalThis + version key** (`__sim_v4__`) → survives Next.js HMR; version bumps reset state safely.
- **Pure compute modules** (advisor, capacity, hiring-advisor, growth) → take SimState as arg, return values. Work in both server and client (the hire dialog imports them directly).
- **Arabic-first** → `<html lang="ar" dir="rtl">`, all strings Qatari dialect, numbers `tabular-nums` for readability.
- **No random in analysis** → probabilities computed; randomness only in outcome rolls (`applyDecision`). Makes the advisor feel intelligent.

## Language convention

All UI text in **Qatari Arabic**: `شنو، وش، زين، عاد، ترا، يبي، جذي، مب، حق، هم`. Technical terms stay English inline (`onboarding`, `capacity`, `backlog`, `break-even`).

## What's NOT built (Phase 2)

- Authentication (NextAuth + Credentials + Google)
- Role-based access (Admin / Manager / Employee) using same `participants` model
- Real-user mode — `Agent.kind = "user"` replaces bots one role at a time
- Persistence (Postgres via Prisma) — currently everything is in-memory
- Reports page is a placeholder
- Email/Slack integrations for activity feed
- Multi-company / multi-tenant

## Conversation style for future sessions

- Respond in Qatari Arabic dialect by default.
- Code, file paths, terminal commands in English.
- Keep tool result chatter terse.
- Do NOT rebuild the app — modify surgically.
- Preserve SSE + globalThis architecture unless asked.
