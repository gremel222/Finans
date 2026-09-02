import { GOAL_ACCOUNTS, KEY_VARIABLE_CATEGORIES } from './defaults'
import { addMonths, daysInMonth, formatMonthYear, round2, todayISO } from './format'
import type { Account, AppState, Debt, Operation, Settings } from './types'
import { MONTHS } from './types'

export function ratesMap(settings: Settings): Record<string, number> {
  const m: Record<string, number> = {}
  for (const c of settings.currencies) m[c.code] = Number(c.rate) || 0
  return m
}

export function toRub(op: Pick<Operation, 'amount' | 'currency'>, rates: Record<string, number>): number {
  const amount = typeof op.amount === 'number' ? op.amount : 0
  if (!amount) return 0
  const rate = rates[op.currency] ?? 1
  return round2(amount * rate)
}

export function opFilled(op: Operation): boolean {
  return Boolean(op.date && op.type && op.amount !== '' && op.amount !== 0)
}

export function inYearMonth(iso: string, year: number, month: number): boolean {
  if (!iso) return false
  const [y, m] = iso.split('-').map(Number)
  return y === year && m === month
}

export function categoryGroupOf(name: string, settings: Settings): string {
  return settings.categories.find((c) => c.name === name)?.group ?? ''
}

export function groupMismatch(op: Operation, settings: Settings): boolean {
  if (!op.category || !op.group) return false
  const expected = categoryGroupOf(op.category, settings)
  return Boolean(expected) && expected !== op.group
}

export function accountBalance(account: Account, ops: Operation[], rates: Record<string, number>): number {
  let bal = Number(account.start) || 0
  for (const op of ops) {
    if (!opFilled(op)) continue
    const rub = toRub(op, rates)
    if (op.type === 'Доход' && op.fromAccount === account.name) bal += rub
    if (op.type === 'Расход' && op.fromAccount === account.name) bal -= rub
    if (op.type === 'Перевод') {
      if (op.fromAccount === account.name) bal -= rub
      if (op.toAccount === account.name) bal += rub
    }
  }
  return round2(bal)
}

export function allBalances(state: AppState) {
  const rates = ratesMap(state.settings)
  return state.settings.accounts.map((a) => ({
    account: a,
    balance: accountBalance(a, state.operations, rates),
  }))
}

export function totalBalance(state: AppState): number {
  const rates = ratesMap(state.settings)
  const starts = state.settings.accounts.reduce((s, a) => s + (Number(a.start) || 0), 0)
  let income = 0
  let expense = 0
  for (const op of state.operations) {
    if (!opFilled(op)) continue
    const rub = toRub(op, rates)
    if (op.type === 'Доход') income += rub
    if (op.type === 'Расход') expense += rub
  }
  return round2(starts + income - expense)
}

export function monthIncome(state: AppState, year: number, month: number): number {
  const rates = ratesMap(state.settings)
  return round2(
    state.operations
      .filter((op) => opFilled(op) && op.type === 'Доход' && inYearMonth(op.date, year, month))
      .reduce((s, op) => s + toRub(op, rates), 0),
  )
}

export function monthExpense(state: AppState, year: number, month: number): number {
  const rates = ratesMap(state.settings)
  return round2(
    state.operations
      .filter((op) => opFilled(op) && op.type === 'Расход' && inYearMonth(op.date, year, month))
      .reduce((s, op) => s + toRub(op, rates), 0),
  )
}

export function monthExpenseToday(state: AppState, today = todayISO()): number {
  const rates = ratesMap(state.settings)
  return round2(
    state.operations
      .filter((op) => opFilled(op) && op.type === 'Расход' && op.date === today)
      .reduce((s, op) => s + toRub(op, rates), 0),
  )
}

export function envelopeBase(state: AppState, year: number, month: number): { base: number; isPlan: boolean } {
  const fact = monthIncome(state, year, month)
  if (fact === 0) return { base: Number(state.settings.planIncome) || 0, isPlan: true }
  return { base: fact, isPlan: false }
}

export function sumExpenseGroup(state: AppState, year: number, month: number, groups: string[]): number {
  const rates = ratesMap(state.settings)
  return round2(
    state.operations
      .filter(
        (op) =>
          opFilled(op) &&
          op.type === 'Расход' &&
          inYearMonth(op.date, year, month) &&
          groups.includes(op.group),
      )
      .reduce((s, op) => s + toRub(op, rates), 0),
  )
}

export function sumExpenseCategory(state: AppState, year: number, month: number, category: string): number {
  const rates = ratesMap(state.settings)
  return round2(
    state.operations
      .filter(
        (op) =>
          opFilled(op) &&
          op.type === 'Расход' &&
          inYearMonth(op.date, year, month) &&
          op.category === category,
      )
      .reduce((s, op) => s + toRub(op, rates), 0),
  )
}

