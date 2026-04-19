import type {
  Agent,
  DecisionChoice,
  DecisionRecord,
  Project,
  Role,
  Scenario,
  SimState,
} from "./types";
import {
  ARCHETYPE_TRAITS,
  BASE_SALARY_BY_ROLE,
  CLIENT_POOL,
  ROLE_LABELS,
} from "./data";
import {
  createProject,
  logActivity,
  postTransaction,
  randomChoice,
  uid,
} from "./state";
import {
  averagePerformanceByRole,
  clampPct,
  computeAgentPerformance,
  computeCompanyHealth,
  computeProjectRisk,
  pickRecommended,
  type AgentPerformance,
  type CompanyHealth,
  type ProjectRisk,
} from "./advisor";
import { analyzeHire } from "./hiring-advisor";
import { computeDepartmentLoad } from "./capacity";

const MS_DAY = 24 * 60 * 60 * 1000;

function defaultExpiry(now: number): number {
  return now + 5 * MS_DAY;
}

function findAgent(state: SimState, id?: string): Agent | undefined {
  return id ? state.agents.find((a) => a.id === id) : undefined;
}

function findProject(state: SimState, id?: string): Project | undefined {
  return id ? state.projects.find((p) => p.id === id) : undefined;
}

function adjustMoraleAll(state: SimState, delta: number, exceptId?: string) {
  for (const a of state.agents) {
    if (!a.active) continue;
    if (exceptId && a.id === exceptId) continue;
    a.morale = Math.max(0, Math.min(100, a.morale + delta));
  }
}

function roll(pct: number): boolean {
  return Math.random() * 100 < pct;
}

function rollRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

// ──────────────────────────────────────────────
// SCENARIO BUILDERS
// ──────────────────────────────────────────────

