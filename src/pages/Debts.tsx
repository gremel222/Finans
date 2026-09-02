import { debtById, debtTotals } from '../calc'
import { formatDate, formatMoney, todayISO } from '../format'
import { useStore } from '../store'
import { DEBT_TYPES, type Debt } from '../types'

function rowClass(t: string) {
  if (t.startsWith('Входящий')) return 'row-in'
  if (t.startsWith('Исходящий')) return 'row-out'
  if (t === 'Возврат мне') return 'row-back'
  if (t === 'Погашение мной') return 'row-pay'
  return ''
}

export default function Debts() {
  const { state, setDebts, setDebtorSlots, setCreditorSlots } = useStore()
  const totals = debtTotals(state.debts)
  const nextId = (rows: Debt[]) => (rows.reduce((m, o) => Math.max(m, o.id), 0) || 0) + 1

  function add() {
    setDebts((rows) => [
      {
        id: nextId(rows),
        date: todayISO(),
        type: 'Исходящий (я дал)',
        counterparty: '',
        account: '💵 Наличные',
        debtId: '',
        amount: '',
        dueDate: '',
        note: '',
      },
      ...rows,
    ])
  }

  function patch(id: number, p: Partial<Debt>) {
    setDebts((rows) => rows.map((r) => (r.id === id ? { ...r, ...p } : r)))
  }

  function slotTable(title: string, slots: string[], setSlots: (s: string[]) => void, kind: 'd' | 'c') {
    return (
      <div className="card">
        <h3>{title}</h3>
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>ID долга</th>
                <th>Сумма</th>
                <th>Отдано</th>
                <th>Остаток</th>
                <th>Срок</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((id, i) => {
                const b = debtById(state.debts, id)
                const overdue = Boolean(id) && b.rest > 0 && b.due && b.due < todayISO()
                return (
                  <tr key={kind + i} className={overdue ? 'row-overdue' : ''}>
                    <td>
                      <input
                        value={id}
                        placeholder="ID из реестра"
                        onChange={(e) => {
                          const next = [...slots]
                          next[i] = e.target.value
                          setSlots(next)
                        }}
                      />
                    </td>
                    <td className="right">{id ? formatMoney(b.amount) : ''}</td>
                    <td className="right">{id ? formatMoney(b.paid) : ''}</td>
                    <td className="right">{id ? formatMoney(b.rest) : ''}</td>
                    <td>{b.due ? formatDate(b.due) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Долги</h2>
          <p>Реальные должники Семёна уже занесены. Итого должны 29 380 ₽. Просрочка (остаток &gt; 0 и срок &lt; сегодня) — красным.</p>
        </div>
        <button className="btn" onClick={add}>
          + запись
        </button>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">🤲 Дал в долг — остаток</div>
          <div className="value">{formatMoney(totals.given)}</div>
          <div className="hint">Исходящий − возврат мне</div>
        </div>
        <div className="card kpi">
          <div className="label">✋ Взял в долг — остаток</div>
          <div className="value">{formatMoney(totals.taken)}</div>
          <div className="hint">Входящий − погашение мной</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Реестр</h3>
        <div className="table-wrap" style={{ maxHeight: 480 }}>
          <table className="data">
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Контрагент</th>
                <th>Счёт</th>
                <th>ID долга</th>
                <th>Сумма ₽</th>
                <th>Вернуть до</th>
                <th>Примечание</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.debts.map((d) => (
                <tr key={d.id} className={rowClass(d.type)}>
                  <td>{d.id}</td>
                  <td>
                    <input type="date" value={d.date} onChange={(e) => patch(d.id, { date: e.target.value })} />
                  </td>
                  <td>
                    <select value={d.type} onChange={(e) => patch(d.id, { type: e.target.value as Debt['type'] })}>
                      <option value="">—</option>
                      {DEBT_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={d.counterparty} onChange={(e) => patch(d.id, { counterparty: e.target.value })} />
                  </td>
                  <td>
                    <select value={d.account} onChange={(e) => patch(d.id, { account: e.target.value })}>
                      <option value="">—</option>
                      {state.settings.accounts.map((a) => (
                        <option key={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={d.debtId} onChange={(e) => patch(d.id, { debtId: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={d.amount}
                      onChange={(e) => patch(d.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input type="date" value={d.dueDate} onChange={(e) => patch(d.id, { dueDate: e.target.value })} />
                  </td>
                  <td>
                    <input value={d.note} onChange={(e) => patch(d.id, { note: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn danger small" onClick={() => setDebts((rows) => rows.filter((x) => x.id !== d.id))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        {slotTable('ДОЛЖНИКИ', state.debtorSlots, setDebtorSlots, 'd')}
        {slotTable('КРЕДИТОРЫ', state.creditorSlots, setCreditorSlots, 'c')}
      </div>
    </div>
  )
}
