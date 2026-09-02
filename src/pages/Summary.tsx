import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  allBalances,
  autoReports,
  creditSignal,
  dailyLimit,
  debtTotals,
  envelopeBase,
  monthExpense,
  monthIncome,
  top10Expenses,
  totalBalance,
  yearMonthStats,
} from '../calc'
import { formatMoney, formatPct } from '../format'
import { useStore } from '../store'
import { MONTHS, YEARS } from '../types'

const PIE_COLORS = ['#26A69A', '#5C6BC0', '#FFB300', '#66BB6A', '#AB47BC', '#8D6E63', '#42A5F5', '#EF5350', '#26C6DA', '#9CCC65', '#7E57C2', '#FFA726']

export default function Summary() {
  const { state } = useStore()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear() >= 2026 ? now.getFullYear() : 2026)
  const [month, setMonth] = useState(now.getFullYear() >= 2026 ? now.getMonth() + 1 : 9)

  const income = monthIncome(state, year, month)
  const expense = monthExpense(state, year, month)
  const total = totalBalance(state)
  const debts = debtTotals(state.debts)
  const bals = allBalances(state)
  const balsSum = bals.reduce((s, b) => s + b.balance, 0)
  const pie = bals.filter((b) => b.balance > 0).map((b) => ({ name: b.account.name, value: b.balance }))
  const limit = dailyLimit(state, year, month)
  const { base } = envelopeBase(state, year, month)
  const savePct = (state.settings.envelopes.find((e) => e.name.includes('Сбережения'))?.percent ?? 50) / 100
  const pay = base * savePct
  const shares = state.settings.goalShares
  const signal = creditSignal(state, year, month)
  const months = yearMonthStats(state, year)
  const top = top10Expenses(state, year, month)
  const report = autoReports(state, year, month, limit.daysLeft)

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Сводка</h2>
          <p>Главный экран. Селекторы года и месяца фильтруют карточки, лимит, план/факт и топ-10.</p>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Kpi icon="⚖" label="Общий баланс" value={formatMoney(total, 2)} hint="Σ старт + доходы − расходы. Переводы нейтральны." />
        <Kpi icon="💰" label="Доходы за месяц" value={formatMoney(income)} />
        <Kpi icon="🧾" label="Расходы за месяц" value={formatMoney(expense, 2)} />
        <Kpi icon="🤲" label="Мне должны" value={formatMoney(debts.given)} hint="С листа Долги" />
        <Kpi icon="✋" label="Я должен" value={formatMoney(debts.taken)} />
        <Kpi icon="Δ" label="Сальдо месяца" value={formatMoney(income - expense, 2)} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Баланс по счетам</h3>
          <div className="table-wrap" style={{ maxHeight: 320 }}>
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Счёт</th>
                  <th>Баланс ₽</th>
                </tr>
              </thead>
              <tbody>
                {bals.map((b) => (
                  <tr key={b.account.name}>
                    <td>{b.account.name}</td>
                    <td className={`right ${b.balance < 0 ? 'neg' : ''}`}>{formatMoney(b.balance, 2)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>ИТОГО</b>
                  </td>
                  <td className="right">
                    <b>{formatMoney(balsSum, 2)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Сверка с карточкой общего баланса: {formatMoney(total, 2)} {Math.abs(balsSum - total) < 0.05 ? '✓' : '⚠️ расхождение'}
          </p>
        </div>
        <div className="card">
          <h3>Кольцевая — счета</h3>
          <div className="chart-box">
            {pie.length === 0 ? (
              <p className="muted">Нет положительных остатков — внеси старты или доходы.</p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={1}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>⏱ Дневной лимит трат</h3>
          <div className="grid grid-2">
            <div>
              <div className="muted">План расхода</div>
              <b>{formatMoney(limit.plan)}</b>
            </div>
            <div>
              <div className="muted">Факт расхода мес</div>
              <b>{formatMoney(limit.fact, 2)}</b>
            </div>
            <div>
              <div className="muted">Потрачено сегодня</div>
              <b>{formatMoney(limit.todaySpent, 2)}</b>
            </div>
            <div>
              <div className="muted">Осталось дней</div>
              <b>{limit.daysLeft}</b>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '12px 0 8px' }}>{formatMoney(limit.limit, 2)} / день</div>
          <div className={limit.inLimit ? 'ok-box' : 'warn-box'}>
            {limit.inLimit ? '✅ Сегодня ты в лимите' : '🔥 Сегодня выше лимита'}
          </div>
        </div>

        <div className="card">
          <h3>💸 Плати себе первым</h3>
          <p>
            Отложи из дохода месяца: <b>{formatMoney(pay)}</b> (база × {formatPct(savePct)})
          </p>
          <ul className="plain">
            {shares.map((sh) => (
              <li key={sh.name}>
                {sh.name} = {formatMoney(pay * (sh.share / 100))} ({sh.share}%)
              </li>
            ))}
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>
            После поступления ЗП (15/30) оформи переводы — и трать остаток свободно.
          </p>
        </div>
      </div>

      {signal && <div className="warn-box" style={{ marginBottom: 16 }}>{signal}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>📝 Авто-отчёт</h3>
        <p>{report.income}</p>
        <p style={{ marginBottom: 0 }}>{report.expense}</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>План / факт по месяцам {year}</h3>
          <div className="table-wrap" style={{ maxHeight: 360 }}>
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th>Доход факт</th>
                  <th>Доход план</th>
                  <th>Расход факт</th>
                  <th>Расход план</th>
                  <th>Сальдо</th>
                  <th>Капитализация</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.name}</td>
                    <td className="right">{formatMoney(m.income)}</td>
                    <td className="right">{formatMoney(m.planIncome)}</td>
                    <td className="right">{formatMoney(m.expense, 2)}</td>
                    <td className="right">{formatMoney(m.planExpense)}</td>
                    <td className={`right ${m.saldo < 0 ? 'neg' : ''}`}>{formatMoney(m.saldo, 2)}</td>
                    <td className="right">{formatMoney(m.capitalization, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Гистограмма доход / расход</h3>
          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}к`} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend />
                <Bar dataKey="income" name="Доход факт" fill="#66BB6A" />
                <Bar dataKey="expense" name="Расход факт" fill="#EF5350" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>🔝 Топ-10 расходов месяца</h3>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Категория</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {top.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Нет расходов за выбранный месяц
                    </td>
                  </tr>
                )}
                {top.map((t, i) => (
                  <tr key={t.name}>
                    <td>{i + 1}</td>
                    <td>{t.name}</td>
                    <td className="right">{formatMoney(t.amount, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Линейчатая — топ расходов</h3>
          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={[...top].reverse()} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatMoney(v)} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Bar dataKey="amount" name="Сумма" fill="#5C6BC0" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <div className="card kpi">
      <div className="label">
        {icon} {label}
      </div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
