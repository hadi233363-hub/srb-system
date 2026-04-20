// Translation dictionary.
// Keys are flat dot-paths. English is the fallback if a key is missing.
// Add new keys as you translate more of the UI.

export type Locale = "ar" | "en";

export const LOCALES: Locale[] = ["ar", "en"];

export const DICT: Record<string, { ar: string; en: string }> = {
  // Brand + chrome
  "brand.system": { ar: "نظام الإدارة الداخلي", en: "Internal management system" },
  "brand.tagline.simulation": { ar: "محاكاة · مرحلة 1", en: "Simulation · Phase 1" },
  "app.date.prefix": { ar: "", en: "" },

  // Navigation
  "nav.overview": { ar: "نظرة عامة", en: "Overview" },
  "nav.projects": { ar: "المشاريع", en: "Projects" },
  "nav.tasks": { ar: "المهام", en: "Tasks" },
  "nav.team": { ar: "الفريق", en: "Team" },
  "nav.finance": { ar: "المالية", en: "Finance" },
  "nav.reports": { ar: "التقارير", en: "Reports" },
  "nav.admin_users": { ar: "إدارة الحسابات", en: "User management" },

  // Roles
  "role.admin": { ar: "مدير", en: "Admin" },
  "role.manager": { ar: "رئيس قسم", en: "Manager" },
  "role.employee": { ar: "موظف", en: "Employee" },

  // Auth
  "auth.signout": { ar: "تسجيل خروج", en: "Sign out" },
  "auth.signin.google": { ar: "Sign in with Google", en: "Sign in with Google" },

  // Page titles
  "page.overview.title": { ar: "نظرة عامة", en: "Overview" },
  "page.overview.greeting": { ar: "أهلاً", en: "Hi" },
  "page.overview.subtitleFresh": {
    ar: "هذي أول مرة — ابدأ بإضافة موظفينك ومشاريعك",
    en: "First time here — start by adding your team and projects",
  },
  "page.overview.subtitle": {
    ar: "إليك ملخص شركتك آخر 30 يوم",
    en: "Here's your company's last 30 days",
  },
  "page.projects.title": { ar: "المشاريع", en: "Projects" },
  "page.projects.subtitle": {
    ar: "إدارة كاملة للمشاريع وفِرقها",
    en: "Full project & team management",
  },
  "page.tasks.title": { ar: "المهام", en: "Tasks" },
  "page.tasks.clickToEdit": {
    ar: "اضغط أي بطاقة للتعديل الكامل",
    en: "Click any card to edit",
  },
  "page.team.title": { ar: "الفريق", en: "Team" },
  "page.team.subtitle": {
    ar: "حمل كل موظف ومسؤولياته",
    en: "Workload and responsibilities per employee",
  },
  "page.finance.title": { ar: "المحاسبة", en: "Finance" },
  "page.finance.subtitle": {
    ar: "إيرادات ومصروفات · معاملات شهرية متكررة · مشاريع شهرية · تحليل المخاطر",
    en: "Revenue & expenses · Recurring monthly · Monthly projects · Risk analysis",
  },
  "page.admin.title": { ar: "إدارة الحسابات", en: "User management" },

  // Common actions
  "action.new": { ar: "جديد", en: "New" },
  "action.newProject": { ar: "مشروع جديد", en: "New project" },
  "action.newTask": { ar: "مهمة جديدة", en: "New task" },
  "action.newTransaction": { ar: "معاملة جديدة", en: "New transaction" },
  "action.addEmployee": { ar: "أضف موظف", en: "Add employee" },
  "action.recordTransaction": { ar: "سجّل معاملة", en: "Record transaction" },
  "action.save": { ar: "احفظ", en: "Save" },
  "action.cancel": { ar: "إلغاء", en: "Cancel" },
  "action.delete": { ar: "حذف", en: "Delete" },
  "action.edit": { ar: "تعديل", en: "Edit" },
  "action.close": { ar: "إغلاق", en: "Close" },
  "action.confirm": { ar: "تأكيد", en: "Confirm" },
  "action.back": { ar: "رجوع", en: "Back" },

  // Overview
  "kpi.activeProjects": { ar: "مشاريع نشطة", en: "Active projects" },
  "kpi.openTasks": { ar: "مهام مفتوحة", en: "Open tasks" },
  "kpi.overdueTasks": { ar: "مهام متأخرة", en: "Overdue tasks" },
  "kpi.teamSize": { ar: "الفريق", en: "Team" },
  "kpi.revenue30": { ar: "إيرادات (30ي)", en: "Revenue (30d)" },
  "kpi.net30": { ar: "صافي (30ي)", en: "Net (30d)" },

  // Misc
  "state.noData": { ar: "ما فيه بيانات بعد", en: "No data yet" },
  "common.quickActions": { ar: "إجراءات سريعة", en: "Quick actions" },
  "common.delayed": { ar: "متأخرة", en: "Overdue" },
  "common.onSchedule": { ar: "ضمن الموعد", en: "On schedule" },
  "common.activeEmployees": { ar: "موظف نشط", en: "active" },
  "common.setupStart": { ar: "ابدأ الإعداد", en: "Start setup" },
  "common.setupDesc": {
    ar: "نظامك جاهز — بس محتاج شوية إعداد أولي. خطوتين وتكون جاهز:",
    en: "Your system is ready — just needs some setup. A few steps and you're live:",
  },
  "common.expensesLabel": { ar: "مصروفات", en: "Expenses" },
  "common.margin": { ar: "هامش", en: "Margin" },
  "common.deltaVsPrev": { ar: "عن الفترة السابقة", en: "vs previous period" },

  // Overview-specific
  "overview.userFallback": { ar: "مدير", en: "Admin" },
  "overview.setup.team.title": { ar: "ضيف فريقك", en: "Add your team" },
  "overview.setup.team.desc": {
    ar: "حسابات الموظفين بجيميلاتهم",
    en: "Create accounts for your employees by Gmail",
  },
  "overview.setup.team.cta": { ar: "إدارة الحسابات", en: "User management" },
  "overview.setup.project.title": { ar: "ضيف أول مشروع", en: "Create first project" },
  "overview.setup.project.desc": {
    ar: "اسم، عميل، ديدلاين، وفريق",
    en: "Name, client, deadline, and team",
  },
  "overview.setup.project.cta": { ar: "المشاريع", en: "Projects" },
  "overview.setup.tasks.title": { ar: "ضيف المهام", en: "Add tasks" },
  "overview.setup.tasks.desc": {
    ar: "Kanban مع موعد تسليم لكل مهمة",
    en: "Kanban with due date on each task",
  },
  "overview.setup.tasks.cta": { ar: "المهام", en: "Tasks" },

  // Finance-specific
  "finance.commitments.title": {
    ar: "الالتزامات الشهرية الثابتة (كل شهر تلقائياً)",
    en: "Fixed monthly commitments (auto each month)",
  },
  "finance.commitments.income": { ar: "دخل شهري ثابت", en: "Fixed monthly income" },
  "finance.commitments.incomeSub": {
    ar: "معاملات متكررة + مشاريع شهرية",
    en: "Recurring transactions + monthly projects",
  },
  "finance.commitments.expense": { ar: "مصروف شهري ثابت", en: "Fixed monthly expense" },
  "finance.commitments.expenseSub": {
    ar: "رواتب + اشتراكات + إيجار",
    en: "Salaries + subscriptions + rent",
  },
  "finance.commitments.net": { ar: "صافي شهري متوقع", en: "Expected monthly net" },
  "finance.commitments.netSub": {
    ar: "قبل أي دخل/مصروف إضافي",
    en: "Before any ad-hoc income/expense",
  },
  "finance.period.income": { ar: "الإيرادات", en: "Revenue" },
  "finance.period.expense": { ar: "المصروفات", en: "Expenses" },
  "finance.period.net": { ar: "صافي الربح", en: "Net profit" },
  "finance.period.txCount": { ar: "عدد المعاملات", en: "Transactions" },
  "finance.period.inSystem": { ar: "في النظام", en: "in system" },
  "finance.risk.title": { ar: "تحليل المخاطر", en: "Risk analysis" },
  "finance.monthlyProjects.title": { ar: "مشاريع شهرية نشطة", en: "Active monthly projects" },
  "finance.recent.title": { ar: "المعاملات المسجّلة", en: "Recorded transactions" },
  "finance.empty.title": { ar: "ما فيه معاملات بعد", en: "No transactions yet" },
  "finance.empty.desc": {
    ar: "اضغط \"معاملة جديدة\" لتسجّل راتب شهري متكرر أو دفعة لمرة واحدة.",
    en: "Click \"New transaction\" to record a recurring salary or one-time payment.",
  },
  "finance.period.week": { ar: "أسبوع", en: "Week" },
  "finance.period.month": { ar: "شهر", en: "Month" },
  "finance.period.quarter": { ar: "3 أشهر", en: "3 months" },
  "finance.period.year": { ar: "سنة", en: "Year" },

  // Table headers (shared)
  "table.date": { ar: "التاريخ", en: "Date" },
  "table.type": { ar: "النوع", en: "Type" },
  "table.category": { ar: "الفئة", en: "Category" },
  "table.recurrence": { ar: "التكرار", en: "Recurrence" },
  "table.description": { ar: "الوصف", en: "Description" },
  "table.project": { ar: "المشروع", en: "Project" },
  "table.amount": { ar: "المبلغ", en: "Amount" },

  "tx.income": { ar: "دخل", en: "Income" },
  "tx.expense": { ar: "مصروف", en: "Expense" },
  "tx.oneTime": { ar: "مرة واحدة", en: "One-time" },
  "tx.monthly": { ar: "شهري", en: "Monthly" },

  // Projects page
  "projects.count": { ar: "مشروع", en: "project(s)" },
  "projects.empty.title": { ar: "ما فيه مشاريع بعد", en: "No projects yet" },
  "projects.empty.desc": {
    ar: "اضغط \"مشروع جديد\" فوق لتبدأ.",
    en: "Click \"New project\" above to get started.",
  },

  // Tasks page
  "tasks.overdue": { ar: "متأخرة", en: "overdue" },
  "tasks.count": { ar: "مهمة", en: "task(s)" },
  "tasks.empty.title": { ar: "ما فيه مهام بعد", en: "No tasks yet" },
  "tasks.empty.desc": {
    ar: "اضغط \"مهمة جديدة\" لتبدأ.",
    en: "Click \"New task\" to get started.",
  },

  // Team page
  "team.count": { ar: "موظف نشط", en: "active employees" },
  "team.empty.title": { ar: "ما فيه موظفين بعد", en: "No employees yet" },
  "team.empty.desc": {
    ar: "روح لـ \"إدارة الحسابات\" وضيف موظفينك.",
    en: "Go to \"User management\" and add your employees.",
  },
  "team.stats.projects": { ar: "مشاريع", en: "Projects" },
  "team.stats.openTasks": { ar: "مهام مفتوحة", en: "Open tasks" },
  "team.stats.overdue": { ar: "متأخرة", en: "Overdue" },
  "team.salary": { ar: "راتب", en: "Salary" },
  "team.overdueBadge": { ar: "مهمة متأخرة", en: "overdue task(s)" },
  "team.viewDetails": { ar: "تفاصيل وتعديل مهامه", en: "Details & edit tasks" },

  // Admin Users page
  "admin.accountsCount": { ar: "حساب", en: "account(s)" },
  "admin.subtitle": {
    ar: "إضافة / حذف / تغيير الدور والقسم",
    en: "Add / remove / change role and department",
  },
  "admin.denied.title": { ar: "🚫 ممنوع الوصول", en: "🚫 Access denied" },
  "admin.denied.desc": {
    ar: "هذي الصفحة للمدير فقط.",
    en: "This page is for admins only.",
  },

  // Pending approval gate
  "pending.title": {
    ar: "حسابك قيد المراجعة",
    en: "Your account is awaiting approval",
  },
  "pending.body": {
    ar: "سجّلت دخولك بنجاح. المدير بيراجع حسابك ويحدد صلاحياتك قريباً. تقدر تسكّر هالصفحة وترجعلها لاحقاً.",
    en: "You're signed in. The admin will review your account and grant the right permissions shortly. You can close this page and come back later.",
  },
  "pending.nudge": {
    ar: "لو مستعجل، كلّم المدير وقله يفعّل حسابك.",
    en: "If it's urgent, ping the admin to activate your account.",
  },
  "pending.disabled": {
    ar: "حسابك معطّل حالياً من المدير.",
    en: "Your account has been disabled by the admin.",
  },

  // Admin — pending queue section
  "admin.pending.title": {
    ar: "طلبات تسجيل جديدة",
    en: "New sign-in requests",
  },
  "admin.pending.desc": {
    ar: "هؤلاء سجّلوا دخول بجيميلاتهم وينتظرون تفعيل حساباتهم.",
    en: "These users signed in with Google and are waiting for activation.",
  },
  "admin.pending.empty": {
    ar: "ما فيه طلبات جديدة.",
    en: "No new requests.",
  },
  "admin.pending.approve": { ar: "تفعيل", en: "Approve" },
  "admin.pending.reject": { ar: "رفض + حذف", en: "Reject & delete" },
  "admin.pending.roleLabel": { ar: "الدور", en: "Role" },
  "admin.pending.deptLabel": { ar: "القسم (اختياري)", en: "Department (optional)" },
  "admin.pending.approvedToast": {
    ar: "تم تفعيل الحساب",
    en: "Account approved",
  },
  "admin.pending.rejectedToast": {
    ar: "تم حذف الطلب",
    en: "Request deleted",
  },

  // Finance — employee-view gate
  "finance.employee.title": {
    ar: "تسجيل المعاملات",
    en: "Record transactions",
  },
  "finance.employee.subtitle": {
    ar: "تقدر تسجّل المعاملات والمبالغ هنا. الإجماليات والأرقام الإدارية تظهر للمدير فقط.",
    en: "You can record transactions and amounts here. Totals and financial reports are visible to the admin only.",
  },
  "finance.employee.cta": {
    ar: "اضغط \"معاملة جديدة\" فوق لتسجيل دفعة أو مصروف. المدير راح يراجعها.",
    en: "Click \"New transaction\" above to record a payment or expense. The admin will review it.",
  },

  // Projects labels
  "projects.subtitle": {
    ar: "إدارة كاملة للمشاريع وفِرقها",
    en: "Full project & team management",
  },
  "projects.empty.desc.full": {
    ar: "اضغط \"مشروع جديد\" فوق لتبدأ. كل مشروع بتحدد له عميل، ميزانية، deadline، وفريق.",
    en: "Click \"New project\" above to start. Set a client, budget, deadline, and team for each project.",
  },
  "projects.progress": { ar: "التقدم", en: "Progress" },
  "projects.taskWord": { ar: "مهمة", en: "task(s)" },
  "projects.priorityPrefix": { ar: "أولوية", en: "Priority:" },
  "projects.perMonth": { ar: "/شهر", en: "/mo" },
  "projects.monthly": { ar: "شهري", en: "Monthly" },
  "projects.oneTime": { ar: "لمرة واحدة", en: "One-time" },

  // Tasks labels
  "tasks.clickToEdit": {
    ar: "اضغط أي بطاقة للتعديل الكامل",
    en: "Click any card to edit",
  },
  "tasks.empty.desc.full": {
    ar: "اضغط \"مهمة جديدة\" فوق لتبدأ. تقدر تربطها بمشروع وتعيّن مسؤول، وموعد تسليم، وأولوية، وموظفين إضافيين.",
    en: "Click \"New task\" above to start. Link it to a project, assign an owner, set a due date, priority, and extra collaborators.",
  },

  // Finance labels
  "finance.revenueLabel": { ar: "الإيرادات", en: "Revenue" },
  "finance.expensesLabel": { ar: "المصروفات", en: "Expenses" },
  "finance.netProfit": { ar: "صافي الربح", en: "Net profit" },
  "finance.txCount": { ar: "عدد المعاملات", en: "Transactions" },
  "finance.inSystem": { ar: "في النظام", en: "in system" },
  "finance.marginLabel": { ar: "هامش", en: "Margin" },
  "finance.ofWhich": { ar: "منها", en: "of which" },
  "finance.fromMonthlyProjects": {
    ar: "من مشاريع شهرية",
    en: "from monthly projects",
  },
  "finance.recurring": { ar: "متكررة", en: "recurring" },
  "finance.riskTitle": { ar: "⚡ تحليل المخاطر", en: "⚡ Risk analysis" },
  "finance.monthlyProjects.heading": {
    ar: "🔁 مشاريع شهرية نشطة",
    en: "🔁 Active monthly projects",
  },
  "finance.monthlyProjects.perMonth": { ar: "/شهر", en: "/mo" },
  "finance.transactionsHeading": { ar: "المعاملات المسجّلة", en: "Recorded transactions" },
  "finance.empty.descFull": {
    ar: "اضغط \"معاملة جديدة\" لتسجّل راتب شهري متكرر (يُحتسب كل شهر تلقائياً) أو دفعة لمرة واحدة.",
    en: "Click \"New transaction\" to record a monthly recurring salary (auto-counted each month) or a one-time payment.",
  },
  "finance.upcomingCalloutSuffix": {
    ar: "معاملة مستقبلية لمرة واحدة",
    en: "upcoming one-time transaction(s)",
  },
  "finance.upcomingHint": {
    ar: "عندك معاملات بتاريخ بعد اليوم — هذي ما تنحسب في الفترة الحالية. لو تبيها تنحسب كل شهر تلقائياً (مثل الرواتب): احذفها وأعد إضافتها وحدد",
    en: "You have transactions dated after today — those aren't counted in this period. To make them auto-count each month (like salaries): delete them, re-add them, and choose",
  },
  "finance.upcomingHintMark": {
    ar: "🔁 شهري متكرر",
    en: "🔁 Monthly recurring",
  },
  "finance.upcomingHintTail": {
    ar: "من البداية.",
    en: "from the start.",
  },
  "finance.deltaVsPrev": { ar: "عن الفترة السابقة", en: "vs previous period" },

  // Risk messages
  "risk.loss.title": { ar: "خسارة في هذه الفترة", en: "Loss this period" },
  "risk.loss.detailPrefix": {
    ar: "المصروفات تجاوزت الإيرادات بـ",
    en: "Expenses exceeded revenue by",
  },
  "risk.lowMargin.title": { ar: "هامش ربح منخفض", en: "Low profit margin" },
  "risk.lowMargin.detailPrefix": { ar: "هامشك", en: "Your margin is" },
  "risk.lowMargin.detailSuffix": {
    ar: "فقط — يُفضّل فوق 15%.",
    en: "only — 15%+ is preferred.",
  },
  "risk.revenueDrop.title": { ar: "الإيرادات تنخفض", en: "Revenue is dropping" },
  "risk.revenueDrop.detailPrefix": { ar: "نزلت", en: "Down" },
  "risk.revenueDrop.detailSuffix": {
    ar: "عن الفترة السابقة.",
    en: "vs previous period.",
  },
  "risk.expenseRise.title": {
    ar: "المصروفات في ارتفاع",
    en: "Expenses are rising",
  },
  "risk.expenseRise.detailPrefix": { ar: "زادت", en: "Up" },
  "risk.expenseRise.detailSuffix": {
    ar: "عن الفترة السابقة.",
    en: "vs previous period.",
  },
  "risk.fixedGap.title": {
    ar: "المصروفات الثابتة > الإيرادات الثابتة",
    en: "Fixed expenses > fixed income",
  },
  "risk.fixedGap.detailPrefix": {
    ar: "كل شهر فيه عجز ثابت بمقدار",
    en: "A recurring monthly shortfall of",
  },
  "risk.fixedGap.detailSuffix": {
    ar: "قبل أي مشروع لمرة واحدة — زيد الإيرادات الشهرية المستمرة.",
    en: "before any one-time project — grow recurring monthly income.",
  },
  "risk.noIncome.title": { ar: "ما فيه دخل مسجّل", en: "No income recorded" },
  "risk.noIncome.detailPrefix": { ar: "سجّلت", en: "You recorded" },
  "risk.noIncome.detailSuffix": {
    ar: "مصروفات بدون أي إيراد.",
    en: "in expenses with no revenue.",
  },
  "risk.healthy.title": { ar: "الوضع المالي صحي", en: "Finances look healthy" },
  "risk.healthy.detailPrefix": { ar: "صافي ربح", en: "Net profit of" },
  "risk.healthy.detailMargin": { ar: "بهامش", en: "at a margin of" },

  // Roles
  "role.labelAdmin": { ar: "مدير", en: "Admin" },
  "role.labelManager": { ar: "رئيس قسم", en: "Manager" },
  "role.labelEmployee": { ar: "موظف", en: "Employee" },

  // Project status
  "projectStatus.active": { ar: "نشط", en: "Active" },
  "projectStatus.on_hold": { ar: "موقّف مؤقتاً", en: "On hold" },
  "projectStatus.completed": { ar: "مكتمل", en: "Completed" },
  "projectStatus.cancelled": { ar: "ملغي", en: "Cancelled" },

  // Project type
  "projectType.video": { ar: "فيديو", en: "Video" },
  "projectType.photo": { ar: "تصوير", en: "Photo" },
  "projectType.event": { ar: "فعالية", en: "Event" },
  "projectType.digital_campaign": { ar: "حملة رقمية", en: "Digital campaign" },
  "projectType.web": { ar: "ويب", en: "Web" },
  "projectType.other": { ar: "غير ذلك", en: "Other" },

  // Priority
  "priority.low": { ar: "منخفضة", en: "Low" },
  "priority.normal": { ar: "عادية", en: "Normal" },
  "priority.high": { ar: "مرتفعة", en: "High" },
  "priority.urgent": { ar: "عاجلة", en: "Urgent" },

  // Task status
  "taskStatus.todo": { ar: "قيد الانتظار", en: "To do" },
  "taskStatus.in_progress": { ar: "قيد العمل", en: "In progress" },
  "taskStatus.in_review": { ar: "قيد المراجعة", en: "In review" },
  "taskStatus.done": { ar: "مكتمل", en: "Done" },
  "taskStatus.blocked": { ar: "معلّق", en: "Blocked" },

  // Transaction category
  "txCategory.project_payment": { ar: "دفعة مشروع", en: "Project payment" },
  "txCategory.salary": { ar: "راتب", en: "Salary" },
  "txCategory.bonus": { ar: "بونص", en: "Bonus" },
  "txCategory.tool": { ar: "أدوات/اشتراكات", en: "Tools/subscriptions" },
  "txCategory.ad": { ar: "إعلانات", en: "Ads" },
  "txCategory.overhead": { ar: "مصاريف عامة", en: "Overhead" },
  "txCategory.refund": { ar: "ارتجاع/خسارة", en: "Refund/loss" },
  "txCategory.other": { ar: "غير ذلك", en: "Other" },

  // Billing type
  "billing.one_time": { ar: "مرة واحدة", en: "One-time" },
  "billing.monthly": { ar: "شهري متكرر", en: "Monthly recurring" },

  // Recurrence
  "recurrence.none": { ar: "مرة واحدة", en: "One-time" },
  "recurrence.monthly": { ar: "شهري", en: "Monthly" },

  // Language switcher
  "lang.arabic": { ar: "عربي", en: "عربي" },
  "lang.english": { ar: "English", en: "English" },
};

/** Translate a key into a given locale. Falls back to English if key missing. */
export function translate(key: string, locale: Locale): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}
