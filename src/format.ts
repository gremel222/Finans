import { MONTHS } from './types'

export function formatMoney(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—'
  return (
    n.toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + ' ₽'
  )
}

export function formatPct(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—'
  return (
    (n * 100).toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + '%'
  )
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

export function todayISO(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addMonths(isoOrDate: string | Date, months: number): Date {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate + 'T00:00:00') : new Date(isoOrDate)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < day) d.setDate(0)
  return d
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