export function sumTransfersTo(state: AppState, year: number, month: number, account: string): number {
  const rates = ratesMap(state.settings)
  return round2(
    state.operations
      .filter(
        (op) =>
          opFilled(op) &&
          op.type === 'Перевод' &&
          inYearMonth(op.date, year, month) &&
          op.toAccount === account,
      )
      .reduce((s, op) => s + toRub(op, rates), 0),
  )
}

export function daysLeftInMonth(year: number, month: number, today = new Date()): number {
  const dim = daysInMonth(year, month)
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month
  if (isCurrent) return dim - today.getDate() + 1
  return dim
}

export function dailyLimit(state: AppState, year: number, month: number) {
  const plan = Number(state.settings.planExpense) || 0
  const fact = monthExpense(state, year, month)
  const todaySpent = monthExpenseToday(state)
  const daysLeft = Math.max(1, daysLeftInMonth(year, month))
  const limit = Math.max(0, plan - fact) / daysLeft
  const inLimit = todaySpent <= limit
  return { plan, fact, todaySpent, daysLeft, limit, inLimit }
}

export function creditSignal(state: AppState, year: number, month: number): string {
  const sum = sumExpenseCategory(state, year, month, 'Кредиты и рассрочки')
  if (sum > 0 && sum < 25000) {
    return 'Похоже, кредит почти закрыт — направь разницу в цели (конверты можно перестроить 15/20/65/0)'
  }
  return ''
}

export function yearMonthStats(state: AppState, year: number) {
  const planI = Number(state.settings.planIncome) || 0
  const planE = Number(state.settings.planExpense) || 0
  let cap = 0
  return MONTHS.map((name, i) => {
    const month = i + 1
    const income = monthIncome(state, year, month)
    const expense = monthExpense(state, year, month)
    const saldo = round2(income - expense)
    cap = round2(cap + saldo)
    return {
      month,
      name,
      income,
      planIncome: planI,
      expense,
      planExpense: planE,
      saldo,
      capitalization: cap,
    }
  })
}

