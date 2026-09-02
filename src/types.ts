export type OpType = 'Доход' | 'Расход' | 'Перевод'
export type DebtType =
  | 'Входящий (я взял)'
  | 'Исходящий (я дал)'
  | 'Возврат мне'
  | 'Погашение мной'

export type CategoryGroup =
  | 'Активный доход'
  | 'Пассивный доход'
  | 'Постоянные расходы'
  | 'Переменные расходы'
  | 'Нежелательные расходы'

export interface Currency {
  code: string
  rate: number
}

export interface Category {
  name: string
  group: CategoryGroup | string
}

export interface Account {
  name: string
  type: string
  currency: string
  start: number
  envelope: string
  goal: number
}

export interface Envelope {
  name: string
  percent: number
}

export interface GoalShare {
  name: string
  share: number
}

export interface Subscription {
  id: string
  name: string
  amount: number
  day: number | ''
  active: boolean
}

export interface Credit {
  id: string
  bank: string
  payment: number | ''
  monthsLeft: number | ''
}

export interface Settings {
  currencies: Currency[]
  categories: Category[]
  accounts: Account[]
  envelopes: Envelope[]
  goalShares: GoalShare[]
  planIncome: number
  planExpense: number
  subscriptions: Subscription[]
  credits: Credit[]
}

export interface Operation {
  id: number
  date: string
  type: OpType | ''
  fromAccount: string
  toAccount: string
  group: string
  category: string
  amount: number | ''
  currency: string
  note: string
  example?: boolean
}

export interface Debt {
  id: number
  date: string
  type: DebtType | ''
  counterparty: string
  account: string
  debtId: string
  amount: number | ''
  dueDate: string
  note: string
}

export interface AppState {
  settings: Settings
  operations: Operation[]
  debts: Debt[]
  debtorSlots: string[]
  creditorSlots: string[]
}

export const OP_TYPES: OpType[] = ['Доход', 'Расход', 'Перевод']
export const DEBT_TYPES: DebtType[] = [
  'Входящий (я взял)',
  'Исходящий (я дал)',
  'Возврат мне',
  'Погашение мной',
]
export const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
export const YEARS = Array.from({ length: 15 }, (_, i) => 2026 + i)
export const GROUPS: CategoryGroup[] = [
  'Активный доход',
  'Пассивный доход',
  'Постоянные расходы',
  'Переменные расходы',
  'Нежелательные расходы',
]
