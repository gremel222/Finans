import { useState } from 'react'
import { allBalances, cushionForecast, envelopeCards } from '../calc'
import { formatMoney, formatPct } from '../format'
import { useStore } from '../store'
import { MONTHS, YEARS } from '../types'

export default function Distribution() {
  const { state } = useStore()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear() >= 2026 ? now.getFullYear() : 2026)
  const [month, setMonth] = useState(now.getFullYear() >= 2026 ? now.getMonth() + 1 : 9)
  const env = envelopeCards(state, year, month)
  const bals = allBalances(state)
  const goals = bals.filter((b) => b.account.type === 'Цель' || b.account.envelope.includes('Сбережения'))

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Распределение</h2>
          <p>Конверты 15 / 35 / 50 / 0. База — факт дохода месяца, если его нет — план 360 000 ₽.</p>
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="muted">База месяца</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{formatMoney(env.base)}</div>
          </div>
          <div className={env.isPlan ? 'warn-box' : 'ok-box'}>
            {env.isPlan ? 'факта нет — показан план' : 'факт'}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {env.cards.map((c) => {
          const util = c.plan > 0 ? c.fact / c.plan : 0
          return (
            <div key={c.key} className="card env-card">
              <div className="env-head" style={{ background: c.color }}>
                {c.name} · {formatPct(c.percent)}
              </div>
              <div className="env-body">
                {c.stub && <p className="muted">0% — карточка-заглушка «на будущее».</p>}
                <div className="grid grid-3" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="muted">План ₽</div>
                    <b>{formatMoney(c.plan)}</b>
                  </div>
                  <div>
                    <div className="muted">Факт ₽</div>
                    <b>{formatMoney(c.fact)}</b>
                  </div>
                  <div>
                    <div className="muted">Освоение</div>
                    <b>{formatPct(util, 1)}</b>
                  </div>
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.min(100, util * 100)}%`, background: c.color }} />
                </div>
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="data" style={{ minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th>Статья</th>
                        <th>Сумма</th>
                        <th>Доля базы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.rows.map((r) => (
                        <tr key={r.name}>
                          <td>{r.name}</td>
                          <td className="right">{formatMoney(r.amount)}</td>
                          <td className="right">{env.base ? formatPct(r.amount / env.base, 1) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Прогресс целей</h3>
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Цель</th>
                <th>Баланс</th>
                <th>Цель ₽</th>
                <th>%</th>
                <th>Прогноз закрытия</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => {
                const pct = g.account.goal > 0 ? g.balance / g.account.goal : 0
                return (
                  <tr key={g.account.name}>
                    <td>{g.account.name}</td>
                    <td className="right">{formatMoney(g.balance)}</td>
                    <td className="right">{g.account.goal ? formatMoney(g.account.goal) : '—'}</td>
                    <td style={{ minWidth: 160 }}>
                      {g.account.goal ? formatPct(pct, 1) : '—'}
                      {g.account.goal > 0 && (
                        <div className="bar">
                          <span style={{ width: `${Math.min(100, pct * 100)}%`, background: '#4A6FA5' }} />
                        </div>
                      )}
                    </td>
                    <td>{g.account.name.includes('Подушка') ? cushionForecast(state) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
