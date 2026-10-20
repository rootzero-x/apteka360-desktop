# Desktop qamrovi: web panel yo'llari → native ekranlar

Manba: `apteka360-frontend-web/apps/web/src/app/(app)/**/page.tsx` (36 yo'l) va `lib/nav.tsx`.
Holat: **native** — desktop ilovaning o'z ekrani, ma'lumot API'dan to'g'ridan-to'g'ri (Rust `api` proksi). Hech bir bo'lim web panelga yo'naltirmaydi.

| # | Web yo'l | Web ekran | Desktop ekran (`A.screens.*`) | Fayl | API | Holat |
|---|---|---|---|---|---|---|
| 1 | `/dashboard` | DashboardScreen | `dashboard` | ui/screens.js | /v1/dashboard, /v1/branches, /v1/approvals, /v1/suppliers, /v1/fomCashToday, /v1/aiEvents | native |
| 2 | `/branches` | BranchesScreen | `branches` | ui/screens/system.js | /v1/branches, branches.upsert/delete, /v1/edges/key | native |
| 3 | `/branches/[id]` | BranchScreen | `branches` (tafsilot paneli, `{id}`) | ui/screens/system.js | /v1/branches | native |
| 4 | `/sroklar` | ExpiryScreen | `expiry` | ui/screens/supply.js | /v1/expiry/near, /v1/expiry/writeoffs | native |
| 5 | `/cash` | CashScreen | `cash` | ui/screens.js | /v1/fomCashToday, /v1/settings, /v1/desktop, desk.cashClose, desk.resolveConflict | native |
| 6 | `/expenses` | ExpensesScreen | `expenses` | ui/screens/finance.js | /v1/expenses, expenses.create/cancel, /v1/settings | native |
| 7 | `/cashflow` | CashflowScreen | `cashflow` | ui/screens/finance.js | /v1/finance/cashflow | native |
| 8 | `/employees` | EmployeesScreen | `employees` | ui/screens/hr.js | /v1/employees, employees.upsert/dismiss/restore | native |
| 9 | `/employees/[id]` | EmployeeScreen | `employee` | ui/screens/hr.js | /v1/employees, /v1/aiEvents, /v1/audit | native |
| 10 | `/schedule` | ScheduleScreen | `schedule` | ui/screens/hr.js | /v1/schedule, /v1/swaps, schedule.setCell/save, swaps.decide | native |
| 11 | `/attendance` | AttendanceScreen | `attendance` | ui/screens/hr.js | /v1/employees, attendance.requestFix | native |
| 12 | `/live` | LiveScreen | `live` | ui/screens/control.js | /v1/branches, /v1/employees, /v1/cameras | native |
| 13 | `/payroll` | PayrollScreen | `payroll` | ui/screens/hr.js | /v1/payroll, payroll.recalc/review/lock/markPaid | native |
| 14 | `/payroll/rules` | PayrollRulesApiScreen | `payrollRules` | ui/screens/hr.js | /v1/payrollRules, payrollRules.* | native |
| 15 | `/suppliers` | SuppliersScreen | `suppliers` | ui/screens/supply.js | /v1/suppliers, suppliers.createPayment/upsert | native |
| 16 | `/tolovlar` | PayablesScreen | `payables` | ui/screens/supply.js | /v1/payables/* | native |
| 17 | `/doctors` | DoctorsScreen | `doctors` | ui/screens/supply.js | /v1/doctors, /v1/doctorSummaries, doctors.upsert/close | native |
| 18 | `/ai` | AIReviewScreen | `ai` | ui/screens/control.js | /v1/aiEvents, /v1/reviewedToday, ai.* | native |
| 19 | `/videowall` | VideoWallScreen | `videowall` | ui/screens/control.js | /v1/cameras, cameras.streamUrl, cameras.talk (HLS + ovoz + gapirish) | native |
| 20 | `/cameras` | CamerasScreen | `cameras` | ui/screens/control.js | /v1/cameras, cameras.create/update/setPrivacy/test/discover/streamUrl/talk | native |
| 21 | `/pnl` | PnlScreen | `pnl` | ui/screens/finance.js | /v1/finance/pnl | native |
| 22 | `/analytics` | AnalyticsScreen | `analytics` | ui/screens/finance.js | /v1/analytics/branches, staff, traffic, ai | native |
| 23 | `/forecast` | ForecastScreen | `forecast` | ui/screens/finance.js | /v1/finance/forecast | native |
| 24 | `/reports` | ReportsScreen | `reports` | ui/screens/finance.js | /v1/reports, /v1/files/reports/{id} | native |
| 25 | `/soliq` | SoliqScreen | `tax` | ui/screens/finance.js | /v1/soliq/* | native |
| 26 | `/approvals` | ApprovalsScreen | `approvals` | ui/screens.js | /v1/approvals, approvals.decide | native |
| 27 | `/notifications` | NotificationsScreen | `notifications` | ui/screens.js | /v1/notifications, notifications.markRead/markAllRead | native |
| 28 | `/audit` | AuditScreen | `audit` | ui/screens.js | /v1/audit | native |
| 29 | `/fom` | FomRealScreen | `fom` | ui/screens/system.js | /v1/fom/agents/*, /v1/fomMap | native |
| 30 | `/health` | HealthScreen | `health` | ui/screens/system.js | /v1/edges, /v1/branches | native |
| 31 | `/users` | UsersScreen | `users` | ui/screens/system.js | /v1/admin/users, users.*, tg.* | native |
| 32 | `/roles` | RolesApiScreen | `roles` | ui/screens/system.js | /v1/roles, roles.update | native |
| 33 | `/modules` | ModulesScreen | `modules` | ui/screens/system.js | /v1/workspace | native |
| 34 | `/ai-settings` | AiSettingsScreen | `aiSettings` | ui/screens/system.js | /v1/ai/settings, /v1/ai/models, /v1/ai/test | native |
| 35 | `/settings` | SettingsScreen | `settings` | ui/screens/system.js | /v1/settings, settings.saveLimits | native |
| 36 | `/settings?tab=profil` | Account / TelegramLink | `profile` | ui/screens/system.js | /v1/me, profile.*, /v1/auth/sessions, /v1/auth/logins, tg.* | native |
| — | `/employee-only` | Denied (EMPLOYEE) | `profile` + «mobil ilova» xabari | ui/screens/system.js | /v1/me | native |
| — | `/login` | LoginPage | native kirish (ov-login) | ui/index.html, ui/app.js | /v1/auth/* | native |

Rollar: menyu `ui/app.js` dagi `ACCESS` jadvali bo'yicha (web `packages/core/src/roles.ts` + `lib/nav.tsx`), ruxsatsiz bo'lim menyuda ko'rinmaydi va ochilmaydi; AUDITOR — faqat o'qish.