export function top10Expenses(state: AppState, year: number, month: number) {
  const rates = ratesMap(state.settings)
  const map = new Map<string, number>()
  for (const op of state.operations) {
    if (!opFilled(op) || op.type !== 'Расход' || !inYearMonth(op.date, year, month)) continue
    if (!op.category) continue
    map.set(op.category, round2((map.get(op.category) || 0) + toRub(op, rates)))
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
}

export function archiveRows(state: AppState) {
  const rates = ratesMap(state.settings)
  let cap = 0
  return Array.from({ length: 15 }, (_, i) => 2026 + i).map((year) => {
    let income = 0
    let expense = 0
    let count = 0
    for (const op of state.operations) {
      if (!opFilled(op) || !op.date.startsWith(String(year))) continue
      count += 1
      const rub = toRub(op, rates)
      if (op.type === 'Доход') income += rub
      if (op.type === 'Расход') expense += rub
    }
    income = round2(income)
    expense = round2(expense)
    const saldo = round2(income - expense)
    cap = round2(cap + saldo)
    return {
      year,
      income,
      expense,
      saldo,
      capitalization: cap,
      avgExpense: round2(expense / 12),
      count,
    }
  })
}

export function debtTotals(debts: Debt[]) {
  const sum = (type: string) =>
    debts.reduce((s, d) => (d.type === type && typeof d.amount === 'number' ? s + d.amount : s), 0)
  const given = round2(sum('Исходящий (я дал)') - sum('Возврат мне'))
  const taken = round2(sum('Входящий (я взял)') - sum('Погашение мной'))
  return { given, taken }
}

export function debtById(debts: Debt[], debtId: string) {
  if (!debtId) return { amount: 0, paid: 0, rest: 0, due: '' }
  let amount = 0
  let paid = 0
  let due = ''
  for (const d of debts) {
    if (d.debtId !== debtId) continue
    const n = typeof d.amount === 'number' ? d.amount : 0
    if (d.type === 'Исходящий (я дал)' || d.type === 'Входящий (я взял)') {
      amount += n
      if (d.dueDate && (!due || d.dueDate < due)) due = d.dueDate
    }
    if (d.type === 'Возврат мне' || d.type === 'Погашение мной') paid += n
  }
  return { amount: round2(amount), paid: round2(paid), rest: round2(amount - paid), due }
}

export function cushionForecast(state: AppState): string {
  const rates = ratesMap(state.settings)
  const acc = state.settings.accounts.find((a) => a.name === '🛡 Подушка безопасности')
  if (!acc) return '—'
  const bal = accountBalance(acc, state.operations, rates)
  const goal = acc.goal || 540000
  if (bal >= goal) return '✅ выполнена'
  const plan = Number(state.settings.planIncome) || 0
  const savePct = (state.settings.envelopes.find((e) => e.name.includes('Сбережения'))?.percent ?? 50) / 100
  const share = (state.settings.goalShares.find((g) => g.name.includes('Подушка'))?.share ?? 50) / 100
  const monthly = plan * savePct * share
  if (monthly <= 0) return '—'
  const months = Math.ceil((goal - bal) / monthly)
  try {
    return formatMonthYear(addMonths(new Date(), months))
  } catch {
    return '—'
  }
}

export function closeDate(monthsLeft: number | ''): string {
  if (monthsLeft === '' || monthsLeft === null || Number(monthsLeft) < 0) return ''
  const d = addMonths(todayISO(), Number(monthsLeft))
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

export function envelopeCards(state: AppState, year: number, month: number) {
  const { base, isPlan } = envelopeBase(state, year, month)
  const [ob, va, sa, inv] = state.settings.envelopes
  const fixedCats = state.settings.categories.filter((c) => c.group === 'Постоянные расходы')
  const factOb = sumExpenseGroup(state, year, month, ['Постоянные расходы'])
  const factVa = sumExpenseGroup(state, year, month, ['Переменные расходы', 'Нежелательные расходы'])
  const transfers = GOAL_ACCOUNTS.map((name) => ({
    name,
    amount: sumTransfersTo(state, year, month, name),
  }))
  const factSa = round2(transfers.reduce((s, t) => s + t.amount, 0))
  const keyRows = KEY_VARIABLE_CATEGORIES.map((name) => ({
    name,
    amount: sumExpenseCategory(state, year, month, name),
  }))
  const keySum = keyRows.reduce((s, r) => s + r.amount, 0)
  return {
    base,
    isPlan,
    cards: [
      {
        key: 'ob',
        name: ob?.name ?? '🏠 Обязательные',
        percent: (ob?.percent ?? 15) / 100,
        color: '#F5A623',
        fact: factOb,
        plan: round2(base * ((ob?.percent ?? 15) / 100)),
        rows: fixedCats.map((c) => ({
          name: c.name,
          amount: sumExpenseCategory(state, year, month, c.name),
        })),
        stub: false,
      },
      {
        key: 'va',
        name: va?.name ?? '🛍 Переменные',
        percent: (va?.percent ?? 35) / 100,
        color: '#2E9E6B',
        fact: factVa,
        plan: round2(base * ((va?.percent ?? 35) / 100)),
        rows: [
          ...keyRows,
          { name: 'Прочее (остальные)', amount: round2(factVa - keySum) },
        ],
        stub: false,
      },
      {
        key: 'sa',
        name: sa?.name ?? '🎯 Сбережения и цели',
        percent: (sa?.percent ?? 50) / 100,
        color: '#4A6FA5',
        fact: factSa,
        plan: round2(base * ((sa?.percent ?? 50) / 100)),
        rows: transfers,
        stub: false,
      },
      {
        key: 'inv',
        name: inv?.name ?? '📈 Инвестиции',
        percent: (inv?.percent ?? 0) / 100,
        color: '#7A5C9E',
        fact: 0,
        plan: round2(base * ((inv?.percent ?? 0) / 100)),
        rows: [{ name: 'На будущее — карточка-заглушка', amount: 0 }],
        stub: true,
      },
    ],
  }
}

export function autoReports(state: AppState, year: number, month: number, daysLeft: number) {
  const planI = Number(state.settings.planIncome) || 0
  const planE = Number(state.settings.planExpense) || 0
  const factI = monthIncome(state, year, month)
  const factE = monthExpense(state, year, month)
  const income =
    factI >= planI
      ? `🔥 План дохода перевыполнен на ${factI - planI} ₽ (${(((factI - planI) / (planI || 1)) * 100).toFixed(1)}%). Так держать!`
      : `До плана не хватает ${(planI - factI).toLocaleString('ru-RU')} ₽. Осталось ${daysLeft} дн.`
  const expense =
    factE <= planE
      ? `✅ Расходы в рамках плана. Маржа ${(planE - factE).toLocaleString('ru-RU')} ₽ (${(((planE - factE) / (planE || 1)) * 100).toFixed(1)}%).`
      : `⚠️ План расхода превышен на ${(factE - planE).toLocaleString('ru-RU')} ₽. Придержи траты до конца месяца.`
  return { income, expense }
}
