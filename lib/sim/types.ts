export type Role =
  | "account_manager"
  | "designer"
  | "video_editor"
  | "developer"
  | "sales";

export type Archetype =
  | "efficient"
  | "lazy"
  | "inconsistent"
  | "perfectionist"
  | "burnout_prone"
  | "rookie";

export type AgentStatus = "idle" | "working" | "blocked" | "absent";

export type Seniority = "junior" | "mid" | "senior";

export type ProjectType =
  | "video"
  | "photo"
  | "event"
  | "digital_campaign"
  | "web";

export type ProjectPriority = "low" | "normal" | "urgent";

export type ProjectStatus =
  | "active"
  | "delayed"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStatus = "todo" | "in_progress" | "done" | "failed";

export type TransactionKind =
  | "income"
  | "salary"
  | "overhead"
  | "tool"
  | "ad"
  | "refund"
  | "bonus"
  | "hiring_cost"
  | "severance";

export type ActivityKind = "info" | "success" | "warning" | "error" | "decision";

export interface Traits {
  speed: number;
  accuracy: number;
  reliability: number;
  creativity: number;
}

export interface Agent {
  id: string;
  name: string;
  role: Role;
  archetype: Archetype;
  traits: Traits;
  morale: number;
  loyalty: number;
  salaryMonthly: number;
  status: AgentStatus;
  currentTaskId: string | null;
  stats: { tasksCompleted: number; tasksFailed: number; tasksReworked: number };
  hiredAt: number;
  active: boolean;
  absentUntil: number | null;
  xpTasks: number;
  onReview: boolean;
  // Hiring system (optional for backward-compat with older live state)
  seniority?: Seniority;
  /** 0..1 — current effective productivity multiplier. Lower during onboarding. */
  productivity?: number;
  /** 0..1 — linear progress through onboarding period (1 = fully ramped). */
  onboardingProgress?: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  requiredRole: Role;
  assigneeId: string | null;
  estimatedHours: number;
  remainingHours: number;
  status: TaskStatus;
  reworkCount: number;
  revisionCount: number;
  hoursLogged: number;
  addedLate: boolean;
}

export interface Project {
  id: string;
  client: string;
  title: string;
  type: ProjectType;
  budget: number;
  costEstimate: number;
  actualCost: number;
  status: ProjectStatus;
  priority: ProjectPriority;
  createdAt: number;
  deadline: number;
  completedAt: number | null;
  tasks: Task[];
  scopeChanges: number;
  clientRevisions: number;
  crisisCount: number;
  clientSatisfaction: number;
}

export interface Transaction {
  id: string;
  at: number;
  kind: TransactionKind;
  amount: number;
  note?: string;
  projectId?: string;
  agentId?: string;
}

export interface ActivityEntry {
  id: string;
  at: number;
  actor: string;
  message: string;
  kind: ActivityKind;
}

export type ScenarioCategory =
  | "employee_risk"
  | "project_issue"
  | "sales_opportunity"
  | "team_wellbeing"
  | "operations"
  | "external";

export type Urgency = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type OutcomeTone = "positive" | "negative" | "neutral";

export interface DecisionProbability {
  label: string;
  pct: number;
  tone: OutcomeTone;
}

export interface DecisionChoice {
  key: string;
  label: string;
  managerOpinion: string;
  probabilities: DecisionProbability[];
  financialImpact: { min: number; max: number };
  teamImpact: string;
  riskLevel: RiskLevel;
  alternativeHint?: string;
}

export interface Scenario {
  id: string;
  templateId: string;
  category: ScenarioCategory;
  urgency: Urgency;
  title: string;
  description: string;
  spawnedAt: number;
  expiresAt: number;
  contextData: { agentId?: string; projectId?: string; client?: string; role?: Role };
  choices: DecisionChoice[];
  recommendedChoiceKey?: string;
  /** Optional structured review/context points rendered as a bulleted panel in the card. */
  reviewBullets?: string[];
}

export interface DecisionRecord {
  id: string;
  at: number;
  scenarioTitle: string;
  scenarioCategory: ScenarioCategory;
  chosenLabel: string;
  expectedOutcomes: DecisionProbability[];
  actualOutcomes: { label: string; happened: boolean; tone: OutcomeTone }[];
  financialImpact: number;
  summary: string;
}

export interface ManualActionRecord {
  id: string;
  at: number;
  actionType: string;
  label: string;
  financialImpact: number;
  note: string;
}

export interface SimSettings {
  hiringPaused: boolean;
  autoScenarios: boolean;
}

export interface SimState {
  simTime: number;
  startedAt: number;
  speedMultiplier: number;
  paused: boolean;
  agents: Agent[];
  projects: Project[];
  transactions: Transaction[];
  activityLog: ActivityEntry[];
  scenarios: Scenario[];
  decisionLog: DecisionRecord[];
  actionLog: ManualActionRecord[];
  settings: SimSettings;
  counters: {
    projectsCompleted: number;
    projectsFailed: number;
    agentsQuit: number;
    crisesHandled: number;
    decisionsMade: number;
    missedOpportunities: number;
  };
}

export type SimEvent =
  | { type: "snapshot"; payload: SimState }
  | { type: "activity"; payload: ActivityEntry };
