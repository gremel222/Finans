import { useMemo, useState } from 'react'
import { groupMismatch, ratesMap, toRub } from '../calc'
import { formatMoney, todayISO } from '../format'
import { useStore } from '../store'
import { GROUPS, MONTHS, OP_TYPES, YEARS, type Operation } from '../types'

const emptyOp = (): Operation => ({
  id: 0,
  date: todayISO(),
  type: 'Расход',
  fromAccount: '',
  toAccount: '',
  group: '',
  category: '',
  amount: '',
  currency: 'RUB',
  note: '',
})

export default function Operations() {
  const { state, setOperations } = useStore()
  const [draft, setDraft] = useState<Operation>(emptyOp)
  const [q, setQ] = useState('')
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(0)
  const [type, setType] = useState('')
  const rates = ratesMap(state.settings)
  const cats = state.settings.categories.filter((c) => !draft.group || c.group === draft.group)

  const nextId = (ops: Operation[]) => (ops.reduce((m, o) => Math.max(m, o.id), 0) || 0) + 1

  function add() {
    if (!draft.date || !draft.type || draft.amount === '') {
      alert('Нужны дата, тип и сумма')
      return
    }
    if (draft.date < '2026-01-01' || draft.date > '2040-12-31') {
      if (!confirm('Дата вне 2026–2040. Всё равно сохранить?')) return
    }
    setOperations((ops) => [{ ...draft, id: nextId(ops), amount: Number(draft.amount) }, ...ops])
    setDraft(emptyOp())
  }

  const rows = useMemo(() => {
    return state.operations.filter((op) => {
      if (year && op.date && !op.date.startsWith(String(year))) return false
      if (month && op.date && Number(op.date.slice(5, 7)) !== month) return false
      if (type && op.type !== type) return false
      if (q) {
        const hay = `${op.note} ${op.category} ${op.fromAccount} ${op.toAccount} ${op.group}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [state.operations, q, year, month, type])

  const rowClass = (op: Operation) => {
    if (op.type === 'Доход') return 'row-income'
    if (op.type === 'Расход') return 'row-expense'
    if (op.type === 'Перевод') return 'row-transfer'
    return ''
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Операции</h2>
          <p>Единый журнал 2026–2040. Курс и сумма ₽ считаются сами. Перевод: оба счёта, группа/категория пустые.</p>
        </div>
        <button
          className="btn ghost"
          onClick={() => {
            if (confirm('Удалить строки с пометкой «пример»?')) {
              setOperations((ops) => ops.filter((o) => !o.example && !o.note.startsWith('пример')))
            }
          }}
        >
          Удалить примеры
        </button>
      </div>

      <div className="card">
        <h3>Новая запись</h3>
        <div className="form-grid">
          <label className="field">
            Дата
            <input type="date" min="2026-01-01" max="2040-12-31" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <label className="field">
            Тип
            <select
              value={draft.type}
              onChange={(e) => {
                const t = e.target.value as Operation['type']
                setDraft({
                  ...draft,
                  type: t,
                  group: t === 'Перевод' ? '' : draft.group,
                  category: t === 'Перевод' ? '' : draft.category,
                  toAccount: t === 'Перевод' ? draft.toAccount : '',
                })
              }}
            >
              {OP_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Со счёта
            <select value={draft.fromAccount} onChange={(e) => setDraft({ ...draft, fromAccount: e.target.value })}>
              <option value="">—</option>
              {state.settings.accounts.map((a) => (
                <option key={a.name}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            На счёт / цель
            <select
              value={draft.toAccount}
              disabled={draft.type !== 'Перевод'}
              onChange={(e) => setDraft({ ...draft, toAccount: e.target.value })}
            >
              <option value="">—</option>
              {state.settings.accounts.map((a) => (
                <option key={a.name}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Группа
            <select
              disabled={draft.type === 'Перевод'}
              value={draft.group}
              onChange={(e) => setDraft({ ...draft, group: e.target.value, category: '' })}
            >
              <option value="">—</option>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Категория
            <select
              disabled={draft.type === 'Перевод'}
              value={draft.category}
              onChange={(e) => {
                const name = e.target.value
                const g = state.settings.categories.find((c) => c.name === name)?.group ?? draft.group
                setDraft({ ...draft, category: name, group: g })
              }}
            >
              <option value="">—</option>
              {cats.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Сумма
            <input
              type="number"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Валюта
            <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
              {state.settings.currencies.map((c) => (
                <option key={c.code}>{c.code}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Курс
            <input readOnly value={rates[draft.currency] ?? 1} />
          </label>
          <label className="field">
            Сумма ₽
            <input readOnly value={draft.amount === '' ? '' : toRub(draft, rates)} />
          </label>
          <label className="field span-2">
            Примечание
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
        </div>
        <button className="btn" onClick={add}>
          Добавить операцию
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            <option value={0}>Все месяцы</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Все типы</option>
            {OP_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input className="input" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">{rows.length} записей</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 640 }}>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Со счёта</th>
                <th>На счёт / цель</th>
                <th>Группа</th>
                <th>Категория</th>
                <th>Сумма</th>
                <th>Валюта</th>
                <th>Курс</th>
                <th>Сумма ₽</th>
                <th>Примечание</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((op) => {
                const mismatch = groupMismatch(op, state.settings)
                return (
                  <tr key={op.id} className={rowClass(op)}>
                    <td>{op.id}</td>
                    <td>
                      <input
                        type="date"
                        value={op.date}
                        onChange={(e) =>
                          setOperations((ops) => ops.map((x) => (x.id === op.id ? { ...x, date: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td>{op.type}</td>
                    <td>{op.fromAccount}</td>
                    <td>{op.toAccount}</td>
                    <td>{op.group}</td>
                    <td className={mismatch ? 'flag' : ''}>{op.category}</td>
                    <td className="right">{op.amount}</td>
                    <td>{op.currency}</td>
                    <td>{op.amount === '' ? '' : rates[op.currency] ?? 1}</td>
                    <td className="right">{op.amount === '' ? '' : formatMoney(toRub(op, rates), 2)}</td>
                    <td>
                      <input
                        value={op.note}
                        onChange={(e) =>
                          setOperations((ops) => ops.map((x) => (x.id === op.id ? { ...x, note: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="btn danger small"
                        onClick={() => setOperations((ops) => ops.filter((x) => x.id !== op.id))}
                      >
                        ×
                      </button>
                    </td>
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
