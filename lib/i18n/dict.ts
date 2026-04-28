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

  // Roles — labels reflect the 4-tier hierarchy: الرئيس (admin/owner) →
  // المدير (manager) → رئيس الفريق (department_lead) → الموظف (employee).
  // DB role value `admin` represents the owner tier.
  "role.admin": { ar: "الرئيس", en: "President" },
  "role.manager": { ar: "المدير", en: "Manager" },
  "role.department_lead": { ar: "رئيس الفريق", en: "Team lead" },
  "role.employee": { ar: "الموظف", en: "Employee" },

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
  "projectType.design": { ar: "ديزاين", en: "Design" },
  "projectType.branding": { ar: "إنشاء علامة تجارية", en: "Branding" },
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
  "txCategory.freelance": { ar: "فري لانس (مشروع)", en: "Freelance (project)" },
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

  // Photo shoots
  "nav.shoots": { ar: "جدول التصوير", en: "Shoot schedule" },
  "page.shoots.title": { ar: "جدول التصوير", en: "Shoot schedule" },
  "page.shoots.subtitle": {
    ar: "مواعيد التصوير للمصورين والمعدات المحجوزة — مع تذكير قبل يوم وقبل ساعة",
    en: "Photography production schedule — crew, equipment, 24h + 1h reminders",
  },
  "shoots.new": { ar: "تصوير جديد", en: "New shoot" },
  "shoots.edit": { ar: "تعديل التصوير", en: "Edit shoot" },
  "shoots.create": { ar: "إنشاء التصوير", en: "Create shoot" },
  "shoots.deleteConfirm": { ar: "تحذف تصوير", en: "Delete shoot" },
  "shoots.markDone": { ar: "تم", en: "Done" },
  "shoots.cancel": { ar: "إلغاء", en: "Cancel" },
  "shoots.soon": { ar: "قريباً", en: "Soon" },
  "shoots.hours": { ar: "ساعة", en: "hr" },
  "shoots.hoursShort": { ar: "س", en: "h" },
  "shoots.openMap": { ar: "افتح الخريطة", en: "Open map" },
  "shoots.openReference": { ar: "المرجع / الموود بورد", en: "Reference / moodboard" },
  "shoots.myUpcoming": { ar: "تصويراتي القادمة", en: "My upcoming shoots" },
  "shoots.conflictsTitle": {
    ar: "تعارضات في الجدول",
    en: "Schedule conflicts",
  },
  "shoots.noCrewAvailable": { ar: "لا يوجد موظفين", en: "No crew available" },
  "shoots.noEquipmentAvailable": {
    ar: "ما فيه معدات مسجّلة بعد — ضيف من صفحة المعدات",
    en: "No equipment yet — add from the Equipment page",
  },
  "shoots.calendar.heading": { ar: "تقويم التصوير", en: "Shoot calendar" },
  "shoots.list.upcoming": { ar: "تصوير قادم", en: "Upcoming shoots" },
  "shoots.list.past": { ar: "تصوير سابق", en: "Past shoots" },
  "shoots.empty.upcoming": {
    ar: "ما فيه تصوير مجدول — اضغط \"تصوير جديد\"",
    en: "No shoots scheduled — click \"New shoot\"",
  },
  "shoots.status.scheduled": { ar: "مجدول", en: "Scheduled" },
  "shoots.status.done": { ar: "تمّ", en: "Done" },
  "shoots.status.cancelled": { ar: "ملغي", en: "Cancelled" },
  "shoots.status.postponed": { ar: "مؤجّل", en: "Postponed" },
  "shoots.stats.upcoming": { ar: "قادمة", en: "Upcoming" },
  "shoots.stats.done": { ar: "تمّت", en: "Done" },
  "shoots.stats.cancelled": { ar: "ملغاة", en: "Cancelled" },
  "shoots.stats.postponed": { ar: "مؤجّلة", en: "Postponed" },
  "shoots.field.title": { ar: "عنوان التصوير", en: "Shoot title" },
  "shoots.field.titlePlaceholder": {
    ar: "مثال: تصوير فعالية وذنان",
    en: "e.g. Wadnan event shoot",
  },
  "shoots.field.project": { ar: "المشروع", en: "Project" },
  "shoots.field.status": { ar: "الحالة", en: "Status" },
  "shoots.field.date": { ar: "تاريخ ووقت التصوير", en: "Shoot date & time" },
  "shoots.field.duration": { ar: "المدة", en: "Duration" },
  "shoots.field.location": { ar: "الموقع", en: "Location" },
  "shoots.field.locationPlaceholder": {
    ar: "فندق كذا، كتارا، الدوحة",
    en: "Hotel X, Katara, Doha",
  },
  "shoots.field.locationNotes": { ar: "تعليمات الموقع", en: "Location notes" },
  "shoots.field.locationNotesPlaceholder": {
    ar: "الطابق الثاني، قاعة الاجتماعات، بوابة 3",
    en: "2nd floor, meeting hall, gate 3",
  },
  "shoots.field.mapUrl": { ar: "رابط الخريطة", en: "Map link" },
  "shoots.field.clientContact": { ar: "جهة التواصل في الموقع", en: "On-site contact" },
  "shoots.field.clientContactPlaceholder": {
    ar: "محمد الكواري - 5555 0000",
    en: "Mohammed - 5555 0000",
  },
  "shoots.field.referenceUrl": { ar: "رابط المرجع", en: "Reference link" },
  "shoots.field.crew": { ar: "الطاقم", en: "Crew" },
  "shoots.field.equipment": { ar: "المعدات المحجوزة", en: "Reserved equipment" },
  "shoots.field.shotList": { ar: "قائمة اللقطات", en: "Shot list" },
  "shoots.field.shotListPlaceholder": {
    ar: "وايد زوايا، لقطات للمنتج، لقطات فيديو قصيرة للسوشيال...",
    en: "Wide angles, product shots, short social clips...",
  },
  "shoots.field.notes": { ar: "ملاحظات", en: "Notes" },
  "shoots.field.notesPlaceholder": {
    ar: "أي تعليمات خاصة للموظفين",
    en: "Any special crew instructions",
  },
  "shoots.reminder.titleDay": { ar: "تصوير بعد يوم", en: "Shoot tomorrow" },
  "shoots.reminder.titleHour": { ar: "تصوير بعد ساعة", en: "Shoot in 1 hour" },
  "shoots.reminder.in": { ar: "بعد", en: "in" },
  "shoots.reminder.minutes": { ar: "دقيقة", en: "minutes" },
  "shoots.reminder.hours": { ar: "ساعة", en: "hours" },
  "shoots.viewDetails": { ar: "التفاصيل الكاملة", en: "View details" },
  "shoots.backToAll": { ar: "كل التصويرات", en: "All shoots" },
  "shoots.today": { ar: "اليوم", en: "Today" },
  "shoots.endsAt": { ar: "ينتهي", en: "ends at" },
  "shoots.crewCount": { ar: "مصوّر/موظف", en: "crew" },
  "shoots.itemsCount": { ar: "معدة", en: "items" },
  "shoots.noCrew": { ar: "ما فيه طاقم", en: "No crew" },
  "shoots.noEquipment": { ar: "ما فيه معدات محجوزة", en: "No equipment reserved" },
  "shoots.openInMaps": { ar: "افتح في قوقل ماب", en: "Open in Google Maps" },
  "shoots.getDirections": { ar: "الاتجاهات", en: "Get directions" },
  "shoots.addToCalendar": { ar: "أضف لتقويمي", en: "Add to calendar" },
  "shoots.reminders.title": { ar: "حالة التنبيهات", en: "Reminder status" },
  "shoots.reminders.dayBefore": { ar: "تنبيه قبل يوم", en: "24h-before alert" },
  "shoots.reminders.hourBefore": { ar: "تنبيه قبل ساعة", en: "1h-before alert" },
  "shoots.reminders.sentAt": { ar: "أُرسل في", en: "sent at" },
  "shoots.reminders.pending": {
    ar: "لم يُرسل بعد — راح يشتغل تلقائياً",
    en: "Not sent yet — will fire automatically",
  },

  // Equipment inventory
  "nav.equipment": { ar: "المعدات", en: "Equipment" },
  "page.equipment.title": { ar: "جرد المعدات", en: "Equipment inventory" },
  "page.equipment.subtitle": {
    ar: "كاميرات، عدسات، إضاءة، ودرونات — كل شي مع حالته ومكانه",
    en: "Cameras, lenses, lighting, drones — with condition and holder",
  },
  "equipment.new": { ar: "معدة جديدة", en: "New equipment" },
  "equipment.edit": { ar: "تعديل المعدة", en: "Edit equipment" },
  "equipment.create": { ar: "أضف المعدة", en: "Add equipment" },
  "equipment.deleteConfirm": { ar: "تحذف", en: "Delete" },
  "equipment.checkOut": { ar: "سلّم لموظف", en: "Check out" },
  "equipment.checkIn": { ar: "أرجع المعدة", en: "Check in" },
  "equipment.checkOutTitle": { ar: "تسليم المعدة", en: "Check out equipment" },
  "equipment.checkOutHolder": { ar: "استلم بواسطة", en: "Handed to" },
  "equipment.expectedReturn": { ar: "موعد الإرجاع المتوقع", en: "Expected return date" },
  "equipment.holder": { ar: "المستلم الحالي", en: "Current holder" },
  "equipment.inStorage": { ar: "في المخزن", en: "In storage" },
  "equipment.return": { ar: "إرجاع", en: "Return" },
  "equipment.actions": { ar: "إجراءات", en: "Actions" },
  "equipment.empty.title": { ar: "ما فيه معدات مسجّلة", en: "No equipment recorded" },
  "equipment.empty.desc": {
    ar: "اضغط \"معدة جديدة\" لتبدأ جرد الكاميرات والعدسات",
    en: "Click \"New equipment\" to start inventorying cameras and lenses",
  },
  "equipment.field.name": { ar: "الاسم", en: "Name" },
  "equipment.field.namePlaceholder": {
    ar: "Sony A7 IV · Sigma 24-70mm",
    en: "Sony A7 IV · Sigma 24-70mm",
  },
  "equipment.field.category": { ar: "الفئة", en: "Category" },
  "equipment.field.condition": { ar: "الحالة", en: "Condition" },
  "equipment.field.brand": { ar: "العلامة التجارية", en: "Brand" },
  "equipment.field.model": { ar: "الموديل", en: "Model" },
  "equipment.field.serial": { ar: "الرقم التسلسلي", en: "Serial #" },
  "equipment.field.purchasedAt": { ar: "تاريخ الشراء", en: "Purchased on" },
  "equipment.field.price": { ar: "سعر الشراء (ر.ق)", en: "Purchase price (QAR)" },
  "equipment.field.notes": { ar: "ملاحظات", en: "Notes" },
  "equipment.field.notesPlaceholder": {
    ar: "شنو مميز فيها؟ أي ملاحظة عن الاستخدام؟",
    en: "Anything notable about it or usage?",
  },
  "equipment.category.camera": { ar: "كاميرات", en: "Cameras" },
  "equipment.category.lens": { ar: "عدسات", en: "Lenses" },
  "equipment.category.light": { ar: "إضاءة", en: "Lighting" },
  "equipment.category.tripod": { ar: "حوامل", en: "Tripods" },
  "equipment.category.microphone": { ar: "ميكروفونات", en: "Microphones" },
  "equipment.category.drone": { ar: "درونات", en: "Drones" },
  "equipment.category.audio": { ar: "صوتيات", en: "Audio" },
  "equipment.category.storage": { ar: "تخزين", en: "Storage" },
  "equipment.category.accessory": { ar: "إكسسوارات", en: "Accessories" },
  "equipment.category.other": { ar: "أخرى", en: "Other" },
  "equipment.condition.new": { ar: "جديدة", en: "New" },
  "equipment.condition.good": { ar: "ممتازة", en: "Good" },
  "equipment.condition.fair": { ar: "متوسطة", en: "Fair" },
  "equipment.condition.needs_repair": { ar: "تحتاج صيانة", en: "Needs repair" },
  "equipment.condition.broken": { ar: "معطّلة", en: "Broken" },
  "equipment.stats.total": { ar: "إجمالي المعدات", en: "Total items" },
  "equipment.stats.categories": { ar: "فئات", en: "Categories" },
  "equipment.stats.checkedOut": { ar: "مستلمة حالياً", en: "Checked out" },
  "equipment.stats.needsRepair": { ar: "تحتاج صيانة", en: "Needs repair" },
  "equipment.stats.totalValue": { ar: "القيمة الإجمالية", en: "Total value" },

  // Meetings
  "nav.meetings": { ar: "المواعيد", en: "Meetings" },
  "page.meetings.title": { ar: "مواعيد العملاء", en: "Client meetings" },
  "page.meetings.subtitle": {
    ar: "جدول لقاءات العملاء — مع منصاتهم وموقعهم ومذكّر قبل الموعد بساعة",
    en: "Client meeting schedule — with their platforms, website, and 1-hour reminders",
  },
  "meetings.new": { ar: "موعد جديد", en: "New meeting" },
  "meetings.edit": { ar: "تعديل الموعد", en: "Edit meeting" },
  "meetings.create": { ar: "إنشاء الموعد", en: "Create meeting" },
  "meetings.deleteConfirm": { ar: "تحذف موعد", en: "Delete meeting with" },
  "meetings.markDone": { ar: "تم", en: "Done" },
  "meetings.cancel": { ar: "إلغاء", en: "Cancel" },
  "meetings.joinCall": { ar: "انضم للقاء", en: "Join call" },
  "meetings.minutes": { ar: "دقيقة", en: "min" },
  "meetings.items": { ar: "موعد", en: "meetings" },
  "meetings.soon": { ar: "قريباً (أقل من ساعة)", en: "Soon (<1h)" },
  "meetings.nextUp": { ar: "الموعد التالي", en: "Next up" },
  "meetings.empty.title": { ar: "ما فيه مواعيد بعد", en: "No meetings yet" },
  "meetings.empty.desc": {
    ar: "اضغط \"موعد جديد\" لتسجيل اجتماع مع عميل — مع منصاته وموقعه",
    en: "Click \"New meeting\" to schedule a client meeting with their platforms and website",
  },
  "meetings.filter.upcoming": { ar: "القادمة", en: "Upcoming" },
  "meetings.filter.past": { ar: "السابقة", en: "Past" },
  "meetings.filter.all": { ar: "الكل", en: "All" },
  "meetings.status.scheduled": { ar: "مجدول", en: "Scheduled" },
  "meetings.status.done": { ar: "تمّ", en: "Done" },
  "meetings.status.cancelled": { ar: "ملغي", en: "Cancelled" },
  "meetings.status.no_show": { ar: "ما حضر", en: "No-show" },
  "meetings.calendar.heading": { ar: "التقويم", en: "Calendar" },
  "meetings.calendar.today": { ar: "اليوم", en: "Today" },
  "meetings.list.heading": { ar: "قائمة المواعيد", en: "Meeting list" },
  "meetings.section.client": { ar: "بيانات العميل", en: "Client info" },
  "meetings.section.social": { ar: "المنصات والموقع", en: "Platforms & website" },
  "meetings.section.schedule": { ar: "التوقيت", en: "Schedule" },
  "meetings.section.notes": { ar: "ملاحظات", en: "Notes" },
  "meetings.field.clientName": { ar: "اسم العميل", en: "Client name" },
  "meetings.field.clientNamePlaceholder": { ar: "محمد الكواري", en: "e.g. Mohammed Ali" },
  "meetings.field.companyName": { ar: "اسم الشركة", en: "Company name" },
  "meetings.field.companyPlaceholder": { ar: "اسم الشركة (اختياري)", en: "Company (optional)" },
  "meetings.field.phone": { ar: "رقم الجوال", en: "Phone" },
  "meetings.field.email": { ar: "الإيميل", en: "Email" },
  "meetings.field.instagram": { ar: "انستقرام", en: "Instagram" },
  "meetings.field.tiktok": { ar: "تيك توك", en: "TikTok" },
  "meetings.field.website": { ar: "الموقع الإلكتروني", en: "Website" },
  "meetings.field.socialNotes": { ar: "ملاحظات إضافية", en: "Extra notes" },
  "meetings.field.socialNotesPlaceholder": {
    ar: "مثال: 500 ألف متابع، يهتم بالمحتوى العربي",
    en: "e.g. 500K followers, focused on Arabic content",
  },
  "meetings.field.meetingAt": { ar: "تاريخ ووقت الموعد", en: "Date & time" },
  "meetings.field.duration": { ar: "المدة", en: "Duration" },
  "meetings.field.location": { ar: "المكان", en: "Location" },
  "meetings.field.locationPlaceholder": {
    ar: "مكتب سرب · موقع العميل · أون لاين",
    en: "SRB office · client site · online",
  },
  "meetings.field.meetingLink": { ar: "رابط الاجتماع (Zoom/Meet)", en: "Meeting link (Zoom/Meet)" },
  "meetings.field.owner": { ar: "المسؤول عن الموعد", en: "Meeting owner" },
  "meetings.field.status": { ar: "الحالة", en: "Status" },
  "meetings.field.agendaNotes": { ar: "جدول الأعمال (قبل الموعد)", en: "Agenda (pre-meeting)" },
  "meetings.field.agendaPlaceholder": {
    ar: "شنو تبي تناقش؟ أهداف اللقاء؟ مراجع للعميل؟",
    en: "What to discuss? Meeting goals? Client references?",
  },
  "meetings.field.outcomeNotes": { ar: "نتائج الاجتماع", en: "Outcome" },
  "meetings.field.outcomePlaceholder": {
    ar: "شنو اتفقتوا عليه؟ الخطوات التالية؟",
    en: "What was agreed? Next steps?",
  },
  "meetings.reminder.title": { ar: "تذكير بموعد", en: "Meeting reminder" },
  "meetings.reminder.in": { ar: "بعد", en: "in" },
  "meetings.reminder.minutes": { ar: "دقيقة", en: "minutes" },

  // Theme editor
  "page.theme.title": { ar: "الألوان والهوية", en: "Theme & branding" },
  "page.theme.subtitle": {
    ar: "غيّر ألوان النظام ولوقو الشركة — المعاينة مباشرة قدامك",
    en: "Change system colors and logo — preview updates live",
  },
  "nav.admin_theme": { ar: "الألوان", en: "Theme" },
  "nav.admin_permissions": { ar: "الصلاحيات", en: "Permissions" },

  // Mobile bottom-nav labels (kept short to fit under the icon at 320px wide).
  "bottomNav.myTasks": { ar: "مهامي", en: "My tasks" },
  "bottomNav.mySchedule": { ar: "جدولي", en: "My schedule" },
  "bottomNav.notifications": { ar: "إشعاراتي", en: "Inbox" },
  "bottomNav.more": { ar: "المزيد", en: "More" },
  "theme.field.brand": { ar: "اللون الأساسي (Brand)", en: "Brand color" },
  "theme.field.accent": { ar: "لون التمييز (Accent)", en: "Accent color" },
  "theme.field.logo": { ar: "اللوقو", en: "Logo" },
  "theme.preset.default": { ar: "افتراضي (أخضر)", en: "Default (emerald)" },
  "theme.preset.blue": { ar: "أزرق", en: "Blue" },
  "theme.preset.purple": { ar: "بنفسجي", en: "Purple" },
  "theme.preset.gold": { ar: "ذهبي", en: "Gold" },
  "theme.preset.rose": { ar: "وردي", en: "Rose" },
  "theme.presets": { ar: "ألوان جاهزة", en: "Presets" },
  "theme.preview.title": { ar: "معاينة مباشرة", en: "Live preview" },
  "theme.preview.sampleButton": { ar: "زر أساسي", en: "Primary button" },
  "theme.preview.sampleCard": {
    ar: "هذي بطاقة KPI مثال",
    en: "Sample KPI card",
  },
  "theme.preview.sampleBadge": { ar: "شارة", en: "Badge" },
  "theme.preview.samplePrimary": { ar: "نص أساسي", en: "Primary text" },
  "theme.preview.sampleAccent": { ar: "نص تمييز", en: "Accent text" },
  "theme.save": { ar: "احفظ الثيم", en: "Save theme" },
  "theme.reset": { ar: "استرجع الافتراضي", en: "Reset to default" },
  "theme.saved": { ar: "تم الحفظ ✓", en: "Saved ✓" },
  "theme.logo.change": { ar: "تغيير اللوقو", en: "Change logo" },
  "theme.logo.hint": {
    ar: "ارفع صورة JPG / PNG / SVG لاستبدال اللوقو",
    en: "Upload JPG / PNG / SVG to replace the logo",
  },
  "theme.logo.uploading": { ar: "يرفع...", en: "Uploading..." },
  "theme.logo.uploaded": { ar: "تم الرفع ✓", en: "Uploaded ✓" },
  "theme.logo.failed": { ar: "فشل الرفع", en: "Upload failed" },

  // Reports page
  "page.reports.title": { ar: "التقارير", en: "Reports" },
  "page.reports.subtitle": {
    ar: "ملخصات شهرية محفوظة لكل شهر — إيرادات، مصروفات، صافي، مشاريع، مهام",
    en: "Monthly summaries archived per month — revenue, expenses, net, projects, tasks",
  },
  "reports.prevMonth": { ar: "الشهر السابق", en: "Previous month" },
  "reports.nextMonth": { ar: "الشهر التالي", en: "Next month" },
  "reports.currentMonth": { ar: "الشهر الحالي", en: "Current month" },
  "reports.section.financials": { ar: "الأرقام المالية", en: "Financials" },
  "reports.section.projects": { ar: "المشاريع", en: "Projects" },
  "reports.section.tasks": { ar: "المهام", en: "Tasks" },
  "reports.section.transactions": { ar: "المعاملات هذا الشهر", en: "Transactions this month" },
  "reports.section.history": { ar: "الأشهر السابقة", en: "Historical months" },
  "reports.kpi.revenue": { ar: "الإيرادات", en: "Revenue" },
  "reports.kpi.expenses": { ar: "المصروفات", en: "Expenses" },
  "reports.kpi.net": { ar: "صافي الربح", en: "Net profit" },
  "reports.kpi.margin": { ar: "الهامش", en: "Margin" },
  "reports.kpi.txCount": { ar: "معاملات", en: "Transactions" },
  "reports.projects.started": { ar: "مشاريع بدأت", en: "Projects started" },
  "reports.projects.completed": { ar: "مشاريع مكتملة", en: "Projects completed" },
  "reports.projects.activeEnd": { ar: "نشطة بنهاية الشهر", en: "Active at month end" },
  "reports.tasks.created": { ar: "مهام جديدة", en: "Tasks created" },
  "reports.tasks.completed": { ar: "مهام مكتملة", en: "Tasks completed" },
  "reports.tasks.openEnd": { ar: "مفتوحة بنهاية الشهر", en: "Open at month end" },
  "reports.empty.transactions": { ar: "ما فيه معاملات في هذا الشهر", en: "No transactions this month" },
  "reports.vsPrev": { ar: "عن الشهر السابق", en: "vs previous month" },
  "reports.income.breakdown.oneTime": { ar: "لمرة واحدة", en: "One-time" },
  "reports.income.breakdown.recurring": { ar: "شهري متكرر", en: "Monthly recurring" },
  "reports.income.breakdown.projects": { ar: "مشاريع شهرية", en: "Monthly projects" },
  "reports.expense.breakdown.oneTime": { ar: "لمرة واحدة", en: "One-time" },
  "reports.expense.breakdown.recurring": { ar: "شهري متكرر", en: "Monthly recurring" },
  "reports.history.hint": {
    ar: "اضغط أي شهر لتفتح تقريره",
    en: "Click any month to open its report",
  },

  // Audit log
  "page.audit.title": { ar: "سجل الإجراءات", en: "Audit log" },
  "page.audit.subtitle": {
    ar: "سجل كامل لكل قرار مدير — مين فعل شنو ومتى",
    en: "Full trail of admin decisions — who did what, and when",
  },
  "nav.admin_audit": { ar: "سجل الإجراءات", en: "Audit log" },
  "audit.entries": { ar: "إجراء مسجّل", en: "recorded action(s)" },
  "audit.time": { ar: "الوقت", en: "Time" },
  "audit.actor": { ar: "المنفّذ", en: "Actor" },
  "audit.action": { ar: "الإجراء", en: "Action" },
  "audit.target": { ar: "الهدف", en: "Target" },
  "audit.details": { ar: "التفاصيل", en: "Details" },
  "audit.prev": { ar: "السابق", en: "Previous" },
  "audit.next": { ar: "التالي", en: "Next" },
  "audit.empty.title": { ar: "ما فيه إجراءات مسجّلة بعد", en: "No actions recorded yet" },
  "audit.empty.desc": {
    ar: "أي قرار مدير (تفعيل/تعطيل حسابات، حذف معاملات، إنشاء مشاريع) راح يظهر هنا تلقائياً.",
    en: "Every admin decision (approve/deactivate accounts, delete transactions, create projects) will appear here automatically.",
  },

  // Backup
  "page.backup.title": { ar: "النسخ الاحتياطي", en: "Backup" },
  "page.backup.subtitle": {
    ar: "النظام يسوّي نسخ تلقائي بدون تدخّل منك — يراقب نشاطك ويحفظ لما تحتاج",
    en: "The system creates backups automatically — it watches activity and saves when needed",
  },
  "nav.admin_backup": { ar: "النسخ الاحتياطي", en: "Backup" },
  "backup.runNow": { ar: "أنشئ نسخة الآن", en: "Back up now" },
  "backup.running": { ar: "جاري العمل...", en: "Running..." },
  "backup.lastRun": { ar: "آخر نسخة", en: "Last backup" },
  "backup.never": { ar: "ما نُفّذ بعد", en: "Never" },
  "backup.size": { ar: "الحجم", en: "Size" },
  "backup.location": { ar: "مكان النسخ", en: "Backup folder" },
  "backup.history": { ar: "سجل النسخ السابقة", en: "Backup history" },
  "backup.trigger": { ar: "النوع", en: "Trigger" },
  "backup.trigger.manual": { ar: "يدوي", en: "Manual" },
  "backup.trigger.scheduled": { ar: "مجدول", en: "Scheduled" },
  "backup.trigger.auto": { ar: "تلقائي ذكي", en: "Smart auto" },
  "backup.empty.title": { ar: "ما فيه نسخ بعد", en: "No backups yet" },
  "backup.empty.desc": {
    ar: "النسخة التلقائية الأولى راح تنفذ خلال دقيقة من تشغيل السيرفر. لو تبي نسخة فورية، اضغط الزر فوق.",
    en: "The first auto backup runs within a minute of server start. Click the button above for an immediate one.",
  },
  "backup.success": { ar: "تم إنشاء نسخة", en: "Backup created" },
  "backup.failed": { ar: "فشلت العملية", en: "Backup failed" },
  "backup.schedule.hint": {
    ar: "النظام يفحص الحالة كل 5 دقايق ويسوّي نسخة لما يحدث: 5 معاملات جديدة، أو مشروع جديد، أو موظف جديد، أو تمر 6 ساعات. الحد الأدنى ساعة بين كل نسختين.",
    en: "The system checks every 5 minutes and creates a backup when: 5 new transactions, or a new project, or a new user, or 6 hours pass. Minimum 1 hour between backups.",
  },
  "backup.health.title": { ar: "حالة النسخ الاحتياطي", en: "Backup status" },
  "backup.health.healthy": { ar: "كل شي تمام", en: "All good" },
  "backup.health.warning": { ar: "تنبيه", en: "Heads up" },
  "backup.health.critical": { ar: "خطر — انتبه", en: "Critical" },
  "backup.health.never": { ar: "ما تم أي نسخة بعد", en: "No backups yet" },
  "backup.health.lastAgo": { ar: "آخر نسخة قبل", en: "Last backup" },
  "backup.health.verified": { ar: "متحقّق منها", en: "Verified" },
  "backup.health.failedRecent": {
    ar: "آخر محاولة فشلت — راجع سبب الفشل",
    en: "Last attempt failed — check the error",
  },
  "backup.reason": { ar: "السبب", en: "Reason" },
  "backup.status": { ar: "الحالة", en: "Status" },
  "backup.status.verified": { ar: "متحقّقة", en: "Verified" },
  "backup.status.success": { ar: "نجحت", en: "Success" },
  "backup.status.failed": { ar: "فشلت", en: "Failed" },
  "backup.duration.justNow": { ar: "الحين", en: "just now" },
  "backup.duration.minutes": { ar: "دقيقة", en: "min" },
  "backup.duration.hours": { ar: "ساعة", en: "h" },
  "backup.duration.days": { ar: "يوم", en: "d" },

  // Common actions + status
  "action.saving": { ar: "يحفظ...", en: "Saving..." },
  "action.creating": { ar: "يُنشئ...", en: "Creating..." },
  "action.loading": { ar: "يحمّل...", en: "Loading..." },
  "common.error": { ar: "خطأ", en: "Error" },
  "common.errorGeneric": { ar: "حدث خطأ", en: "Something went wrong" },
  "common.optional": { ar: "اختياري", en: "Optional" },
  "common.required": { ar: "مطلوب", en: "Required" },

  // Task UI
  "tasks.edit": { ar: "تعديل المهمة", en: "Edit task" },
  "tasks.create": { ar: "إنشاء المهمة", en: "Create task" },
  "tasks.delete": { ar: "حذف المهمة", en: "Delete task" },
  "tasks.deleteConfirm": {
    ar: "تحذف المهمة نهائياً؟",
    en: "Delete this task permanently?",
  },
  "tasks.unassigned": { ar: "بدون مسؤول", en: "Unassigned" },
  "tasks.noProject": { ar: "بدون مشروع", en: "No project" },
  "tasks.overdueByDays": { ar: "متأخرة {n} يوم", en: "Overdue by {n} day(s)" },
  "tasks.overdueBanner": {
    ar: "⚠ هذه المهمة متأخرة عن الـ deadline",
    en: "⚠ This task is past its deadline",
  },
  "tasks.kanban.empty": {
    ar: "اسحب مهمة هنا · أو اضغط \"مهمة جديدة\"",
    en: "Drag a task here · or click \"New task\"",
  },
  "tasks.field.title": { ar: "عنوان المهمة", en: "Task title" },
  "tasks.field.titleRequired": { ar: "عنوان المهمة *", en: "Task title *" },
  "tasks.field.titlePlaceholder": {
    ar: "مثال: تصميم بوستر للحملة",
    en: "e.g. Design campaign poster",
  },
  "tasks.suggest.title": {
    ar: "✨ مرشّحون مناسبون لهالمهمة",
    en: "✨ Best fits for this task",
  },
  "tasks.suggest.bestFit": { ar: "الأنسب", en: "Best fit" },
  "tasks.suggest.fit": { ar: "تطابق", en: "fit" },
  "tasks.suggest.thinking": {
    ar: "يحلل الفريق ويختار لك الأنسب...",
    en: "Analyzing the team to find the best fit...",
  },
  "tasks.suggest.hint": {
    ar: "اكتب عنوان المهمة وراح يقترح لك الموظف الأنسب",
    en: "Type a task title and we'll suggest the best person",
  },
  "tasks.suggest.error": {
    ar: "ما قدرت أحضّر اقتراحات الحين — اختر يدوي",
    en: "Couldn't load suggestions — pick manually",
  },
  "tasks.suggest.noMatch": {
    ar: "ما لقيت موظف مناسب — أعد صياغة المهمة أو اختر يدوي",
    en: "No good fit yet — rephrase or pick manually",
  },
  "tasks.suggest.noMatchBadge": {
    ar: "ما فيه موظف يحمل الشارات المختارة — أضف شارة لموظف من إدارة الحسابات",
    en: "Nobody on the team holds these badges yet — add one in Account Management",
  },
  "badges.label": { ar: "الشارات", en: "Badges" },
  "badges.empty": { ar: "ما عنده شارات بعد", en: "No badges yet" },
  "badges.add": { ar: "أضف شارة", en: "Add badge" },
  "badges.allAssigned": {
    ar: "كل الشارات مضافة",
    en: "All badges assigned",
  },
  "badges.required": {
    ar: "🎯 الشارات المطلوبة (اختياري)",
    en: "🎯 Required badges (optional)",
  },
  "badges.clear": { ar: "مسح", en: "Clear" },
  "badges.detectedHint": {
    ar: "النظام اكتشف إن المهمة تحتاج هالشارة",
    en: "Detected from task title",
  },
  "badges.noneDefined": {
    ar: "ما فيه شارات معرّفة — أضف من إدارة الحسابات",
    en: "No badges defined — add from Account Management",
  },
  "tasks.field.status": { ar: "الحالة", en: "Status" },
  "tasks.field.priority": { ar: "الأولوية", en: "Priority" },
  "tasks.field.due": { ar: "موعد التسليم", en: "Due date" },
  "tasks.field.estimated": { ar: "الساعات التقديرية", en: "Estimated hours" },
  "tasks.field.hoursPlaceholder": { ar: "مثال: 8", en: "e.g. 8" },
  "tasks.field.project": { ar: "المشروع", en: "Project" },
  "tasks.field.assignee": { ar: "المسؤول", en: "Assignee" },
  "tasks.field.assigneePrimary": { ar: "المسؤول الأساسي", en: "Primary assignee" },
  "tasks.field.collaborators": {
    ar: "موظفون إضافيون (collaborators)",
    en: "Additional collaborators",
  },
  "tasks.field.description": { ar: "الوصف", en: "Description" },
  "tasks.field.descPlaceholder": {
    ar: "اختياري — تفاصيل المهمة",
    en: "Optional — task details",
  },
  "tasks.collaborators.empty": {
    ar: "ما فيه موظفون إضافيون",
    en: "No additional collaborators",
  },
  "tasks.collaborators.add": { ar: "أضف موظف", en: "Add employee" },
  "tasks.collaborators.hint": {
    ar: "المسؤول الأساسي + الموظفون الإضافيون كلهم يشوفون المهمة في قائمة مهامهم.",
    en: "The primary assignee and all collaborators see this task in their own lists.",
  },

  // Team page extras
  "team.title.workload": { ar: "حمل الموظفين", en: "Workload" },
  "team.label.disabled": { ar: "معطّل", en: "Disabled" },
  "team.hiredLabel": { ar: "تم التوظيف", en: "Hired" },
  "team.salarySuffix.ar": { ar: "/شهر", en: "/mo" },
  "team.noMemberAssigned": {
    ar: "ما تم تعيينه في أي مشروع بعد",
    en: "Not assigned to any project yet",
  },
  "team.member.role": { ar: "دوره", en: "Role" },
  "team.member.default": { ar: "عضو", en: "Member" },
  "team.projectsCount": { ar: "المشاريع ({n})", en: "Projects ({n})" },
  "team.tasksCount": { ar: "المهام ({n})", en: "Tasks ({n})" },
  "team.tasks.hint": {
    ar: "اضغط على أي مهمة لتعديل أو نقلها لموظف آخر",
    en: "Click any task to edit or reassign it",
  },
  "team.tasks.none": { ar: "ما عنده مهام مفتوحة", en: "No open tasks" },
  "team.allTeam": { ar: "كل الفريق", en: "All team" },
  "team.estimatedHours": { ar: "ساعات مقدّرة", en: "Estimated hours" },
  "team.completedCount": { ar: "{n} مكتملة", en: "{n} completed" },

  // Projects UI
  "projects.new.title": { ar: "مشروع جديد", en: "New project" },
  "projects.field.title": { ar: "اسم المشروع *", en: "Project name *" },
  "projects.field.titlePlaceholder": {
    ar: "مثال: حملة إعلانية لعميل X",
    en: "e.g. Ad campaign for client X",
  },
  "projects.field.client": { ar: "العميل", en: "Client" },
  "projects.field.clientPlaceholder": {
    ar: "اسم الشركة أو الشخص",
    en: "Company or person name",
  },
  "projects.field.brand": { ar: "اسم البراند / الشركة", en: "Brand / company" },
  "projects.field.brandPlaceholder": {
    ar: "مثال: SRB Agency، مطعم الشرق...",
    en: "e.g. SRB Agency, Al-Sharq Restaurant...",
  },
  "projects.field.clientPhone": { ar: "رقم جوال العميل", en: "Client phone" },
  "projects.field.clientPhonePlaceholder": {
    ar: "+974 5xxx xxxx",
    en: "+974 5xxx xxxx",
  },
  "projects.field.type": { ar: "النوع", en: "Type" },
  "projects.field.priority": { ar: "الأولوية", en: "Priority" },
  "projects.field.budget": { ar: "الميزانية (ر.ق)", en: "Budget (QAR)" },
  "projects.field.deadline": { ar: "موعد التسليم", en: "Deadline" },
  "projects.field.billingType": { ar: "نوع التسعير", en: "Billing type" },
  "projects.field.billingCycleDays": {
    ar: "دورة التحصيل (بالأيام)",
    en: "Billing cycle (days)",
  },
  "projects.field.billingCycleHint": {
    ar: "افتراضي 30 يوم من تاريخ إدخال المشروع · عدّلها لو عندك عميل بدورة مختلفة",
    en: "Default 30 days from project entry · change it for clients on a different cycle",
  },
  "projects.field.lead": { ar: "قائد المشروع", en: "Project lead" },
  "projects.field.description": { ar: "الوصف", en: "Description" },
  "projects.field.descPlaceholder": {
    ar: "تفاصيل، أهداف، ملاحظات...",
    en: "Details, goals, notes...",
  },
  "projects.create": { ar: "إنشاء المشروع", en: "Create project" },
  "projects.edit": { ar: "تعديل المشروع", en: "Edit project" },
  "projects.delete": { ar: "حذف المشروع", en: "Delete project" },
  "projects.deleteConfirm": {
    ar: "تحذف المشروع نهائياً؟ كل المهام والمعاملات المرتبطة به بتبقى.",
    en: "Delete this project permanently? Linked tasks and transactions will remain.",
  },
  "projects.members.title": { ar: "أعضاء المشروع", en: "Project members" },
  "projects.members.add": { ar: "إضافة عضو", en: "Add member" },
  "projects.members.addBtn": { ar: "ضيف", en: "Add" },
  "projects.members.remove": { ar: "إزالة", en: "Remove" },
  "projects.members.removeConfirm": {
    ar: "تشيل هذا الموظف من المشروع؟",
    en: "Remove this employee from the project?",
  },
  "projects.members.empty": {
    ar: "ما فيه أعضاء بعد — ضيف من الفريق",
    en: "No members yet — add from your team",
  },
  "projects.members.manage": { ar: "إدارة الفريق", en: "Manage team" },
  "projects.members.current": { ar: "الأعضاء الحاليون", en: "Current members" },
  "projects.members.none": { ar: "ما فيه أعضاء", en: "No members" },
  "projects.members.allAdded": {
    ar: "كل الموظفين مضافين",
    en: "All employees added",
  },
  "projects.members.pickLead": { ar: "القائد", en: "Lead" },
  "projects.progressLabel": { ar: "التقدم", en: "Progress" },
  "projects.deadline": { ar: "موعد التسليم", en: "Deadline" },
  "projects.budget": { ar: "الميزانية", en: "Budget" },
  "projects.monthlyBudget": { ar: "الميزانية الشهرية", en: "Monthly budget" },
  "projects.perMonthSubtext": { ar: "كل شهر", en: "per month" },
  "projects.overdueTasksMsg": {
    ar: "مهمة متأخرة في هذا المشروع",
    en: "overdue task(s) in this project",
  },
  "projects.noMembers": { ar: "ما تم تعيين أحد بعد", en: "No one assigned yet" },
  "projects.noTasksYet": {
    ar: "ما فيه مهام بعد — اضغط \"+ مهمة للمشروع\"",
    en: "No tasks yet — click \"+ Task\"",
  },
  "projects.addTaskToProject": { ar: "+ مهمة للمشروع", en: "+ Task" },
  "projects.allProjects": { ar: "كل المشاريع", en: "All projects" },
  "tasks.tasksCompletedShort": { ar: "مهام مكتملة", en: "tasks done" },

  // Finance form
  "finance.new.title": { ar: "معاملة جديدة", en: "New transaction" },
  "finance.delete.confirm": {
    ar: "تحذف المعاملة نهائياً؟",
    en: "Delete this transaction permanently?",
  },
  "finance.field.kind": { ar: "النوع", en: "Type" },
  "finance.field.category": { ar: "الفئة", en: "Category" },
  "finance.field.amount": { ar: "المبلغ (ر.ق)", en: "Amount (QAR)" },
  "finance.field.description": { ar: "الوصف", en: "Description" },
  "finance.field.descPlaceholder": {
    ar: "اختياري — مذكرة سريعة",
    en: "Optional — short note",
  },
  "finance.field.project": { ar: "مشروع مرتبط", en: "Related project" },
  "finance.field.occurredAt": { ar: "تاريخ المعاملة", en: "Transaction date" },
  "finance.field.recurrence": { ar: "التكرار", en: "Recurrence" },
  "finance.field.recurrenceEnds": { ar: "آخر موعد للتكرار", en: "Recurrence end date" },
  "finance.recordTransaction": { ar: "سجّل المعاملة", en: "Record transaction" },

  // Admin users page
  "admin.users.addTitle": { ar: "إضافة موظف جديد", en: "Add new employee" },
  "admin.users.field.email": { ar: "إيميل جيميل", en: "Gmail address" },
  "admin.users.field.name": { ar: "الاسم", en: "Name" },
  "admin.users.field.namePlaceholder": { ar: "أحمد الكواري", en: "e.g. Ahmed Ali" },
  "admin.users.field.role": { ar: "الدور", en: "Role" },
  "admin.users.field.department": { ar: "القسم (اختياري)", en: "Department (optional)" },
  "admin.users.addBtn": { ar: "أضف", en: "Add" },
  "admin.users.deleteConfirm": {
    ar: "تحذف حساب",
    en: "Delete account",
  },
  "admin.users.toggleActivate": { ar: "تفعيل", en: "Activate" },
  "admin.users.toggleDeactivate": { ar: "تعطيل", en: "Deactivate" },
  "admin.users.loginSince": { ar: "آخر دخول", en: "Last login" },
  "admin.users.noLogin": { ar: "ما دخل بعد", en: "Never signed in" },
  "admin.users.createdAt": { ar: "سُجّل", en: "Created" },
  "admin.users.hint": {
    ar: "كل حساب يقدر يدخل بجيميل هذا الإيميل فقط · المدير يقدر يعدّل أو يحذف",
    en: "Each account can sign in with its Gmail address only · Admin can edit or delete",
  },
  "admin.users.empty": {
    ar: "ما فيه حسابات بعد. اضغط \"إضافة موظف\" لتبدأ.",
    en: "No accounts yet. Click \"Add employee\" to start.",
  },
  "admin.users.youLabel": { ar: "أنت", en: "You" },
  "admin.users.addedToast": { ar: "تم الإضافة", en: "Added" },
  "admin.users.addFailed": { ar: "فشل الإضافة", en: "Failed to add" },
  "admin.users.roleOptAdmin": {
    ar: "الرئيس — يشوف كل شي بما فيه المالية",
    en: "President — sees everything incl. finance",
  },
  "admin.users.roleOptManager": {
    ar: "المدير — يدير العمليات ويوافق على الموظفين",
    en: "Manager — runs ops & approves employees",
  },
  "admin.users.roleOptDeptLead": {
    ar: "رئيس قسم — يدير مشاريع ومصاريف قسمه",
    en: "Dept Head — manages their dept projects & expenses",
  },
  "admin.users.roleOptEmployee": {
    ar: "موظف — مهامه فقط",
    en: "Employee — own tasks only",
  },
  "admin.users.lockedHigherRank": {
    ar: "ما تقدر تعدّل على حساب بدرجتك أو فوق",
    en: "Can't edit accounts at or above your rank",
  },
  "action.adding": { ar: "يضيف...", en: "Adding..." },

  // Login page
  "login.title": { ar: "SRB — تسجيل الدخول", en: "SRB — Sign in" },
  "login.subtitle": { ar: "نظام إدارة الوكالة الداخلي", en: "Internal agency management system" },
  "login.body": {
    ar: "سجّل دخول بحساب جوجل اللي أضافك المدير بالنظام. لو ما عندك صلاحية، كلّم المدير.",
    en: "Sign in with the Google account the admin added to the system. If you don't have access, contact the admin.",
  },
  "login.internalOnly": { ar: "استخدام داخلي لوكالة SRB فقط", en: "Internal use for SRB only" },

  // Monthly-invoice lifecycle
  "invoice.status.upcoming": { ar: "الفاتورة الجاية", en: "Next invoice" },
  "invoice.status.dueToday": { ar: "مستحقة اليوم", en: "Due today" },
  "invoice.status.overdue": { ar: "متأخرة", en: "Overdue" },
  "invoice.status.collected": { ar: "محصّلة", en: "Collected" },
  "invoice.in": { ar: "بعد", en: "in" },
  "invoice.daysShort": { ar: "يوم", en: "d" },
  "invoice.overdueBy": { ar: "متأخرة", en: "Overdue by" },
  "invoice.record": { ar: "سجّل الدخل", en: "Record payment" },
  "invoice.recording": { ar: "جاري التسجيل...", en: "Recording..." },
  "invoice.recorded": { ar: "تسجّلت ✓", en: "Recorded ✓" },
  "invoice.reminder.before.title": {
    ar: "تذكير: فاتورة {client}",
    en: "Reminder: {client} invoice",
  },
  "invoice.reminder.before.body": {
    ar: "الفاتورة مستحقة بعد 3 أيام · {amount}",
    en: "Invoice due in 3 days · {amount}",
  },
  "invoice.reminder.due.title": {
    ar: "اليوم فاتورة {client}",
    en: "Today: {client} invoice",
  },
  "invoice.reminder.due.body": {
    ar: "مستحقة الحين · {amount}",
    en: "Due today · {amount}",
  },
  "invoice.reminder.overdue.title": {
    ar: "متأخر: ما تحصّلت فاتورة {client}",
    en: "Overdue: {client} invoice not collected",
  },
  "invoice.reminder.overdue.body": {
    ar: "متأخرة {days} يوم · {amount}",
    en: "{days} day(s) overdue · {amount}",
  },
  "invoice.widget.title": { ar: "فواتير هذا الشهر", en: "Invoices this month" },
  "invoice.widget.empty": {
    ar: "ما فيه مشاريع شهرية بعد",
    en: "No monthly projects yet",
  },

  // Finance — locked tier (employees / non-recorders)
  "finance.locked.desc": {
    ar: "صفحة المالية مقيّدة على رئيس قسم وفوق",
    en: "Finance is restricted to dept head and above",
  },
  "finance.locked.body": {
    ar: "كلّم المدير لو محتاج تسجّل أي حركة مالية",
    en: "Talk to a manager if you need to record a transaction",
  },

  // Task deadline reminders (in-app + desktop notifications)
  "tasks.reminder.dueSoon": { ar: "موعد التسليم قرّب", en: "Task due soon" },
  "tasks.reminder.overdue": { ar: "تجاوزت موعد التاسك", en: "Task overdue" },
  "tasks.reminder.in": { ar: "بعد", en: "in" },
  "tasks.reminder.lateBy": { ar: "متأخرة بـ", en: "late by" },
  "tasks.reminder.minutes": { ar: "دقيقة", en: "min" },
  "tasks.reminder.deliveryStillOk": {
    ar: "موعد التسليم للعميل لسا في وقت",
    en: "Client delivery date still has slack",
  },

  // Notification bell + inbox
  "notifications.title": { ar: "الإشعارات", en: "Notifications" },
  "notifications.empty": { ar: "ما فيه إشعارات بعد", en: "No notifications yet" },
  "notifications.allRead": { ar: "الكل مقروء", en: "All read" },

  // Smart Insights panel — home page
  "insights.heading": { ar: "تنبيهات ذكية", en: "Smart insights" },
  "insights.subheading": {
    ar: "النظام يراقب 24/7 ويرفع لك أي شي يحتاج قرار",
    en: "Live monitoring — surfaces anything that needs your call",
  },
  "insights.allClear.title": { ar: "كل شي تمام", en: "All clear" },
  "insights.allClear.desc": {
    ar: "ما فيه تنبيهات اللحين — استمر",
    en: "Nothing flagged right now — keep going",
  },

  // Web Push (mobile + desktop notifications when the tab is closed)
  "push.on": { ar: "التنبيهات شغّالة", en: "Push on" },
  "push.off": { ar: "فعّل التنبيهات", en: "Enable push" },
  "push.enabling": { ar: "جاري التفعيل...", en: "Enabling..." },
  "push.unsupported.label": { ar: "غير مدعوم", en: "Unsupported" },
  "push.unsupported.desc": {
    ar: "متصفّحك ما يدعم التنبيهات الفورية. جرّب Chrome أو Edge.",
    en: "Your browser doesn't support push. Try Chrome or Edge.",
  },
  "push.iosHint.title": {
    ar: "على iPhone لازم تثبّت الموقع كتطبيق أول",
    en: "On iPhone you must install the app first",
  },
  "push.iosHint.step1": {
    ar: "افتح الموقع في Safari",
    en: "Open the site in Safari",
  },
  "push.iosHint.step2": {
    ar: 'اضغط زر "مشاركة" → "إضافة للشاشة الرئيسية"',
    en: 'Tap Share → "Add to Home Screen"',
  },
  "push.iosHint.step3": {
    ar: "افتح SRB من أيقونة الشاشة الرئيسية وفعّل التنبيهات",
    en: "Open SRB from the home-screen icon and enable push",
  },
  "push.error.permission": {
    ar: "ما عطيتنا صلاحية التنبيهات. غيّرها من إعدادات المتصفح.",
    en: "Notification permission denied. Change it in browser settings.",
  },
  "push.error.notConfigured": {
    ar: "السيرفر مب مفعّل عليه التنبيهات الفورية بعد. كلّم الرئيس.",
    en: "Push isn't configured on the server yet. Contact the owner.",
  },
  "push.error.serverReject": {
    ar: "السيرفر رفض الاشتراك. جرّب لاحقاً.",
    en: "Server rejected the subscription. Try again later.",
  },
  "push.error.generic": {
    ar: "صار خطأ غير متوقع",
    en: "Unexpected error",
  },

  // Misc
  "brand.internal": { ar: "داخلي", en: "Internal" },
  "time.today": { ar: "اليوم", en: "Today" },
  "time.yesterday": { ar: "أمس", en: "Yesterday" },
  "time.days": { ar: "{n} يوم", en: "{n} day(s)" },

  // ---------------------------------------------------------------------------
  // Task work delivery (Submit Work)
  // ---------------------------------------------------------------------------
  "submission.title": { ar: "تسليم الشغل", en: "Submit work" },
  "submission.linkLabel": { ar: "رابط (اختياري)", en: "Link (optional)" },
  "submission.fileLabel": { ar: "ملف / صورة (اختياري)", en: "File / image (optional)" },
  "submission.fileHint": {
    ar: "JPG · PNG · GIF · PDF — حد أقصى 10 ميجا",
    en: "JPG · PNG · GIF · PDF — max 10 MB",
  },
  "submission.noteLabel": { ar: "ملاحظة (اختياري)", en: "Note (optional)" },
  "submission.notePlaceholder": {
    ar: "ملاحظات للمراجع — مختصرة",
    en: "Short notes for the reviewer",
  },
  "submission.submit": { ar: "سلّم المهمة", en: "Submit task" },
  "submission.send": { ar: "أرسل", en: "Send" },
  "submission.empty": {
    ar: "ما فيه تسليم بعد",
    en: "No submissions yet",
  },
  "submission.tooLarge": {
    ar: "حجم الملف أكبر من 10 ميجا",
    en: "File larger than 10 MB",
  },
  "submission.assigneeWaiting": {
    ar: "تسليمك تحت المراجعة — في انتظار الرئيس",
    en: "Submitted — waiting for owner review",
  },
  "submission.awaitingReview": {
    ar: "في انتظار مراجعتك",
    en: "Awaiting your review",
  },
  "submission.approve": { ar: "موافقة", en: "Approve" },
  "submission.requestChanges": { ar: "طلب تعديل", en: "Request changes" },
  "submission.reasonPlaceholder": {
    ar: "اكتب السبب — يوصل للموظف",
    en: "Write the reason — sent to the employee",
  },
  "submission.reasonRequired": {
    ar: "اكتب سبب طلب التعديل",
    en: "Write a reason for the change request",
  },
  "submission.reviewNotes": { ar: "ملاحظات المراجعة", en: "Review notes" },
  "submission.attachment": { ar: "مرفق", en: "Attachment" },
  "submission.status.pending": { ar: "قيد المراجعة", en: "Pending review" },
  "submission.status.approved": { ar: "معتمد", en: "Approved" },
  "submission.status.changes_requested": {
    ar: "طُلب تعديل",
    en: "Changes requested",
  },

  // Polished submission UI (smart link / drag-drop / review panel)
  "submission.urlLabel": { ar: "رابط التسليم", en: "Submission link" },
  "submission.urlPlaceholder": {
    ar: "الصق رابط Drive أو Figma أو YouTube...",
    en: "Paste a Drive, Figma, or YouTube link...",
  },
  "submission.dropZoneIdle": {
    ar: "اسحب الملف هنا أو اضغط للاختيار",
    en: "Drag a file here or click to choose",
  },
  "submission.dropZoneActive": {
    ar: "أفلت الملف هنا",
    en: "Drop the file here",
  },
  "submission.uploading": { ar: "جاري الرفع...", en: "Uploading..." },
  "submission.uploadFailed": {
    ar: "فشل رفع الملف",
    en: "Upload failed",
  },
  "submission.badType": {
    ar: "نوع الملف غير مدعوم — JPG / PNG / GIF / PDF",
    en: "Unsupported file type — JPG / PNG / GIF / PDF",
  },
  "submission.replaceFile": { ar: "استبدل", en: "Replace" },
  "submission.removeFile": { ar: "حذف", en: "Remove" },
  "submission.requireOne": {
    ar: "أرفق رابط أو ملف على الأقل",
    en: "Attach a link or a file",
  },
  "submission.submitButton": {
    ar: "📤 سلّم المهمة للمراجعة",
    en: "📤 Submit for review",
  },
  "submission.submitting": { ar: "جاري التسليم...", en: "Submitting..." },
  "submission.toastSubmitted": {
    ar: "✅ تم التسليم — بانتظار موافقة المسؤول",
    en: "✅ Submitted — awaiting owner approval",
  },
  "submission.toastApproved": {
    ar: "✅ تم قبول التسليم",
    en: "✅ Submission approved",
  },
  "submission.toastRejected": {
    ar: "↩️ تم إرسال الطلب للموظف",
    en: "↩️ Sent back to the employee",
  },
  "submission.reviewTitle": {
    ar: "تسليم بانتظار مراجعتك",
    en: "Submission awaiting your review",
  },
  "submission.approveButton": { ar: "قبلت التسليم", en: "Approve" },
  "submission.rejectButton": { ar: "أعد الشغل", en: "Send back" },
  "submission.reasonPlaceholderRich": {
    ar: "اكتب سبب الإعادة...",
    en: "Reason for sending back...",
  },
  "submission.approvedHeader": {
    ar: "تم قبول هذا التسليم",
    en: "Submission approved",
  },
  "submission.changesRequestedHeader": {
    ar: "طُلب منك إعادة العمل",
    en: "Changes requested",
  },
  "submission.history": { ar: "سجل التسليمات", en: "Submission history" },
  "submission.inReviewBadge": {
    ar: "بانتظار المراجعة",
    en: "Awaiting review",
  },

  // ---------------------------------------------------------------------------
  // Project phases
  // ---------------------------------------------------------------------------
  "phases.title": { ar: "مراحل المشروع", en: "Project phases" },
  "phases.empty": { ar: "ما فيه مراحل بعد", en: "No phases yet" },
  "phases.addPhase": { ar: "أضف مرحلة", en: "Add phase" },
  "phases.create": { ar: "إنشاء المرحلة", en: "Create phase" },
  "phases.startFromTemplate": {
    ar: "ابدأ من قالب جاهز",
    en: "Start from a template",
  },
  "phases.template.none": { ar: "بدون مراحل", en: "No phases" },
  "phases.field.name": { ar: "اسم المرحلة", en: "Phase name" },
  "phases.field.description": { ar: "وصف (اختياري)", en: "Description (optional)" },
  "phases.field.deadline": { ar: "موعد المرحلة", en: "Phase deadline" },
  "phases.tasksEmpty": {
    ar: "ما فيه مهام في المرحلة بعد",
    en: "No tasks in this phase yet",
  },
  "phases.proof": { ar: "دليل التسليم", en: "Delivery proof" },
  "phases.pendingReview": { ar: "في انتظار المراجعة", en: "Pending review" },
  "phases.reviewMe": { ar: "لازم تراجع التسليم", en: "Review the submission" },
  "phases.approve": { ar: "اعتماد المرحلة", en: "Approve phase" },
  "phases.unlock": { ar: "فك القفل", en: "Unlock" },
  "phases.confirmDelete": {
    ar: "أكيد تبي تحذف المرحلة؟",
    en: "Delete this phase?",
  },
  "phases.completeHeader": {
    ar: "أنهِ المرحلة — أرفق دليل تسليم",
    en: "Complete phase — attach delivery proof",
  },
  "phases.completeButton": { ar: "أنهِ المرحلة", en: "Complete phase" },
  "phases.status.not_started": { ar: "لم تبدأ", en: "Not started" },
  "phases.status.active": { ar: "جارية", en: "Active" },
  "phases.status.completed": { ar: "مكتملة", en: "Completed" },
  "phases.status.locked": { ar: "مقفولة", en: "Locked" },

  // Clients
  "nav.clients": { ar: "العملاء", en: "Clients" },
  "page.clients.title": { ar: "العملاء", en: "Clients" },
  "page.clients.subtitle": {
    ar: "كل العملاء اللي تعاملنا معاهم — مشاريعهم، إيراداتهم، ومعلومات التواصل",
    en: "Every client we've worked with — projects, revenue, and contacts",
  },
  "clients.count": { ar: "عميل مسجّل", en: "registered clients" },
  "clients.empty.title": { ar: "ما فيه عملاء بعد", en: "No clients yet" },
  "clients.empty.desc": {
    ar: "العملاء يضافون تلقائياً لما تنشئ مشروع وتدخل اسم عميل جديد. تقدر تضيف عميل يدوي من الزر فوق.",
    en: "Clients auto-register when you create a project with a new client name. You can also add one manually with the button above.",
  },
  "clients.searchPlaceholder": {
    ar: "ابحث بالاسم، البراند، أو رقم الهاتف…",
    en: "Search by name, brand, or phone…",
  },
  "clients.action.new": { ar: "عميل جديد", en: "New client" },
  "clients.action.add": { ar: "أضف العميل", en: "Add client" },
  "clients.action.copyPhone": { ar: "انسخ الرقم", en: "Copy number" },
  "clients.copied": { ar: "تم النسخ", en: "Copied" },
  "clients.col.name": { ar: "اسم العميل", en: "Name" },
  "clients.col.phone": { ar: "رقم الهاتف", en: "Phone" },
  "clients.col.projectsCount": { ar: "عدد المشاريع", en: "Projects" },
  "clients.col.totalRevenue": { ar: "إجمالي الإيرادات", en: "Total revenue" },
  "clients.col.lastProject": { ar: "آخر مشروع", en: "Last project" },
  "clients.col.joinedAt": { ar: "تاريخ الانضمام", en: "Joined" },
  "clients.field.name": { ar: "الاسم", en: "Name" },
  "clients.field.phone": { ar: "رقم الهاتف", en: "Phone" },
  "clients.field.email": { ar: "البريد الإلكتروني", en: "Email" },
  "clients.field.notes": { ar: "ملاحظات", en: "Notes" },
  "clients.field.namePlaceholder": { ar: "محمد الكواري", en: "Mohammed Al-Kuwari" },
  "clients.field.phonePlaceholder": { ar: "+974 5xxx xxxx", en: "+974 5xxx xxxx" },
  "clients.field.emailPlaceholder": { ar: "client@example.com", en: "client@example.com" },
  "clients.field.notesPlaceholder": {
    ar: "ملاحظات داخلية عن العميل، تفضيلاته، شروط دفعه…",
    en: "Internal notes about the client, preferences, payment terms…",
  },
  "clients.detail.profile": { ar: "بيانات العميل", en: "Client info" },
  "clients.detail.projects": { ar: "مشاريع العميل", en: "Projects" },
  "clients.detail.summary": { ar: "ملخص مالي", en: "Financial summary" },
  "clients.detail.totalPaid": { ar: "إجمالي المدفوع", en: "Total paid" },
  "clients.detail.completedCount": { ar: "مشاريع مكتملة", en: "Completed projects" },
  "clients.detail.activeCount": { ar: "مشاريع نشطة", en: "Active projects" },
  "clients.detail.save": { ar: "احفظ التغييرات", en: "Save changes" },
  "clients.detail.saving": { ar: "جاري الحفظ…", en: "Saving…" },
  "clients.detail.saved": { ar: "تم الحفظ", en: "Saved" },
  "clients.detail.deleteConfirm": {
    ar: "حذف هذا العميل؟ المشاريع المرتبطة بيه ما راح تنحذف، بس ما راح تكون مرتبطة بأي عميل.",
    en: "Delete this client? Their projects won't be deleted but will lose the client link.",
  },
  "clients.detail.delete": { ar: "احذف العميل", en: "Delete client" },
  "clients.proj.title": { ar: "اسم المشروع", en: "Project" },
  "clients.proj.type": { ar: "النوع", en: "Type" },
  "clients.proj.status": { ar: "الحالة", en: "Status" },
  "clients.proj.budget": { ar: "الميزانية", en: "Budget" },
  "clients.proj.paid": { ar: "المدفوع", en: "Paid" },
  "clients.proj.remaining": { ar: "المتبقي", en: "Remaining" },
  "clients.proj.startedAt": { ar: "تاريخ البدء", en: "Started" },
  "clients.proj.empty": {
    ar: "لا توجد مشاريع لهذا العميل بعد.",
    en: "No projects for this client yet.",
  },
  "clients.combobox.empty": {
    ar: "ابدأ بكتابة اسم العميل…",
    en: "Start typing the client name…",
  },
  "clients.combobox.noResults": {
    ar: "ما فيه عميل بهذا الاسم. اختر «إضافة عميل جديد» أدناه.",
    en: "No matching client. Pick \"Add new client\" below.",
  },
  "clients.combobox.addNew": {
    ar: "➕ إضافة عميل جديد:",
    en: "➕ Add new client:",
  },
  "clients.combobox.linked": { ar: "مرتبط", en: "Linked" },
  "clients.combobox.clear": { ar: "إلغاء الاختيار", en: "Clear" },

  // Brand column + computed status badge
  "clients.col.brand": { ar: "البراند", en: "Brand" },
  "clients.col.status": { ar: "الحالة", en: "Status" },
  "clients.status.active": { ar: "نشط", en: "Active" },
  "clients.status.inactive": { ar: "منتهي", en: "Finished" },
  "clients.field.brand": { ar: "اسم البراند / الشركة", en: "Brand / company" },
  "clients.field.brandPlaceholder": {
    ar: "مثال: SRB Agency، مطعم الشرق...",
    en: "e.g. SRB Agency, Al-Sharq Restaurant...",
  },

  // Touchpoint / communication log on the client profile
  "clients.notes.title": { ar: "سجل التواصل والملاحظات", en: "Communication log" },
  "clients.notes.placeholder": {
    ar: "اكتب ملاحظة... مثال: تم التواصل اليوم وأبدى اهتمامه بتجديد العقد",
    en: "Write a note... e.g. Called today, showed interest in renewing the contract",
  },
  "clients.notes.add": { ar: "أضف ملاحظة", en: "Add note" },
  "clients.notes.adding": { ar: "جاري الإضافة…", en: "Adding…" },
  "clients.notes.empty": {
    ar: "لا توجد ملاحظات بعد. ابدأ بتسجيل أول تواصل مع العميل.",
    en: "No notes yet. Start by logging the first touchpoint.",
  },
  "clients.notes.deletedAuthor": { ar: "حساب محذوف", en: "Deleted account" },
  "clients.notes.deleteConfirm": {
    ar: "حذف هذه الملاحظة؟",
    en: "Delete this note?",
  },
  "clients.notes.delete": { ar: "حذف", en: "Delete" },
};

/** Translate a key into a given locale. Falls back to English if key missing. */
export function translate(key: string, locale: Locale): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}