export function buildExternalOffer(state: SimState, agent: Agent): Scenario {
  const newSalary = Math.round(agent.salaryMonthly * 1.3);
  const perf = computeAgentPerformance(state, agent);
  const health = computeCompanyHealth(state);

  // Dynamic probabilities
  // counter_offer — accept rate rises with loyalty + morale + company stability
  const counterStays = clampPct(
    45 + perf.loyaltyHealth * 25 + perf.moraleHealth * 15 + health.financialScore * 10
  );
  const counterJealousy = clampPct(
    15 + (1 - health.teamMoraleScore) * 30 + perf.overall * 15
  );
  // promote — agent commits if loyalty + perceived growth runway
  const promoteStays = clampPct(
    55 + perf.loyaltyHealth * 25 + perf.overall * 15
  );
  const promoteLeads = clampPct(40 + perf.overall * 45);
  const promoteQuality = clampPct(30 + perf.overall * 50 + health.teamMoraleScore * 10);
  // let_go — bottleneck risk = criticality × (1 - spare capacity)
  const letGoBottleneck = clampPct(
    25 + perf.criticalityInRole * 50 + (1 - health.spareCapacityScore) * 20
  );
  const letGoMoraleHit = clampPct(
    15 + (1 - health.teamLoyaltyScore) * 30 + perf.overall * 20
  );
  // ignore — quit chance grows with low loyalty + low morale
  const ignoreQuits = clampPct(
    50 + (1 - perf.loyaltyHealth) * 30 + (1 - perf.moraleHealth) * 15
  );

  const choices: DecisionChoice[] = [
    {
      key: "counter_offer",
      label: "مقابلة العرض — رفع راتب 30%",
      managerOpinion: `${perf.tag === "نجم" || perf.tag === "قوي"
        ? "كفؤ — الحفاظ عليه أرخص من التوظيف من جديد."
        : "مب نجم الشركة، بس الفقدان يكلّف."} ولاؤه ${agent.loyalty} · معنوياته ${agent.morale}.`,
      probabilities: [
        { label: "يقبل ويبقى", pct: counterStays, tone: "positive" },
        { label: "معنوياته ترتفع", pct: clampPct(70 + perf.loyaltyHealth * 20), tone: "positive" },
        { label: "موظف ثاني يطلب نفس المعاملة", pct: counterJealousy, tone: "negative" },
      ],
      financialImpact: { min: -agent.salaryMonthly * 3.6, max: -agent.salaryMonthly * 0.9 },
      teamImpact: "معنوياته +20 · احتمال غيرة",
      riskLevel: "medium",
    },
    {
      key: "promote",
      label: "ترقية لمنصب أعلى",
      managerOpinion: `${perf.tag === "نجم"
        ? "استثمار ذكي — أداؤه يستاهل المسؤولية."
        : perf.tag === "قوي"
        ? "قرار معقول، عنده potential."
        : "حذر: أداؤه ما يستاهل الترقية حالياً."} أداؤه العام ${Math.round(perf.overall * 100)}/100.`,
      probabilities: [
        { label: "يبقى ويلتزم", pct: promoteStays, tone: "positive" },
        { label: "يقود مهام أكبر بنجاح", pct: promoteLeads, tone: "positive" },
        { label: "ضغط إضافي على الميزانية", pct: 100, tone: "negative" },
        { label: "يرفع الجودة العامة", pct: promoteQuality, tone: "positive" },
      ],
      financialImpact: { min: -agent.salaryMonthly * 4.2, max: -agent.salaryMonthly * 1.2 },
      teamImpact: "معنوياته +30 · قدوة للفريق",
      riskLevel: "low",
    },
    {
      key: "let_go",
      label: "خلّه يروح · نوفر الراتب",
      managerOpinion: `${perf.criticalityInRole >= 0.8
        ? "خطر! هو الوحيد في دوره — بتدخل في اختناق مؤكد."
        : perf.criticalityInRole >= 0.5
        ? "لك بديل واحد فقط — الاختناق محتمل لو فشل."
        : "عندك بدلاء — الخسارة محتملة لكن قابلة للاحتواء."}`,
      probabilities: [
        { label: "توفير راتبه", pct: 100, tone: "positive" },
        { label: "اختناق في دوره", pct: letGoBottleneck, tone: "negative" },
        { label: "معنويات الفريق تنزل", pct: letGoMoraleHit, tone: "negative" },
      ],
      financialImpact: { min: agent.salaryMonthly * 0.5, max: agent.salaryMonthly * 2 },
      teamImpact: "الفريق معنوياته −8 · قلق",
      riskLevel: perf.criticalityInRole >= 0.8 || perf.tag === "نجم" ? "critical" : "high",
      alternativeHint: perf.tag === "نجم"
        ? "أداؤه عالي — فقدانه خسارة حقيقية. راجع \"مقابلة العرض\"."
        : undefined,
    },
    {
      key: "ignore",
      label: "ما نسوي شي",
      managerOpinion: "الموظف يحس بعدم التقدير. غالباً يروح.",
      probabilities: [
        { label: "يستقيل", pct: ignoreQuits, tone: "negative" },
        { label: "يبقى ومعنوياته تنهار", pct: clampPct(100 - ignoreQuits - 10), tone: "negative" },
      ],
      financialImpact: { min: 0, max: agent.salaryMonthly },
      teamImpact: "الفريق يشوف عدم التقدير",
      riskLevel: "critical",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "external_offer",
    category: "employee_risk",
    urgency: "high",
    title: `${agent.name} استلم عرض من شركة منافسة`,
    description: `عرض براتب ${newSalary.toLocaleString("en-US")} ر.ق/شهر (+30%). أداؤه: ${perf.tag} · ولاء ${agent.loyalty}.`,
    spawnedAt: state.simTime,
    expiresAt: defaultExpiry(state.simTime),
    contextData: { agentId: agent.id },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildDelayedProject(state: SimState, project: Project): Scenario {
  const risk = computeProjectRisk(state, project);
  const health = computeCompanyHealth(state);
  const amPerf = averagePerformanceByRole(state, "account_manager");
  const clientSat = project.clientSatisfaction / 100;
  const pendingTasks = project.tasks.filter(
    (t) => t.status !== "done" && t.status !== "failed"
  ).length;

  const choices: DecisionChoice[] = [
    {
      key: "offer_discount",
      label: "خصم 10% للعميل لتهدئة الوضع",
      managerOpinion: `رضا العميل حالياً ${Math.round(clientSat * 100)}%. الخصم يهدّي بدون مواجهة.`,
      probabilities: [
        { label: "العميل يقبل التأخير", pct: clampPct(55 + clientSat * 30 + (1 - risk.overall) * 10), tone: "positive" },
        { label: "خسارة من الربحية", pct: 100, tone: "negative" },
        { label: "رضا العميل يرتفع", pct: clampPct(45 + (1 - clientSat) * 40), tone: "positive" },
      ],
      financialImpact: { min: -project.budget * 0.12, max: -project.budget * 0.08 },
      teamImpact: "لا يؤثر مباشرة",
      riskLevel: "low",
    },
    {
      key: "add_resources",
      label: "تعيين موظف إضافي مؤقت",
      managerOpinion: `سعة الفريق ${Math.round(health.spareCapacityScore * 100)}% — ${
        health.spareCapacityScore > 0.3 ? "يوجد طاقم فاضي يقدر يساعد." : "الفريق محمّل — التأثير محدود."
      }`,
      probabilities: [
        { label: "تسريع التسليم", pct: clampPct(45 + health.spareCapacityScore * 40 + risk.teamCapacityForProject * 15), tone: "positive" },
        { label: "ضغط على الميزانية", pct: 100, tone: "negative" },
        { label: "الفريق الحالي يرتاح", pct: clampPct(50 + (1 - health.teamMoraleScore) * 25), tone: "positive" },
      ],
      financialImpact: { min: -8000, max: -3000 },
      teamImpact: "معنويات الفريق على المشروع +10",
      riskLevel: "low",
    },
    {
      key: "communicate_delay",
      label: "إبلاغ العميل بالتأخير بصراحة",
      managerOpinion: `يعتمد على العميل. سابقاً طلب ${project.clientRevisions} مراجعة — ${
        project.clientRevisions > 2 ? "عميل صعب." : "عميل متفاهم نسبياً."
      }`,
      probabilities: [
        { label: "العميل يقبل", pct: clampPct(25 + clientSat * 35 + amPerf * 10), tone: "positive" },
        { label: "العميل يطلب تعويض", pct: clampPct(20 + (1 - clientSat) * 35), tone: "negative" },
        { label: "خسارة ثقة", pct: clampPct(25 + risk.satisfactionRisk * 30), tone: "negative" },
      ],
      financialImpact: { min: -5000, max: 0 },
      teamImpact: "لا يؤثر",
      riskLevel: "medium",
    },
    {
      key: "escalate",
      label: "تصعيد لمدير الحسابات ليتعامل",
      managerOpinion: `أداء مدير الحسابات العام ${Math.round(amPerf * 100)}/100 · ${
        amPerf > 0.65 ? "مدير قوي، جرّب." : "مدير حسابك عادي — لا تبالغ في الأمل."
      }`,
      probabilities: [
        { label: "المدير ينقذ الوضع", pct: clampPct(35 + amPerf * 35 + clientSat * 15), tone: "positive" },
        { label: "يأخذ وقته من الفريق", pct: 70, tone: "negative" },
      ],
      financialImpact: { min: -2000, max: 2000 },
      teamImpact: "مدير الحساب مشغول زيادة",
      riskLevel: "medium",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "project_delayed",
    category: "project_issue",
    urgency: risk.overall > 0.6 ? "high" : "medium",
    title: `مشروع "${project.title}" متأخر`,
    description: `${pendingTasks} مهمة معلّقة · مستوى الخطر: ${risk.tag} · رضا العميل ${Math.round(clientSat * 100)}%`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 3 * MS_DAY,
    contextData: { projectId: project.id },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildUnhappyClient(state: SimState, project: Project): Scenario {
  const risk = computeProjectRisk(state, project);
  const clientSat = project.clientSatisfaction / 100;
  const health = computeCompanyHealth(state);

  const choices: DecisionChoice[] = [
    {
      key: "apology_meeting",
      label: "اجتماع اعتذار + إعادة عمل مجاني",
      managerOpinion: `${project.clientRevisions} مراجعات حتى الآن — ${
        project.clientRevisions >= 4 ? "إعادة العمل ثقيلة لكن ضرورية." : "فرصة إنقاذ العلاقة."
      }`,
      probabilities: [
        { label: "العميل يهدأ", pct: clampPct(55 + clientSat * 25 + (1 - risk.overall) * 10), tone: "positive" },
        { label: "رضا العميل يرتفع", pct: clampPct(45 + (1 - clientSat) * 40), tone: "positive" },
        { label: "ضغط على فريق المشروع", pct: clampPct(65 + (1 - health.spareCapacityScore) * 25), tone: "negative" },
      ],
      financialImpact: { min: -3000, max: -1000 },
      teamImpact: "فريق المشروع −10 · شغل إضافي",
      riskLevel: "low",
    },
    {
      key: "discount",
      label: "تعويض مالي 15% خصم",
      managerOpinion: `هامش المشروع سيتضرر. الوضع المالي: ${health.financialLabel} — ${
        health.financialLabel === "خطر" ? "تجنّب هذا الخيار لو ممكن." : "تقدر تتحملها."
      }`,
      probabilities: [
        { label: "العميل راضي", pct: clampPct(70 + clientSat * 15), tone: "positive" },
        { label: "خسارة من هامش المشروع", pct: 100, tone: "negative" },
      ],
      financialImpact: { min: -project.budget * 0.17, max: -project.budget * 0.13 },
      teamImpact: "لا يؤثر",
      riskLevel: health.financialLabel === "خطر" ? "medium" : "low",
    },
    {
      key: "stand_firm",
      label: "الثبات على موقفنا · الجودة كما تم الاتفاق",
      managerOpinion: `${clientSat < 0.4 ? "العميل منهار ثقة — احتمال إلغاء عالي." : "العلاقة متوترة لكن قابلة للإنقاذ."} ${
        risk.overall > 0.6 ? "مشروعك في أزمة — الصراحة قد تكسر العقد." : ""
      }`,
      probabilities: [
        { label: "العميل يلغي المشروع", pct: clampPct(25 + (1 - clientSat) * 45 + risk.satisfactionRisk * 15), tone: "negative" },
        { label: "يرجع يقبل", pct: clampPct(20 + clientSat * 30), tone: "positive" },
        { label: "سمعة سلبية محتملة", pct: clampPct(20 + (1 - clientSat) * 20), tone: "negative" },
      ],
      financialImpact: { min: -project.budget * 0.5, max: 0 },
      teamImpact: "الفريق يحترم الموقف · +5",
      riskLevel: clientSat < 0.4 ? "critical" : "high",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "unhappy_client",
    category: "project_issue",
    urgency: clientSat < 0.3 ? "high" : "medium",
    title: `${project.client} مب راضي عن "${project.title}"`,
    description: `${project.clientRevisions} مراجعة · رضا ${Math.round(clientSat * 100)}% · خطر ${risk.tag}`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 2 * MS_DAY,
    contextData: { projectId: project.id },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildSalesLead(state: SimState): Scenario {
  const client = randomChoice(CLIENT_POOL);
  const baseBudget = rollRange(25000, 80000);
  const health = computeCompanyHealth(state);
  const salesPerf = averagePerformanceByRole(state, "sales");

  const choices: DecisionChoice[] = [
    {
      key: "accept",
      label: "قبول المشروع كما هو",
      managerOpinion: `سعة الفريق ${Math.round(health.spareCapacityScore * 100)}% · ${
        health.spareCapacityScore > 0.3 ? "عندنا متّسع لهذا المشروع." : "الفريق محمّل — الضغط سيرتفع."
      }`,
      probabilities: [
        { label: "إيراد إضافي", pct: 100, tone: "positive" },
        { label: "ضغط على الفريق", pct: clampPct(30 + (1 - health.spareCapacityScore) * 55), tone: "negative" },
      ],
      financialImpact: { min: baseBudget * 0.3, max: baseBudget * 0.5 },
      teamImpact: "المبيعات +10 · الفريق التنفيذي تحت ضغط",
      riskLevel: health.spareCapacityScore < 0.2 ? "medium" : "low",
    },
    {
      key: "negotiate_higher",
      label: "تفاوض لرفع الميزانية 20%",
      managerOpinion: `أداء المبيعات ${Math.round(salesPerf * 100)}/100 · ${
        salesPerf > 0.65 ? "فريق مبيعاتك قوي — جرب." : salesPerf > 0.4 ? "الفرصة ٥٠/٥٠." : "فريق المبيعات ضعيف — احتمال تخسر العميل."
      }`,
      probabilities: [
        { label: "العميل يقبل", pct: clampPct(35 + salesPerf * 35), tone: "positive" },
        { label: "العميل يمشي", pct: clampPct(20 + (1 - salesPerf) * 30), tone: "negative" },
        { label: "هامش أعلى", pct: clampPct(40 + salesPerf * 25), tone: "positive" },
      ],
      financialImpact: { min: -baseBudget * 0.5, max: baseBudget * 0.7 },
      teamImpact: "لا يؤثر مباشرة",
      riskLevel: salesPerf < 0.4 ? "high" : "medium",
    },
    {
      key: "reject",
      label: "رفض · الفريق محمّل",
      managerOpinion: `${health.spareCapacityScore < 0.2 ? "قرار حكيم — الفريق محمّل فعلاً." : "تضحية بإيراد لما ما تحتاج فعلاً."}`,
      probabilities: [
        { label: "حماية الفريق من الاحتراق", pct: 100, tone: "positive" },
        { label: "فقدان سمعة مع العميل", pct: clampPct(20 + (1 - salesPerf) * 20), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: "الفريق +5 · شعور بالتقدير",
      riskLevel: "low",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "sales_lead",
    category: "sales_opportunity",
    urgency: "medium",
    title: `فرصة مشروع جديد من ${client}`,
    description: `عرض ${baseBudget.toLocaleString("en-US")} ر.ق · سعة الفريق ${Math.round(health.spareCapacityScore * 100)}% · مبيعات ${Math.round(salesPerf * 100)}%`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 3 * MS_DAY,
    contextData: { client },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildOverload(state: SimState, role: Role, pending: number): Scenario {
  const health = computeCompanyHealth(state);
  const roleAgents = state.agents.filter((a) => a.active && a.role === role);
  const ratio = roleAgents.length > 0 ? pending / roleAgents.length : pending;
  const avgMoraleInRole =
    roleAgents.length > 0
      ? roleAgents.reduce((s, a) => s + a.morale, 0) / roleAgents.length / 100
      : 0.5;

  // Use the hiring advisor to compute actual impact for the suggested hire.
  const juniorImpact = analyzeHire(state, role, "junior");

  const choices: DecisionChoice[] = [
    {
      key: "hire_junior",
      label: `توظيف junior ${ROLE_LABELS[role]}`,
      managerOpinion: `${juniorImpact.reason} Break-even: ${
        juniorImpact.breakEvenMonths ?? "—"
      } شهور · سعة +${Math.round(juniorImpact.capacityDeltaPct)}%.`,
      probabilities: [
        { label: "تخفيف الاختناق بعد onboarding", pct: clampPct(55 + Math.min(30, ratio * 5)), tone: "positive" },
        { label: "تكلفة راتب جديد", pct: 100, tone: "negative" },
        { label: "وقت تعلم + إنتاجية أولية 40%", pct: 100, tone: "neutral" },
      ],
      financialImpact: { min: -juniorImpact.monthlySalary * 1.2, max: -juniorImpact.monthlySalary * 0.5 },
      teamImpact: `الفريق الحالي +8 · راحة تدريجية`,
      riskLevel: health.financialLabel === "خطر" ? "high" : "low",
    },
    {
      key: "outsource",
      label: "تكليف freelancer لإخلاء بعض المهام",
      managerOpinion: `مرن ومباشر — بس الجودة خارج سيطرتك. ${health.financialLabel === "ممتاز" || health.financialLabel === "مستقر" ? "الميزانية تتحمل." : "مكلف."}`,
      probabilities: [
        { label: "تسريع تسليم المهام", pct: clampPct(55 + Math.min(20, ratio * 3)), tone: "positive" },
        { label: "جودة أقل من المتوقع", pct: clampPct(35 + (1 - health.teamMoraleScore) * 10), tone: "negative" },
      ],
      financialImpact: { min: -18000, max: -8000 },
      teamImpact: "الفريق الحالي +5",
      riskLevel: "medium",
    },
    {
      key: "postpone_projects",
      label: "تأخير المشاريع الأقل أولوية",
      managerOpinion: `العملاء ذوو الأولوية المنخفضة سيتأثرون. متوسط رضا العملاء ${Math.round(health.clientSatisfactionScore * 100)}%.`,
      probabilities: [
        { label: "تخفيف الحمل", pct: 100, tone: "positive" },
        { label: "فقدان ثقة عميل", pct: clampPct(30 + (1 - health.clientSatisfactionScore) * 40), tone: "negative" },
      ],
      financialImpact: { min: -5000, max: 0 },
      teamImpact: "الفريق +10",
      riskLevel: "medium",
    },
    {
      key: "nothing",
      label: "نصبر · الفريق يتحمل",
      managerOpinion: `متوسط معنويات ${ROLE_LABELS[role]}: ${Math.round(avgMoraleInRole * 100)}% · ${avgMoraleInRole < 0.5 ? "الاحتراق قادم قريباً." : "الفريق قد يتحمل فترة لكن ليس إلى الأبد."}`,
      probabilities: [
        { label: "معنويات الفريق تنهار", pct: clampPct(55 + (1 - avgMoraleInRole) * 35), tone: "negative" },
        { label: "زيادة الفشل في المهام", pct: clampPct(40 + (1 - avgMoraleInRole) * 35), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: "الفريق −15 · احتراق",
      riskLevel: "critical",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "overload",
    category: "operations",
    urgency: ratio > 4 ? "high" : "medium",
    title: `${ROLE_LABELS[role]} محمّلون زيادة`,
    description: `${pending} مهمة معلّقة · ${roleAgents.length} موظف · معنوياتهم ${Math.round(avgMoraleInRole * 100)}%`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 4 * MS_DAY,
    contextData: { role },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildLowMorale(state: SimState, avgMorale: number): Scenario {
  const health = computeCompanyHealth(state);
  const totalSalaries = state.agents.reduce(
    (s, a) => s + (a.active ? a.salaryMonthly : 0),
    0
  );
  const bonusCost = Math.round(totalSalaries * 0.1);
  const moralePct = avgMorale / 100;

  const choices: DecisionChoice[] = [
    {
      key: "give_bonus",
      label: "بونص جماعي · 10% من الراتب",
      managerOpinion: `${health.financialLabel === "ممتاز" || health.financialLabel === "مستقر" ? "الوضع المالي يتحمل هذي الخطوة." : "الوضع المالي ضيق — راجع الأولويات."} كلفته ${bonusCost.toLocaleString("en-US")} ر.ق.`,
      probabilities: [
        { label: "معنويات ترتفع بقوة", pct: clampPct(70 + (1 - moralePct) * 25), tone: "positive" },
        { label: "الفريق أكثر التزاماً", pct: clampPct(55 + (1 - health.teamLoyaltyScore) * 25), tone: "positive" },
        { label: "ضغط مالي", pct: 100, tone: "negative" },
      ],
      financialImpact: { min: -bonusCost, max: -bonusCost },
      teamImpact: "كل الفريق +18 · الولاء +10",
      riskLevel: health.financialLabel === "خطر" ? "high" : "low",
    },
    {
      key: "retreat",
      label: "يوم ترفيهي للفريق",
      managerOpinion: "يبني أجواء بتكلفة معتدلة. لا يعالج مشاكل أعمق.",
      probabilities: [
        { label: "معنويات ترتفع", pct: clampPct(60 + (1 - moralePct) * 25), tone: "positive" },
        { label: "روابط الفريق تتعزز", pct: clampPct(55 + (1 - health.teamLoyaltyScore) * 20), tone: "positive" },
        { label: "يوم إنتاجية ضائع", pct: 100, tone: "negative" },
      ],
      financialImpact: { min: -25000, max: -15000 },
      teamImpact: "كل الفريق +12 · ولاء +5",
      riskLevel: "low",
    },
    {
      key: "one_on_one",
      label: "جلسات فردية مع كل موظف",
      managerOpinion: "كشف دقيق للمشاكل. وقت ثقيل من المدير.",
      probabilities: [
        { label: "اكتشاف مشاكل مخفية", pct: clampPct(55 + (1 - moralePct) * 25), tone: "positive" },
        { label: "معنويات +معتدلة", pct: clampPct(50 + (1 - moralePct) * 15), tone: "positive" },
      ],
      financialImpact: { min: -2000, max: 0 },
      teamImpact: "كل الفريق +6",
      riskLevel: "low",
    },
    {
      key: "nothing",
      label: "تجاهل الموضوع",
      managerOpinion: `معنويات الفريق ${Math.round(moralePct * 100)}/100 · ${moralePct < 0.4 ? "الوضع أصلاً سيئ — التجاهل كارثة." : "قابل للسوء."}`,
      probabilities: [
        { label: "معنويات تستمر تنزل", pct: clampPct(60 + (1 - moralePct) * 25), tone: "negative" },
        { label: "موظفون يبحثون عن فرص", pct: clampPct(30 + (1 - health.teamLoyaltyScore) * 40), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: "كل الفريق −10",
      riskLevel: "high",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "low_morale",
    category: "team_wellbeing",
    urgency: moralePct < 0.3 ? "high" : "medium",
    title: "الأجواء مب زينة في الفريق",
    description: `متوسط المعنويات ${avgMorale.toFixed(0)}/100 · ولاء الفريق ${Math.round(health.teamLoyaltyScore * 100)}% · الوضع المالي: ${health.financialLabel}`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 5 * MS_DAY,
    contextData: {},
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildBurnoutWarning(state: SimState, agent: Agent): Scenario {
  const perf = computeAgentPerformance(state, agent);
  const health = computeCompanyHealth(state);

  const choices: DecisionChoice[] = [
    {
      key: "give_break",
      label: "إجازة 3 أيام مدفوعة",
      managerOpinion: `${perf.tag === "نجم" || perf.tag === "قوي" ? "استثمار في موظف ثمين." : "حل معقول."} معنوياته ${agent.morale} · ولاؤه ${agent.loyalty}.`,
      probabilities: [
        { label: "يرجع بمعنويات مرتفعة", pct: clampPct(65 + (1 - perf.moraleHealth) * 25), tone: "positive" },
        { label: "ولاؤه يزيد", pct: clampPct(55 + (1 - perf.loyaltyHealth) * 25), tone: "positive" },
        { label: "تأخير مؤقت على المهام", pct: 100, tone: "negative" },
      ],
      financialImpact: { min: -1000, max: 0 },
      teamImpact: `${agent.name} +40 معنويات · +10 ولاء`,
      riskLevel: "low",
    },
    {
      key: "reduce_workload",
      label: "تخفيف المهام ونقل بعضها لغيره",
      managerOpinion: `سعة الفريق ${Math.round(health.spareCapacityScore * 100)}% · ${health.spareCapacityScore > 0.3 ? "عندك موظفين فاضيين يستلمون." : "الفريق محمّل — النقل يضغط آخرين."}`,
      probabilities: [
        { label: "معنوياته ترتاح", pct: clampPct(60 + (1 - perf.moraleHealth) * 20), tone: "positive" },
        { label: "زميل ثاني يضغط", pct: clampPct(40 + (1 - health.spareCapacityScore) * 40), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: `${agent.name} +20 · زميل محدد −5`,
      riskLevel: health.spareCapacityScore < 0.25 ? "high" : "medium",
    },
    {
      key: "motivation_talk",
      label: "جلسة تحفيز شخصية",
      managerOpinion: `أداؤه العام ${perf.tag} — ${perf.overall > 0.6 ? "جلسة واحدة قد تكفي." : "الجلسة لوحدها مب حل — المشكلة هيكلية."}`,
      probabilities: [
        { label: "يتحمس مؤقتاً", pct: clampPct(45 + perf.overall * 25), tone: "positive" },
        { label: "يحترق بعد أسبوع", pct: clampPct(30 + (1 - perf.moraleHealth) * 35), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: `${agent.name} +10`,
      riskLevel: "medium",
    },
    {
      key: "nothing",
      label: "نصبر عليه",
      managerOpinion: "بيستقيل — الخيار الأسوأ.",
      probabilities: [
        { label: "يستقيل خلال أيام", pct: clampPct(55 + (1 - perf.loyaltyHealth) * 25 + (1 - perf.moraleHealth) * 15), tone: "negative" },
      ],
      financialImpact: { min: 0, max: agent.salaryMonthly },
      teamImpact: "انهيار معنوي",
      riskLevel: "critical",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "burnout_warning",
    category: "employee_risk",
    urgency: "high",
    title: `${agent.name} على وشك الاحتراق`,
    description: `معنوياته ${agent.morale}/100 · ولاؤه ${agent.loyalty} · أداؤه: ${perf.tag}`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 2 * MS_DAY,
    contextData: { agentId: agent.id },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildHighValueOpportunity(state: SimState): Scenario {
  const client = randomChoice(CLIENT_POOL);
  const budget = rollRange(180_000, 320_000);
  const health = computeCompanyHealth(state);
  const salesPerf = averagePerformanceByRole(state, "sales");

  const choices: DecisionChoice[] = [
    {
      key: "accept_aggressive",
      label: "قبول · تسليم سريع (نصف المدة العادية)",
      managerOpinion: `سعة الفريق ${Math.round(health.spareCapacityScore * 100)}% · ${
        health.spareCapacityScore < 0.2 ? "الفريق أصلاً مختنق — الاحتراق شبه مؤكد." : "إيراد ضخم، بس ضغط عالي."
      }`,
      probabilities: [
        { label: "إيراد ضخم", pct: 100, tone: "positive" },
        { label: "احتراق في الفريق", pct: clampPct(40 + (1 - health.spareCapacityScore) * 45 + (1 - health.teamMoraleScore) * 15), tone: "negative" },
        { label: "جودة تنزل", pct: clampPct(30 + (1 - health.teamMoraleScore) * 30), tone: "negative" },
      ],
      financialImpact: { min: budget * 0.3, max: budget * 0.5 },
      teamImpact: "الفريق التنفيذي −15 · ضغط شديد",
      riskLevel: health.spareCapacityScore < 0.2 ? "critical" : "high",
    },
    {
      key: "accept_premium",
      label: "قبول مع سعر premium +30% ومدة مرنة",
      managerOpinion: `أداء المبيعات ${Math.round(salesPerf * 100)}/100 · الوضع المالي ${health.financialLabel}. ${
        salesPerf > 0.6 ? "فريقك يقدر يقفل بسعر أعلى." : "احتمال يتفرغ العميل."
      }`,
      probabilities: [
        { label: "العميل يقبل السعر الأعلى", pct: clampPct(40 + salesPerf * 30 + health.financialScore * 10), tone: "positive" },
        { label: "إيراد وهامش قويين", pct: clampPct(70 + salesPerf * 20), tone: "positive" },
        { label: "العميل ينسحب", pct: clampPct(25 + (1 - salesPerf) * 30), tone: "negative" },
      ],
      financialImpact: { min: -budget * 0.1, max: budget * 0.6 },
      teamImpact: "المبيعات +15 · الفريق عادي",
      riskLevel: "medium",
    },
    {
      key: "negotiate_scope",
      label: "تقليل النطاق · نقبل بـ 80% من المبلغ",
      managerOpinion: "آمن. تحمي الفريق وتدخل صفقة معقولة.",
      probabilities: [
        { label: "العميل يقبل", pct: clampPct(55 + salesPerf * 25), tone: "positive" },
        { label: "العميل يمشي", pct: clampPct(20 + (1 - salesPerf) * 25), tone: "negative" },
      ],
      financialImpact: { min: 0, max: budget * 0.4 },
      teamImpact: "الفريق +5 · المبيعات عادي",
      riskLevel: "low",
    },
    {
      key: "reject",
      label: "رفض · الفرصة مب تناسبنا الحين",
      managerOpinion: `${health.spareCapacityScore < 0.2 ? "قرار حكيم — الفريق بحاجة راحة." : "تضحية كبيرة بإيراد."}`,
      probabilities: [
        { label: "حماية الفريق", pct: 100, tone: "positive" },
        { label: "المبيعات ينصدم", pct: clampPct(55 + (1 - salesPerf) * 20), tone: "negative" },
        { label: "سمعة متحفظة", pct: clampPct(25 + (1 - salesPerf) * 15), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: "المبيعات −12 · التنفيذي +8",
      riskLevel: "medium",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "high_value_opportunity",
    category: "sales_opportunity",
    urgency: "high",
    title: `صفقة كبيرة من ${client}`,
    description: `${budget.toLocaleString("en-US")} ر.ق · سعة ${Math.round(health.spareCapacityScore * 100)}% · مبيعات ${Math.round(salesPerf * 100)}%`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 2 * MS_DAY,
    contextData: { client },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildScopeChange(state: SimState, project: Project): Scenario {
  const extraWork = Math.round(project.budget * 0.25);
  const risk = computeProjectRisk(state, project);
  const health = computeCompanyHealth(state);
  const amPerf = averagePerformanceByRole(state, "account_manager");
  const clientSat = project.clientSatisfaction / 100;

  const choices: DecisionChoice[] = [
    {
      key: "accept_free",
      label: "نقبل الإضافة مجاناً · نرضي العميل",
      managerOpinion: `هامش المشروع ${
        project.budget > 0 ? Math.round((1 - project.actualCost / project.budget) * 100) : 0
      }% — ${project.actualCost / Math.max(project.budget, 1) < 0.5 ? "عندك مساحة تتحمل الخسارة." : "الهامش ضيق — القبول المجاني مؤلم."}`,
      probabilities: [
        { label: "العميل مبسوط جداً", pct: clampPct(75 + (1 - clientSat) * 15), tone: "positive" },
        { label: "خسارة من الربحية", pct: 100, tone: "negative" },
        { label: "الفريق يحس بعدم التقدير", pct: clampPct(40 + (1 - health.teamMoraleScore) * 25), tone: "negative" },
      ],
      financialImpact: { min: -extraWork, max: -extraWork * 0.7 },
      teamImpact: "فريق المشروع −8 · شغل إضافي مجاني",
      riskLevel: "medium",
    },
    {
      key: "charge_addon",
      label: "نحسب عليه إضافة +20% على الميزانية",
      managerOpinion: `مدير الحسابات (أداء ${Math.round(amPerf * 100)}/100) ${amPerf > 0.6 ? "يقدر يسوّقها بنعومة." : "ممكن ما يقنعه."}`,
      probabilities: [
        { label: "العميل يقبل الإضافة", pct: clampPct(45 + amPerf * 25 + clientSat * 15), tone: "positive" },
        { label: "إيراد وهامش أفضل", pct: 100, tone: "positive" },
        { label: "العميل ينزعج", pct: clampPct(20 + (1 - amPerf) * 25), tone: "negative" },
      ],
      financialImpact: { min: project.budget * 0.1, max: project.budget * 0.25 },
      teamImpact: "فريق المشروع عادي",
      riskLevel: "low",
    },
    {
      key: "compromise",
      label: "نقبل نصف النطاق + خصم 10% كبادرة حسن نية",
      managerOpinion: "وسط متوازن. الكل يحصل على شي.",
      probabilities: [
        { label: "العميل يرضى", pct: clampPct(65 + clientSat * 20), tone: "positive" },
        { label: "خسارة بسيطة من الهامش", pct: 100, tone: "negative" },
        { label: "الفريق يحس بالعدل", pct: clampPct(50 + health.teamMoraleScore * 20), tone: "positive" },
      ],
      financialImpact: { min: -project.budget * 0.12, max: -project.budget * 0.05 },
      teamImpact: "فريق المشروع −3",
      riskLevel: "low",
    },
    {
      key: "reject_change",
      label: "رفض · الاتفاق هو الاتفاق",
      managerOpinion: `${clientSat < 0.5 ? "العميل أصلاً متوتر — الرفض قد يكسر العقد." : "العلاقة قوية — الرفض معقول."}`,
      probabilities: [
        { label: "العميل يتراجع ويكمل", pct: clampPct(35 + amPerf * 20 + clientSat * 15), tone: "positive" },
        { label: "العميل يلغي المشروع", pct: clampPct(25 + (1 - clientSat) * 30 + risk.satisfactionRisk * 10), tone: "negative" },
        { label: "الفريق يحترم الموقف", pct: clampPct(60 + health.teamMoraleScore * 15), tone: "positive" },
      ],
      financialImpact: { min: -project.budget * 0.4, max: 0 },
      teamImpact: "فريق المشروع +6 · شعور بالتقدير",
      riskLevel: clientSat < 0.4 ? "high" : "medium",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "scope_change",
    category: "project_issue",
    urgency: "medium",
    title: `${project.client} يطلب توسيع نطاق "${project.title}"`,
    description: `إضافة تقدير ${extraWork.toLocaleString("en-US")} ر.ق · رضا العميل ${Math.round(clientSat * 100)}% · خطر ${risk.tag}`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 3 * MS_DAY,
    contextData: { projectId: project.id },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildProjectAtRiskOfLoss(state: SimState, project: Project): Scenario {
  const overshoot = Math.max(5000, Math.round(project.actualCost * 0.2));
  const risk = computeProjectRisk(state, project);
  const health = computeCompanyHealth(state);
  const amPerf = averagePerformanceByRole(state, "account_manager");
  const clientSat = project.clientSatisfaction / 100;

  const choices: DecisionChoice[] = [
    {
      key: "add_budget",
      label: "نحمل التكاليف الإضافية · نحمي الجودة",
      managerOpinion: `الوضع المالي ${health.financialLabel} · ${health.financialLabel === "خطر" ? "لا يتحمّل تمويل الخسارة." : "تقدر تمتصها بدون مشاكل."}`,
      probabilities: [
        { label: "جودة تسليم عالية", pct: clampPct(60 + risk.teamCapacityForProject * 25), tone: "positive" },
        { label: "خسارة من الهامش", pct: 100, tone: "negative" },
        { label: "رضا العميل يرتفع", pct: clampPct(50 + (1 - clientSat) * 25), tone: "positive" },
      ],
      financialImpact: { min: -overshoot * 1.2, max: -overshoot * 0.8 },
      teamImpact: "فريق المشروع +5",
      riskLevel: health.financialLabel === "خطر" ? "high" : "medium",
    },
    {
      key: "reduce_scope",
      label: "تقليل التسليمات · نسلّم اللي قدرنا",
      managerOpinion: `رضا العميل الحالي ${Math.round(clientSat * 100)}% — ${clientSat > 0.7 ? "العميل راضي، لا تضحي بهذا." : "العميل متذبذب أصلاً، قابلة للإنقاذ."}`,
      probabilities: [
        { label: "تقليل الخسارة", pct: clampPct(75 + (1 - risk.teamCapacityForProject) * 15), tone: "positive" },
        { label: "رضا العميل ينخفض", pct: clampPct(55 + clientSat * 20), tone: "negative" },
        { label: "العميل يطلب تعويض", pct: clampPct(25 + (1 - clientSat) * 25), tone: "negative" },
      ],
      financialImpact: { min: -overshoot * 0.3, max: 0 },
      teamImpact: "فريق المشروع −8",
      riskLevel: "medium",
    },
    {
      key: "renegotiate",
      label: "نفاوض العميل لرفع الميزانية +20%",
      managerOpinion: `أداء مدير الحسابات ${Math.round(amPerf * 100)}/100 · ${amPerf > 0.65 ? "عنده فرصة ينقذ الصفقة." : "المهمة صعبة — احتمال يخسر."}`,
      probabilities: [
        { label: "العميل يوافق", pct: clampPct(30 + amPerf * 30 + clientSat * 15), tone: "positive" },
        { label: "العميل يرفض ويطالب بالتسليم", pct: clampPct(30 + (1 - amPerf) * 20), tone: "negative" },
        { label: "العميل يلغي", pct: clampPct(10 + (1 - clientSat) * 25), tone: "negative" },
      ],
      financialImpact: { min: -project.budget * 0.5, max: project.budget * 0.2 },
      teamImpact: "مدير الحساب −5 · مجهود",
      riskLevel: clientSat < 0.4 ? "critical" : "high",
    },
    {
      key: "accept_loss",
      label: "نكمل ونقبل الخسارة · درس مدفوع",
      managerOpinion: "أحياناً أقل الخيارات مؤلماً. احفظ الدرس لتسعير أفضل.",
      probabilities: [
        { label: "نحافظ على العلاقة", pct: clampPct(70 + clientSat * 20), tone: "positive" },
        { label: "خسارة مؤكدة", pct: 100, tone: "negative" },
      ],
      financialImpact: { min: -overshoot, max: -overshoot },
      teamImpact: "لا يؤثر",
      riskLevel: "low",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "project_loss_risk",
    category: "project_issue",
    urgency: "high",
    title: `مشروع "${project.title}" متجه لخسارة`,
    description: `تقدير الخسارة ${overshoot.toLocaleString("en-US")} ر.ق · رضا ${Math.round(clientSat * 100)}% · خطر ${risk.tag}`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 2 * MS_DAY,
    contextData: { projectId: project.id },
    choices,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

export function buildUnderperformer(state: SimState, agent: Agent): Scenario {
  const perf = computeAgentPerformance(state, agent);
  const health = computeCompanyHealth(state);
  const deptLoad = computeDepartmentLoad(state, agent.role);

  const sameRole = state.agents.filter((a) => a.active && a.role === agent.role);
  const isSoleProvider = sameRole.length <= 1;
  const replacementDifficulty = isSoleProvider
    ? "عالية جداً"
    : sameRole.length <= 2
    ? "متوسطة"
    : "منخفضة";

  const activeProjects = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  );
  const todoTasks = activeProjects
    .flatMap((p) => p.tasks)
    .filter((t) => t.assigneeId === agent.id && t.status === "todo").length;
  const inProgressTasks = activeProjects
    .flatMap((p) => p.tasks)
    .filter((t) => t.assigneeId === agent.id && t.status === "in_progress").length;

  const total = agent.stats.tasksCompleted + agent.stats.tasksFailed;
  const successRate = total > 0 ? Math.round((agent.stats.tasksCompleted / total) * 100) : 0;
  const failRate = 100 - successRate;

  const archetypeNote: Record<string, string> = {
    lazy: "يسوّف كثير · استراحات قهوة طويلة",
    inconsistent: "مزاجي · الجودة تتقلب",
    burnout_prone: "قابل للاحتراق · يحتاج دعم مستمر",
    rookie: "مبتدئ · يحتاج وقت للتعلم",
    perfectionist: "يبطّئ لأجل التفاصيل الزايدة",
    efficient: "الأداء الأخير غير طبيعي بالنسبة له",
  };
  const archetypeText = archetypeNote[agent.archetype] ?? "ملاحظات مختلطة";

  const severanceCost = Math.round(agent.salaryMonthly * 1.5);

  const reviewBullets: string[] = [
    `الدور: ${ROLE_LABELS[agent.role]} · المستوى: ${agent.seniority ?? "mid"}`,
    `الراتب: ${agent.salaryMonthly.toLocaleString("en-US")} ر.ق/شهر`,
    `معدل النجاح: ${successRate}% (${agent.stats.tasksCompleted} نجح · ${agent.stats.tasksFailed} فشل${agent.stats.tasksReworked > 0 ? ` · ${agent.stats.tasksReworked} أعيد تصنيعه` : ""})`,
    `المعنويات: ${agent.morale}/100 · الولاء: ${agent.loyalty}/100`,
    `الصفة السلوكية: ${archetypeText}`,
    `تأثيره على القسم: backlog ${deptLoad.backlogWeeks.toFixed(1)} أسبوع${deptLoad.severity !== "healthy" ? ` · ${deptLoad.severity === "critical" ? "مختنق" : deptLoad.severity === "overloaded" ? "محمّل" : "مشغول"}` : ""}`,
    `الحمل الحالي: ${inProgressTasks} قيد التنفيذ · ${todoTasks} معلّقة`,
    `صعوبة الاستبدال: ${replacementDifficulty} (${sameRole.length} في نفس الدور)`,
    `تكلفة الإنهاء: ${severanceCost.toLocaleString("en-US")} ر.ق تعويض`,
    `ملاحظات: ${
      agent.onReview
        ? "⚠ سبق وُضع تحت المراقبة"
        : agent.morale < 30
        ? "معنوياته منخفضة جداً"
        : "ما زال ضمن الفريق"
    }`,
  ];

  const choices: DecisionChoice[] = [
    {
      key: "warn",
      label: "تحذير رسمي",
      managerOpinion: `خطوة لطيفة · ${
        perf.overall < 0.3
          ? "لكن غالباً ما يكفي لمشكلة بهذي الحدة."
          : "ممكن يفعل الفرق مع شخص بعد يبغى يتحسن."
      }`,
      probabilities: [
        { label: "يتحسّن الأداء", pct: clampPct(25 + perf.loyaltyHealth * 20), tone: "positive" },
        { label: "معنوياته تنخفض من الضغط", pct: clampPct(45 + (1 - perf.loyaltyHealth) * 20), tone: "negative" },
        { label: "الفريق يشوف إجراء", pct: 65, tone: "positive" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: `${agent.name} −5 · الفريق +3 (عدالة)`,
      riskLevel: "low",
    },
    {
      key: "performance_review",
      label: "خطة تحسين أداء (30 يوم)",
      managerOpinion: `أكثر الخيارات عدالة · يعطيه فرصة، وفي المقابل يوثّق القرار لو احتجت إنهاء لاحقاً.`,
      probabilities: [
        { label: "أداؤه يرتفع بشكل ملموس", pct: clampPct(38 + perf.loyaltyHealth * 15), tone: "positive" },
        { label: "لا تغيير خلال الفترة", pct: 35, tone: "negative" },
        { label: "يستقيل من الضغط", pct: clampPct(15 + (1 - perf.loyaltyHealth) * 20), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: `${agent.name} −10 · الفريق +5`,
      riskLevel: "low",
    },
    {
      key: "reduce_responsibilities",
      label: "تقليل المسؤوليات",
      managerOpinion: `يقلل الضرر لكن ما يحل المشكلة · الآخرون يتحمّلون حمله.`,
      probabilities: [
        { label: "ضغط أقل عليه", pct: 80, tone: "positive" },
        { label: "الآخرون يتحمّلون حمل إضافي", pct: 90, tone: "negative" },
        { label: "الفريق يشعر بعدم العدالة", pct: clampPct(45 + (1 - health.teamMoraleScore) * 20), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: `${agent.name} +5 · بقية القسم −6`,
      riskLevel: "medium",
    },
    {
      key: "training",
      label: "تدريب / mentoring",
      managerOpinion: `استثمار · ${
        agent.archetype === "rookie"
          ? "منطقي جداً لمبتدئ."
          : "عادة ما ينفع بعد سنوات من نفس المشاكل."
      }`,
      probabilities: [
        { label: "الأداء يتحسن", pct: clampPct(30 + (agent.archetype === "rookie" ? 30 : 10)), tone: "positive" },
        { label: "تكلفة تدريب", pct: 100, tone: "negative" },
        { label: "بدون تحسن ملموس", pct: clampPct(agent.archetype === "rookie" ? 30 : 55), tone: "negative" },
      ],
      financialImpact: { min: -9000, max: -5000 },
      teamImpact: `${agent.name} +10 · يحس بالتقدير`,
      riskLevel: "low",
    },
    {
      key: "reassign_role",
      label: "تنزيل مستوى / دور أقل تأثيراً",
      managerOpinion: `مقعد احتياطي · يحافظ على توظيفه بس ينقذ القسم من تأثيره.`,
      probabilities: [
        { label: "قسمه الأصلي يرتاح", pct: 75, tone: "positive" },
        { label: "معنوياته تنهار من الإحساس بالتنزيل", pct: clampPct(55 + (1 - perf.moraleHealth) * 25), tone: "negative" },
        { label: "يستقيل خلال أسابيع", pct: clampPct(25 + (1 - perf.loyaltyHealth) * 25), tone: "negative" },
      ],
      financialImpact: { min: -agent.salaryMonthly * 0.1, max: 0 },
      teamImpact: `القسم الأصلي +10 · ${agent.name} −20`,
      riskLevel: "medium",
    },
    {
      key: "monitor",
      label: "نستمر معاه مع المراقبة",
      managerOpinion: `تأجيل المشكلة يخليها تكبر · الفريق القوي يشعر بعدم العدالة وقد يستقيل أحد القوية.`,
      probabilities: [
        { label: "الفشل يستمر", pct: clampPct(60 + (1 - perf.moraleHealth) * 25), tone: "negative" },
        { label: "الفريق يحس بعدم العدالة", pct: clampPct(50 + (1 - health.teamMoraleScore) * 25), tone: "negative" },
        { label: "موظف قوي يستقيل من الإحباط", pct: clampPct(25 + (perf.overall < 0.3 ? 15 : 0)), tone: "negative" },
      ],
      financialImpact: { min: 0, max: 0 },
      teamImpact: `بقية الفريق −8 · عدم عدالة`,
      riskLevel: "high",
    },
    {
      key: "terminate",
      label: "إنهاء العقد",
      managerOpinion: isSoleProvider
        ? `⚠ هو الوحيد في دوره — بتدخل في اختناق فوري بدون بديل.`
        : `قرار حاسم · يفك عقدة ${deptLoad.roleLabel} من موظف ضعيف. ${
            deptLoad.severity === "critical" || deptLoad.severity === "overloaded"
              ? "لكن القسم محمّل — السعة بتنخفض مؤقتاً."
              : "السعة موجودة لتغطية فراغه."
          }`,
      probabilities: [
        { label: "إنتاجية القسم ترتفع", pct: clampPct(65 + (1 - perf.overall) * 20), tone: "positive" },
        { label: "معنويات الفريق ترتفع", pct: clampPct(35 + (perf.overall < 0.4 ? 25 : 0)), tone: "positive" },
        { label: "نقص سعة مؤقت", pct: clampPct(60 + perf.criticalityInRole * 30), tone: "negative" },
        { label: "خسارة تعويض إنهاء", pct: 100, tone: "negative" },
      ],
      financialImpact: { min: -severanceCost, max: -severanceCost },
      teamImpact: `بقية القسم −6 مؤقت · +10 طويل المدى`,
      riskLevel: isSoleProvider ? "high" : "medium",
    },
    {
      key: "terminate_replace",
      label: "إنهاء + فتح باب التوظيف فوراً",
      managerOpinion: `القرار الاستراتيجي · خسارة قصيرة مقابل فريق أقوى على المدى الطويل. البديل junior بيحتاج onboarding.`,
      probabilities: [
        { label: "القسم يتحسن بعد onboarding البديل", pct: clampPct(60 + (1 - perf.overall) * 15), tone: "positive" },
        { label: "فترة انتقال 1-2 شهر", pct: 100, tone: "neutral" },
        { label: "تكلفة تعويض + توظيف", pct: 100, tone: "negative" },
        { label: "backlog يتفاقم مؤقتاً", pct: clampPct(45 + perf.criticalityInRole * 30), tone: "negative" },
      ],
      financialImpact: {
        min: -severanceCost - agent.salaryMonthly * 0.4,
        max: -severanceCost - agent.salaryMonthly * 0.3,
      },
      teamImpact: `القسم −8 مؤقت · +15 بعد التأهيل`,
      riskLevel: isSoleProvider ? "medium" : "medium",
    },
  ];

  const scenario: Scenario = {
    id: uid("scn"),
    templateId: "underperformer",
    category: "employee_risk",
    urgency: perf.overall < 0.3 ? "high" : "medium",
    title: `${agent.name} · أداء ضعيف مستمر`,
    description: `${archetypeText}. ${failRate}% فشل من إجمالي ${total} مهمة · يحتاج قرار.`,
    spawnedAt: state.simTime,
    expiresAt: state.simTime + 5 * MS_DAY,
    contextData: { agentId: agent.id },
    choices,
    reviewBullets,
  };
  scenario.recommendedChoiceKey = pickRecommended(choices);
  return scenario;
}

// ──────────────────────────────────────────────
// APPLY DECISION
// ──────────────────────────────────────────────

function adjustMorale(agent: Agent, delta: number) {
  agent.morale = Math.max(0, Math.min(100, agent.morale + delta));
}

function adjustLoyalty(agent: Agent, delta: number) {
  agent.loyalty = Math.max(0, Math.min(100, agent.loyalty + delta));
}

function moneyDeltaFromRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function applyExternalOffer(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const agent = findAgent(state, scenario.contextData.agentId);
  if (!agent) return 0;
  let financial = 0;
  switch (choiceKey) {
    case "counter_offer": {
      const bump = Math.round(agent.salaryMonthly * 0.3);
      if (outcomes[0]?.happened) {
        agent.salaryMonthly += bump;
        adjustMorale(agent, 20);
        adjustLoyalty(agent, 15);
        financial = -bump;
      } else {
        agent.active = false;
        state.counters.agentsQuit++;
        financial = 0;
      }
      if (outcomes[2]?.happened) adjustMoraleAll(state, -5, agent.id);
      break;
    }
    case "promote": {
      const bump = Math.round(agent.salaryMonthly * 0.15);
      if (outcomes[0]?.happened) {
        agent.salaryMonthly += bump;
        adjustMorale(agent, 30);
        adjustLoyalty(agent, 25);
        agent.traits.speed = Math.min(95, agent.traits.speed + 3);
        agent.traits.accuracy = Math.min(95, agent.traits.accuracy + 3);
        financial = -bump;
      } else {
        agent.active = false;
        state.counters.agentsQuit++;
      }
      if (outcomes[2]?.happened) {
        // budget pressure — no direct cost, just log
      }
      break;
    }
    case "let_go": {
      agent.active = false;
      state.counters.agentsQuit++;
      financial = agent.salaryMonthly;
      if (outcomes[2]?.happened) adjustMoraleAll(state, -8, agent.id);
      break;
    }
    case "ignore": {
      if (outcomes[0]?.happened) {
        agent.active = false;
        state.counters.agentsQuit++;
      } else {
        adjustMorale(agent, -30);
        adjustLoyalty(agent, -20);
      }
      break;
    }
  }
  return financial;
}

function applyDelayedProject(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const project = findProject(state, scenario.contextData.projectId);
  if (!project) return 0;
  let financial = 0;
  switch (choiceKey) {
    case "offer_discount": {
      const discount = Math.round(project.budget * 0.1);
      project.budget -= discount;
      project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 15);
      financial = -discount;
      break;
    }
    case "add_resources": {
      const cost = moneyDeltaFromRange(3000, 8000);
      postTransaction({ kind: "overhead", amount: -cost, projectId: project.id, note: "موارد إضافية" });
      financial = -cost;
      for (const task of project.tasks) {
        if (task.status === "in_progress") task.remainingHours = Math.max(1, Math.round(task.remainingHours * 0.7));
      }
      break;
    }
    case "communicate_delay": {
      if (outcomes[1]?.happened) {
        const comp = 5000;
        financial = -comp;
        project.budget -= comp;
      }
      if (outcomes[2]?.happened) project.clientSatisfaction = Math.max(0, project.clientSatisfaction - 15);
      break;
    }
    case "escalate": {
      const am = state.agents.find((a) => a.role === "account_manager" && a.active);
      if (am) adjustMorale(am, -5);
      if (outcomes[0]?.happened) project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 10);
      break;
    }
  }
  return financial;
}

function applyUnhappyClient(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const project = findProject(state, scenario.contextData.projectId);
  if (!project) return 0;
  let financial = 0;
  switch (choiceKey) {
    case "apology_meeting": {
      project.clientRevisions = Math.max(0, project.clientRevisions - 2);
      project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 15);
      financial = -2000;
      postTransaction({ kind: "overhead", amount: -2000, projectId: project.id, note: "اجتماع اعتذار" });
      break;
    }
    case "discount": {
      const discount = Math.round(project.budget * 0.15);
      project.budget -= discount;
      project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 25);
      financial = -discount;
      break;
    }
    case "stand_firm": {
      if (outcomes[0]?.happened) {
        project.status = "cancelled";
        project.completedAt = state.simTime;
        financial = -Math.round(project.actualCost);
      } else {
        project.clientSatisfaction = Math.max(0, project.clientSatisfaction - 10);
      }
      adjustMoraleAll(state, 3);
      break;
    }
  }
  return financial;
}

function applySalesLead(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  let financial = 0;
  switch (choiceKey) {
    case "accept": {
      const p = createProject(state.simTime);
      p.client = scenario.contextData.client ?? p.client;
      p.title = p.title.replace(/—.+$/, `— ${p.client}`);
      state.projects.push(p);
      financial = 0;
      const sales = state.agents.find((a) => a.role === "sales" && a.active);
      if (sales) adjustMorale(sales, 8);
      break;
    }
    case "negotiate_higher": {
      if (outcomes[0]?.happened) {
        const p = createProject(state.simTime);
        p.client = scenario.contextData.client ?? p.client;
        p.budget = Math.round(p.budget * 1.2);
        state.projects.push(p);
      }
      const sales = state.agents.find((a) => a.role === "sales" && a.active);
      if (sales) adjustMorale(sales, outcomes[0]?.happened ? 10 : -10);
      break;
    }
    case "reject": {
      adjustMoraleAll(state, 3);
      const sales = state.agents.find((a) => a.role === "sales" && a.active);
      if (sales) adjustMorale(sales, -8);
      break;
    }
  }
  return financial;
}

function hireRookie(state: SimState, role: Role, label: string): number {
  const names = ["سلطان", "مريم", "عائشة", "يوسف", "بدر", "شيخة", "علي", "هيا", "راشد", "موزة"];
  const lastNames = ["السليطي", "المهندي", "الهاجري", "النعيمي", "المناعي", "الكبيسي", "الفضالة", "الجفيري"];
  const name = `${randomChoice(names)} ${randomChoice(lastNames)}`;
  const salary = BASE_SALARY_BY_ROLE[role] * 0.75;
  const hiringCost = salary * 0.5;
  state.agents.push({
    id: uid("agt"),
    name,
    role,
    archetype: "rookie",
    traits: { ...ARCHETYPE_TRAITS.rookie },
    morale: 85,
    loyalty: 70,
    salaryMonthly: Math.round(salary),
    status: "idle",
    currentTaskId: null,
    stats: { tasksCompleted: 0, tasksFailed: 0, tasksReworked: 0 },
    hiredAt: state.simTime,
    active: true,
    absentUntil: null,
    xpTasks: 0,
    onReview: false,
    seniority: "junior",
    productivity: 0.4,
    onboardingProgress: 0,
  });
  postTransaction({ kind: "hiring_cost", amount: -Math.round(hiringCost), note: `تكلفة توظيف ${label}` });
  logActivity(
    "المدير",
    `تم توظيف ${name} (${ROLE_LABELS[role]}) كـ junior · يبدي بـ 40% إنتاجية · 60 يوم تأهيل`,
    "decision"
  );
  return -Math.round(hiringCost);
}

function applyOverload(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const role = scenario.contextData.role as Role;
  let financial = 0;
  switch (choiceKey) {
    case "hire_junior": {
      if (!state.settings.hiringPaused) {
        financial = hireRookie(state, role, ROLE_LABELS[role]);
      } else {
        logActivity("المدير", "محاولة توظيف بس التوظيف موقوف · ألغي القرار", "warning");
      }
      break;
    }
    case "outsource": {
      const cost = moneyDeltaFromRange(8000, 18000);
      postTransaction({ kind: "overhead", amount: -cost, note: `freelancer ${ROLE_LABELS[role]}` });
      financial = -cost;
      for (const project of state.projects) {
        if (project.status === "active" || project.status === "delayed") {
          for (const task of project.tasks) {
            if (task.requiredRole === role && task.status === "todo") {
              task.status = "done";
              break;
            }
          }
        }
      }
      break;
    }
    case "postpone_projects": {
      const low = state.projects.filter(
        (p) => (p.status === "active" || p.status === "delayed") && p.priority === "low"
      );
      for (const p of low) p.deadline += 5 * MS_DAY;
      if (outcomes[1]?.happened) {
        for (const p of low) p.clientSatisfaction = Math.max(0, p.clientSatisfaction - 15);
      }
      break;
    }
    case "nothing": {
      for (const agent of state.agents) {
        if (agent.role === role && agent.active) {
          adjustMorale(agent, -15);
          if (outcomes[1]?.happened) adjustMorale(agent, -5);
        }
      }
      break;
    }
  }
  return financial;
}

function applyLowMorale(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  let financial = 0;
  switch (choiceKey) {
    case "give_bonus": {
      const total = state.agents.reduce((s, a) => s + (a.active ? a.salaryMonthly : 0), 0);
      const cost = Math.round(total * 0.1);
      postTransaction({ kind: "bonus", amount: -cost, note: "بونص جماعي" });
      financial = -cost;
      adjustMoraleAll(state, 18);
      for (const a of state.agents) if (a.active) adjustLoyalty(a, 10);
      break;
    }
    case "retreat": {
      const cost = moneyDeltaFromRange(15000, 25000);
      postTransaction({ kind: "overhead", amount: -cost, note: "يوم ترفيهي" });
      financial = -cost;
      adjustMoraleAll(state, 12);
      for (const a of state.agents) if (a.active) adjustLoyalty(a, 5);
      break;
    }
    case "one_on_one": {
      const cost = 1500;
      postTransaction({ kind: "overhead", amount: -cost, note: "جلسات فردية" });
      financial = -cost;
      adjustMoraleAll(state, 6);
      break;
    }
    case "nothing": {
      adjustMoraleAll(state, -10);
      break;
    }
  }
  return financial;
}

function applyBurnoutWarning(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const agent = findAgent(state, scenario.contextData.agentId);
  if (!agent) return 0;
  switch (choiceKey) {
    case "give_break": {
      agent.status = "absent";
      agent.absentUntil = state.simTime + 3 * MS_DAY;
      adjustMorale(agent, 40);
      adjustLoyalty(agent, 10);
      break;
    }
    case "reduce_workload": {
      adjustMorale(agent, 20);
      if (agent.currentTaskId) {
        const task = state.projects.flatMap((p) => p.tasks).find((t) => t.id === agent.currentTaskId);
        if (task) {
          task.status = "todo";
          task.assigneeId = null;
        }
        agent.currentTaskId = null;
        agent.status = "idle";
      }
      break;
    }
    case "motivation_talk": {
      if (outcomes[0]?.happened) adjustMorale(agent, 15);
      if (outcomes[1]?.happened) adjustMorale(agent, -20);
      break;
    }
    case "nothing": {
      if (outcomes[0]?.happened) {
        agent.active = false;
        state.counters.agentsQuit++;
      }
      break;
    }
  }
  return 0;
}

function applyHighValueOpportunity(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  let financial = 0;
  const client = (scenario.contextData.client as string) ?? randomChoice(CLIENT_POOL);

  switch (choiceKey) {
    case "accept_aggressive": {
      const p = createProject(state.simTime);
      p.client = client;
      p.budget = Math.round(p.budget * 2.5);
      p.costEstimate = Math.round(p.budget * 0.55);
      p.deadline = state.simTime + Math.round((p.deadline - state.simTime) * 0.5);
      p.priority = "urgent";
      state.projects.push(p);
      adjustMoraleAll(state, -10);
      if (outcomes[1]?.happened) {
        const burnt = state.agents.filter((a) => a.active);
        for (const a of burnt) adjustMorale(a, -5);
      }
      break;
    }
    case "accept_premium": {
      if (outcomes[0]?.happened) {
        const p = createProject(state.simTime);
        p.client = client;
        p.budget = Math.round(p.budget * 1.3);
        p.costEstimate = Math.round(p.budget * 0.5);
        state.projects.push(p);
        const sales = state.agents.find((a) => a.role === "sales" && a.active);
        if (sales) adjustMorale(sales, 15);
      } else {
        const sales = state.agents.find((a) => a.role === "sales" && a.active);
        if (sales) adjustMorale(sales, -8);
      }
      break;
    }
    case "negotiate_scope": {
      if (outcomes[0]?.happened) {
        const p = createProject(state.simTime);
        p.client = client;
        p.budget = Math.round(p.budget * 0.8);
        state.projects.push(p);
        adjustMoraleAll(state, 4);
      }
      break;
    }
    case "reject": {
      const sales = state.agents.find((a) => a.role === "sales" && a.active);
      if (sales) adjustMorale(sales, -12);
      const exec = state.agents.filter(
        (a) => a.active && a.role !== "sales"
      );
      for (const a of exec) adjustMorale(a, 8);
      break;
    }
  }
  return financial;
}

function applyScopeChange(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const project = findProject(state, scenario.contextData.projectId);
  if (!project) return 0;
  let financial = 0;

  switch (choiceKey) {
    case "accept_free": {
      project.scopeChanges++;
      project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 20);
      project.actualCost += Math.round(project.costEstimate * 0.25);
      project.tasks.push(
        {
          id: uid("tsk"),
          projectId: project.id,
          title: "عمل إضافي بطلب العميل",
          requiredRole: "designer",
          assigneeId: null,
          estimatedHours: Math.max(4, Math.round(project.tasks[0]?.estimatedHours ?? 6)),
          remainingHours: Math.max(4, Math.round(project.tasks[0]?.estimatedHours ?? 6)),
          status: "todo",
          reworkCount: 0,
          revisionCount: 0,
          hoursLogged: 0,
          addedLate: true,
        }
      );
      const projectTeam = state.agents.filter((a) => a.active);
      for (const a of projectTeam) adjustMorale(a, -4);
      financial = -Math.round(project.costEstimate * 0.25);
      break;
    }
    case "charge_addon": {
      if (outcomes[0]?.happened) {
        const uplift = Math.round(project.budget * 0.2);
        project.budget += uplift;
        project.actualCost += Math.round(uplift * 0.55);
        project.tasks.push({
          id: uid("tsk"),
          projectId: project.id,
          title: "عمل إضافي مدفوع",
          requiredRole: "designer",
          assigneeId: null,
          estimatedHours: 5,
          remainingHours: 5,
          status: "todo",
          reworkCount: 0,
          revisionCount: 0,
          hoursLogged: 0,
          addedLate: true,
        });
        financial = Math.round(uplift * 0.45);
      } else {
        project.clientSatisfaction = Math.max(0, project.clientSatisfaction - 10);
      }
      break;
    }
    case "compromise": {
      const discount = Math.round(project.budget * 0.1);
      project.budget -= discount;
      project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 10);
      financial = -discount;
      break;
    }
    case "reject_change": {
      if (outcomes[1]?.happened) {
        project.status = "cancelled";
        project.completedAt = state.simTime;
        financial = -Math.round(project.actualCost);
        postTransaction({
          kind: "refund",
          amount: -Math.round(project.actualCost * 0.4),
          projectId: project.id,
          note: `إلغاء "${project.title}"`,
        });
      } else {
        adjustMoraleAll(state, 4);
        project.clientSatisfaction = Math.max(0, project.clientSatisfaction - 8);
      }
      break;
    }
  }
  return financial;
}

function applyProjectAtRiskOfLoss(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const project = findProject(state, scenario.contextData.projectId);
  if (!project) return 0;
  let financial = 0;
  const overshoot = Math.max(5000, Math.round(project.actualCost * 0.2));

  switch (choiceKey) {
    case "add_budget": {
      project.actualCost += overshoot;
      postTransaction({
        kind: "overhead",
        amount: -overshoot,
        projectId: project.id,
        note: `تحمّل تجاوز: ${project.title}`,
      });
      project.clientSatisfaction = Math.min(100, project.clientSatisfaction + 10);
      financial = -overshoot;
      break;
    }
    case "reduce_scope": {
      const pending = project.tasks.filter((t) => t.status === "todo");
      const toCut = Math.ceil(pending.length / 3);
      for (let i = 0; i < toCut && i < pending.length; i++) {
        pending[i].status = "done";
      }
      project.clientSatisfaction = Math.max(0, project.clientSatisfaction - 20);
      if (outcomes[2]?.happened) {
        const comp = Math.round(project.budget * 0.1);
        project.budget -= comp;
        financial = -comp;
      }
      break;
    }
    case "renegotiate": {
      if (outcomes[0]?.happened) {
        const bump = Math.round(project.budget * 0.2);
        project.budget += bump;
        financial = bump;
        const am = state.agents.find((a) => a.role === "account_manager" && a.active);
        if (am) adjustMorale(am, 10);
      } else if (outcomes[2]?.happened) {
        project.status = "cancelled";
        project.completedAt = state.simTime;
        financial = -Math.round(project.actualCost);
      } else {
        project.clientSatisfaction = Math.max(0, project.clientSatisfaction - 10);
      }
      break;
    }
    case "accept_loss": {
      project.actualCost += overshoot;
      postTransaction({
        kind: "refund",
        amount: -overshoot,
        projectId: project.id,
        note: `تعلم من الخسارة: ${project.title}`,
      });
      financial = -overshoot;
      break;
    }
  }
  return financial;
}

function applyUnderperformer(
  state: SimState,
  scenario: Scenario,
  choiceKey: string,
  outcomes: { label: string; happened: boolean }[]
): number {
  const agent = findAgent(state, scenario.contextData.agentId);
  if (!agent) return 0;

  let financial = 0;
  const peersInRole = state.agents.filter(
    (a) => a.active && a.role === agent.role && a.id !== agent.id
  );
  const severance = Math.round(agent.salaryMonthly * 1.5);

  switch (choiceKey) {
    case "warn": {
      adjustMorale(agent, -5);
      if (outcomes[0]?.happened) {
        agent.traits.reliability = Math.min(95, agent.traits.reliability + 5);
        agent.traits.accuracy = Math.min(95, agent.traits.accuracy + 3);
      }
      if (outcomes[1]?.happened) adjustMorale(agent, -8);
      if (outcomes[2]?.happened) {
        for (const p of peersInRole) adjustMorale(p, 3);
      }
      break;
    }
    case "performance_review": {
      agent.onReview = true;
      adjustMorale(agent, -10);
      if (outcomes[0]?.happened) {
        agent.traits.accuracy = Math.min(92, agent.traits.accuracy + 7);
        agent.traits.reliability = Math.min(92, agent.traits.reliability + 7);
        agent.onReview = false;
      } else if (outcomes[2]?.happened) {
        // Quits under pressure
        agent.active = false;
        agent.status = "idle";
        agent.currentTaskId = null;
        state.counters.agentsQuit++;
        const partialSeverance = Math.round(agent.salaryMonthly * 0.5);
        postTransaction({
          kind: "severance",
          amount: -partialSeverance,
          agentId: agent.id,
          note: `تعويض استقالة ${agent.name}`,
        });
        financial = -partialSeverance;
      }
      break;
    }
    case "reduce_responsibilities": {
      adjustMorale(agent, 3);
      for (const p of peersInRole) adjustMorale(p, -6);
      // Unassign agent's todo tasks — redistribute
      for (const project of state.projects) {
        for (const task of project.tasks) {
          if (task.assigneeId === agent.id && task.status === "todo") {
            task.assigneeId = null;
          }
        }
      }
      if (agent.currentTaskId) {
        const currentTask = state.projects
          .flatMap((p) => p.tasks)
          .find((t) => t.id === agent.currentTaskId);
        if (currentTask) {
          currentTask.status = "todo";
          currentTask.assigneeId = null;
        }
        agent.currentTaskId = null;
        agent.status = "idle";
      }
      break;
    }
    case "training": {
      const cost = moneyDeltaFromRange(5000, 9000);
      postTransaction({
        kind: "overhead",
        amount: -cost,
        agentId: agent.id,
        note: `تدريب ${agent.name}`,
      });
      financial = -cost;
      adjustMorale(agent, 10);
      if (outcomes[0]?.happened) {
        agent.traits.accuracy = Math.min(90, agent.traits.accuracy + 6);
        agent.traits.speed = Math.min(90, agent.traits.speed + 4);
        agent.traits.reliability = Math.min(90, agent.traits.reliability + 4);
      }
      break;
    }
    case "reassign_role": {
      const current = agent.seniority ?? "mid";
      if (current === "senior") agent.seniority = "mid";
      else if (current === "mid") agent.seniority = "junior";
      // Pay cut reflects the reassignment
      agent.salaryMonthly = Math.round(agent.salaryMonthly * 0.9);
      adjustMorale(agent, -20);
      for (const p of peersInRole) adjustMorale(p, 10);
      // Unassign current work — they're stepping down
      if (agent.currentTaskId) {
        const t = state.projects
          .flatMap((p) => p.tasks)
          .find((x) => x.id === agent.currentTaskId);
        if (t) {
          t.status = "todo";
          t.assigneeId = null;
        }
        agent.currentTaskId = null;
        agent.status = "idle";
      }
      if (outcomes[2]?.happened) {
        agent.active = false;
        state.counters.agentsQuit++;
      }
      break;
    }
    case "monitor": {
      for (const p of peersInRole) adjustMorale(p, -5);
      // A strong peer may quit from the unfairness
      if (outcomes[2]?.happened) {
        const strongPeers = peersInRole.filter(
          (p) => computeAgentPerformance(state, p).overall > 0.65
        );
        if (strongPeers.length > 0) {
          const victim = randomChoice(strongPeers);
          victim.active = false;
          victim.status = "idle";
          victim.currentTaskId = null;
          state.counters.agentsQuit++;
          logActivity(
            "النظام",
            `${victim.name} استقال · ما تحمّل استمرار ضعف الفريق`,
            "error"
          );
        }
      }
      break;
    }
    case "terminate": {
      agent.active = false;
      agent.status = "idle";
      // Release their current task so others can pick it up
      if (agent.currentTaskId) {
        const t = state.projects
          .flatMap((p) => p.tasks)
          .find((x) => x.id === agent.currentTaskId);
        if (t) {
          t.status = "todo";
          t.assigneeId = null;
        }
        agent.currentTaskId = null;
      }
      state.counters.agentsQuit++;
      postTransaction({
        kind: "severance",
        amount: -severance,
        agentId: agent.id,
        note: `تعويض إنهاء: ${agent.name}`,
      });
      financial = -severance;
      // Team reaction — positive if team knew he was weak
      if (outcomes[1]?.happened) {
        for (const p of peersInRole) adjustMorale(p, 8);
      } else {
        for (const p of peersInRole) adjustMorale(p, -3);
      }
      break;
    }
    case "terminate_replace": {
      // Terminate
      agent.active = false;
      agent.status = "idle";
      if (agent.currentTaskId) {
        const t = state.projects
          .flatMap((p) => p.tasks)
          .find((x) => x.id === agent.currentTaskId);
        if (t) {
          t.status = "todo";
          t.assigneeId = null;
        }
        agent.currentTaskId = null;
      }
      state.counters.agentsQuit++;
      postTransaction({
        kind: "severance",
        amount: -severance,
        agentId: agent.id,
        note: `تعويض إنهاء: ${agent.name}`,
      });
      // Hire replacement junior of same role
      const hireFinancial = hireRookie(state, agent.role, `بديل ${agent.name}`);
      financial = -severance + hireFinancial; // hireFinancial already negative
      // Net team: short-term uncertain, long-term positive
      if (outcomes[0]?.happened) {
        for (const p of peersInRole) adjustMorale(p, 5);
      }
      break;
    }
  }

  return financial;
}

// Dispatcher

export function applyDecision(
  state: SimState,
  scenarioId: string,
  choiceKey: string
): DecisionRecord | null {
  const scenario = state.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;
  const choice = scenario.choices.find((c) => c.key === choiceKey);
  if (!choice) return null;

  const actualOutcomes = choice.probabilities.map((p) => ({
    label: p.label,
    happened: roll(p.pct),
    tone: p.tone,
  }));

  let financial = 0;
  switch (scenario.templateId) {
    case "external_offer":
      financial = applyExternalOffer(state, scenario, choiceKey, actualOutcomes);
      break;
    case "project_delayed":
      financial = applyDelayedProject(state, scenario, choiceKey, actualOutcomes);
      break;
    case "unhappy_client":
      financial = applyUnhappyClient(state, scenario, choiceKey, actualOutcomes);
      break;
    case "sales_lead":
      financial = applySalesLead(state, scenario, choiceKey, actualOutcomes);
      break;
    case "overload":
      financial = applyOverload(state, scenario, choiceKey, actualOutcomes);
      break;
    case "low_morale":
      financial = applyLowMorale(state, scenario, choiceKey, actualOutcomes);
      break;
    case "burnout_warning":
      financial = applyBurnoutWarning(state, scenario, choiceKey, actualOutcomes);
      break;
    case "high_value_opportunity":
      financial = applyHighValueOpportunity(state, scenario, choiceKey, actualOutcomes);
      break;
    case "scope_change":
      financial = applyScopeChange(state, scenario, choiceKey, actualOutcomes);
      break;
    case "project_loss_risk":
      financial = applyProjectAtRiskOfLoss(state, scenario, choiceKey, actualOutcomes);
      break;
    case "underperformer":
      financial = applyUnderperformer(state, scenario, choiceKey, actualOutcomes);
      break;
  }

  const happenedOutcomes = actualOutcomes.filter((o) => o.happened);
  const positiveHappened = happenedOutcomes.filter((o) => o.tone === "positive").length;
  const negativeHappened = happenedOutcomes.filter((o) => o.tone === "negative").length;
  const summary =
    positiveHappened > negativeHappened
      ? "نتيجة إيجابية بشكل عام"
      : negativeHappened > positiveHappened
      ? "نتيجة سلبية بشكل عام"
      : "نتيجة مختلطة";

  state.scenarios = state.scenarios.filter((s) => s.id !== scenario.id);

  const record: DecisionRecord = {
    id: uid("dec"),
    at: state.simTime,
    scenarioTitle: scenario.title,
    scenarioCategory: scenario.category,
    chosenLabel: choice.label,
    expectedOutcomes: choice.probabilities,
    actualOutcomes,
    financialImpact: financial,
    summary,
  };
  state.decisionLog.unshift(record);
  if (state.decisionLog.length > 100) state.decisionLog.length = 100;
  state.counters.decisionsMade++;

  logActivity(
    "المدير",
    `قرار: ${choice.label} · ${summary}${financial !== 0 ? " · " + (financial > 0 ? "+" : "") + financial.toLocaleString("en-US") + " ر.ق" : ""}`,
    "decision"
  );

  return record;
}

// ──────────────────────────────────────────────
// SCENARIO SPAWNER
// ──────────────────────────────────────────────

function hasPendingOfTemplate(state: SimState, templateId: string, contextId?: string): boolean {
  return state.scenarios.some(
    (s) =>
      s.templateId === templateId &&
      (!contextId ||
        s.contextData.agentId === contextId ||
        s.contextData.projectId === contextId ||
        s.contextData.role === contextId)
  );
}

export function maybeSpawnScenario(state: SimState) {
  if (!state.settings.autoScenarios) return;
  if (state.scenarios.length >= 5) return;

  const activeAgents = state.agents.filter((a) => a.active);
  if (activeAgents.length === 0) return;

  // External offer: agent with high XP, moderate morale, not already handled
  const offerCandidates = activeAgents.filter(
    (a) => a.stats.tasksCompleted > 10 && a.morale < 85 && a.morale > 35
  );
  if (offerCandidates.length > 0 && Math.random() < 0.002) {
    const agent = randomChoice(offerCandidates);
    if (!hasPendingOfTemplate(state, "external_offer", agent.id)) {
      state.scenarios.push(buildExternalOffer(state, agent));
      logActivity("فرصة خارجية", `${agent.name} استلم عرض · يحتاج قرار`, "warning");
      return;
    }
  }

  // Delayed project
  const delayed = state.projects.find(
    (p) => p.status === "delayed" && !hasPendingOfTemplate(state, "project_delayed", p.id)
  );
  if (delayed && Math.random() < 0.008) {
    state.scenarios.push(buildDelayedProject(state, delayed));
    logActivity("مشكلة", `مشروع "${delayed.title}" يحتاج قرار`, "warning");
    return;
  }

  // Unhappy client
  const unhappy = state.projects.find(
    (p) =>
      (p.status === "active" || p.status === "delayed") &&
      p.clientRevisions >= 3 &&
      !hasPendingOfTemplate(state, "unhappy_client", p.id)
  );
  if (unhappy && Math.random() < 0.01) {
    state.scenarios.push(buildUnhappyClient(state, unhappy));
    logActivity("عميل غاضب", `${unhappy.client} يحتاج قرار`, "warning");
    return;
  }

  // Burnout warning
  const burning = activeAgents.find(
    (a) =>
      a.morale < 30 &&
      a.stats.tasksCompleted > 15 &&
      !hasPendingOfTemplate(state, "burnout_warning", a.id)
  );
  if (burning && Math.random() < 0.015) {
    state.scenarios.push(buildBurnoutWarning(state, burning));
    logActivity("تحذير", `${burning.name} على وشك الاحتراق`, "warning");
    return;
  }

  // Underperformer — consistently weak track record
  const underperformer = activeAgents.find((a) => {
    if ((a.onboardingProgress ?? 1) < 1) return false; // don't judge during onboarding
    if (hasPendingOfTemplate(state, "underperformer", a.id)) return false;
    const total = a.stats.tasksCompleted + a.stats.tasksFailed;
    if (total < 5) return false;
    const failRate = a.stats.tasksFailed / total;
    return failRate > 0.45 || (a.morale < 25 && failRate > 0.3);
  });
  if (underperformer && Math.random() < 0.006) {
    state.scenarios.push(buildUnderperformer(state, underperformer));
    logActivity(
      "موارد بشرية",
      `${underperformer.name} · أداء ضعيف مستمر · قرار مطلوب`,
      "warning"
    );
    return;
  }

  // Low morale (team-wide)
  const avgMorale =
    activeAgents.reduce((s, a) => s + a.morale, 0) / activeAgents.length;
  if (avgMorale < 45 && !hasPendingOfTemplate(state, "low_morale") && Math.random() < 0.003) {
    state.scenarios.push(buildLowMorale(state, avgMorale));
    logActivity("تنبيه", "معنويات الفريق منخفضة · قرار مطلوب", "warning");
    return;
  }

  // Sales lead
  const active = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  );
  if (
    active.length < 5 &&
    !hasPendingOfTemplate(state, "sales_lead") &&
    Math.random() < 0.004
  ) {
    state.scenarios.push(buildSalesLead(state));
    logActivity("فرصة مبيعات", "عميل محتمل يطلب عرض سعر", "info");
    return;
  }

  // Overload
  const roleBuckets: Record<string, { pending: number; avail: number }> = {};
  for (const r of ["account_manager", "designer", "video_editor", "developer", "sales"] as Role[]) {
    roleBuckets[r] = { pending: 0, avail: 0 };
  }
  for (const p of state.projects) {
    if (p.status !== "active" && p.status !== "delayed") continue;
    for (const t of p.tasks) {
      if (t.status === "todo" || t.status === "in_progress") {
        roleBuckets[t.requiredRole].pending++;
      }
    }
  }
  for (const a of activeAgents) roleBuckets[a.role].avail++;
  for (const [role, b] of Object.entries(roleBuckets)) {
    if (b.avail === 0) continue;
    if (b.pending / b.avail > 4 && !hasPendingOfTemplate(state, "overload", role)) {
      if (Math.random() < 0.01) {
        state.scenarios.push(buildOverload(state, role as Role, b.pending));
        logActivity("اختناق", `${ROLE_LABELS[role as Role]} محمّلون · قرار مطلوب`, "warning");
        return;
      }
    }
  }
}

export function pruneExpiredScenarios(state: SimState) {
  const fresh: Scenario[] = [];
  for (const s of state.scenarios) {
    if (s.expiresAt <= state.simTime) {
      logActivity("النظام", `فرصة "${s.title}" انتهى وقتها بدون قرار`, "warning");
      // When ignored, apply default bad outcome — pick the last ("nothing") choice if exists
      const nothing = s.choices.find((c) => c.key === "nothing");
      if (nothing) {
        applyDecision(state, s.id, nothing.key);
      }
      continue;
    }
    fresh.push(s);
  }
  state.scenarios = fresh;
}

// For manual user-triggered scenarios

export function forceSpawnScenario(state: SimState, templateId: string): Scenario | null {
  const activeProjects = state.projects.filter(
    (p) => p.status === "active" || p.status === "delayed"
  );
  const activeAgents = state.agents.filter((a) => a.active);

  switch (templateId) {
    case "sales_lead":
      return buildSalesLead(state);

    case "high_value_opportunity":
      return buildHighValueOpportunity(state);

    case "low_morale": {
      const avg = activeAgents.length
        ? activeAgents.reduce((s, a) => s + a.morale, 0) / activeAgents.length
        : 50;
      return buildLowMorale(state, avg);
    }

    case "external_offer": {
      const pool = activeAgents.filter((a) => a.stats.tasksCompleted > 5);
      const candidate = pool.length ? randomChoice(pool) : activeAgents[0];
      if (!candidate) return null;
      return buildExternalOffer(state, candidate);
    }

    case "burnout_warning": {
      const exhausted = activeAgents
        .filter((a) => a.morale < 60)
        .sort((a, b) => a.morale - b.morale);
      const candidate = exhausted[0] ?? randomChoice(activeAgents);
      if (!candidate) return null;
      return buildBurnoutWarning(state, candidate);
    }

    case "underperformer": {
      // Pick worst performer with enough task history.
      const scored = activeAgents
        .filter((a) => a.stats.tasksCompleted + a.stats.tasksFailed >= 3)
        .map((a) => ({ agent: a, perf: computeAgentPerformance(state, a) }))
        .sort((a, b) => a.perf.overall - b.perf.overall);
      // Fall back to the lowest-morale agent if no-one has enough history.
      const candidate =
        scored[0]?.agent ??
        [...activeAgents].sort((a, b) => a.morale - b.morale)[0];
      if (!candidate) return null;
      return buildUnderperformer(state, candidate);
    }

    case "project_delayed": {
      const delayed = state.projects.find((p) => p.status === "delayed") ??
        activeProjects.sort((a, b) => a.deadline - b.deadline)[0];
      if (!delayed) return null;
      return buildDelayedProject(state, delayed);
    }

    case "unhappy_client": {
      const unhappy = activeProjects
        .slice()
        .sort((a, b) => a.clientSatisfaction - b.clientSatisfaction)[0];
      if (!unhappy) return null;
      return buildUnhappyClient(state, unhappy);
    }

    case "scope_change": {
      const candidate = activeProjects[0];
      if (!candidate) return null;
      return buildScopeChange(state, candidate);
    }

    case "project_loss_risk": {
      const atRisk = activeProjects
        .slice()
        .sort((a, b) => b.actualCost / b.budget - a.actualCost / a.budget)[0];
      if (!atRisk) return null;
      return buildProjectAtRiskOfLoss(state, atRisk);
    }

    case "overload": {
      const roleBuckets: Record<string, { pending: number; avail: number }> = {};
      for (const r of ["account_manager", "designer", "video_editor", "developer", "sales"] as Role[]) {
        roleBuckets[r] = { pending: 0, avail: 0 };
      }
      for (const p of activeProjects) {
        for (const t of p.tasks) {
          if (t.status === "todo" || t.status === "in_progress") {
            roleBuckets[t.requiredRole].pending++;
          }
        }
      }
      for (const a of activeAgents) roleBuckets[a.role].avail++;
      const worst = Object.entries(roleBuckets)
        .map(([role, b]) => ({
          role: role as Role,
          ratio: b.avail > 0 ? b.pending / b.avail : b.pending,
          pending: b.pending,
        }))
        .filter((x) => x.pending > 0)
        .sort((a, b) => b.ratio - a.ratio)[0];
      if (!worst) return null;
      return buildOverload(state, worst.role, worst.pending);
    }

    default:
      return null;
  }
}
