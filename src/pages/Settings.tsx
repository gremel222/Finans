import { closeDate } from '../calc'
import { uid } from '../format'
import { useStore } from '../store'
import { GROUPS } from '../types'

function numOrEmpty(v: string): number | '' {
  if (v === '') return ''
  return Number(v)
}

export default function SettingsPage() {
  const { state, setSettings, resetAll, exportJson, importJson } = useStore()
  const s = state.settings
  const envSum = s.envelopes.reduce((n, e) => n + Number(e.percent || 0), 0)
  const shareSum = s.goalShares.reduce((n, e) => n + Number(e.share || 0), 0)

  function downloadBackup() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fintracker-semyon-backup.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Настройки</h2>
          <p>Справочники. Вводимые ячейки — кремовые. Списки отсюда питают все остальные экраны.</p>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn ghost" onClick={downloadBackup}>
            Скачать копию
          </button>
          <label className="btn ghost" style={{ margin: 0 }}>
            Импорт JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const ok = importJson(await f.text())
                alert(ok ? 'Данные загружены' : 'Файл не подошёл')
                e.target.value = ''
              }}
            />
          </label>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Сбросить всё к заводским данным (примеры + долги Семёна)?')) resetAll()
            }}
          >
            Сброс
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Курсы валют</h3>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Валюта</th>
                  <th>Курс к ₽</th>
                </tr>
              </thead>
              <tbody>
                {s.currencies.map((c, i) => (
                  <tr key={c.code}>
                    <td>{c.code}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={c.rate}
                        onChange={(e) => {
                          const currencies = s.currencies.map((x, j) =>
                            j === i ? { ...x, rate: Number(e.target.value) } : x,
                          )
                          setSettings({ currencies })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Демо-курсы, редактируются. RUB всегда 1.
          </p>
        </div>

        <div className="card">
          <h3>Планы на месяц</h3>
          <div className="grid grid-2">
            <label className="field">
              План дохода
              <input
                type="number"
                value={s.planIncome}
                onChange={(e) => setSettings({ planIncome: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              План расхода
              <input
                type="number"
                value={s.planExpense}
                onChange={(e) => setSettings({ planExpense: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="muted">Ориентир при ЗП 360 000 ₽: обязательные 54 000 · переменные 126 000 · сбережения 180 000 · инвестиции 0.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>
          Конверты «%»{' '}
          <span className={envSum === 100 ? 'pos' : 'pct-bad'}>сумма {envSum}% {envSum === 100 ? '' : '— должно быть 100%'}</span>
        </h3>
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Конверт</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {s.envelopes.map((e, i) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>
                    <input
                      type="number"
                      value={e.percent}
                      onChange={(ev) => {
                        const envelopes = s.envelopes.map((x, j) =>
                          j === i ? { ...x, percent: Number(ev.target.value) } : x,
                        )
                        setSettings({ envelopes })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>
          Доли целей{' '}
          <span className={shareSum === 100 ? 'pos' : 'pct-bad'}>сумма {shareSum}%</span>
        </h3>
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Цель</th>
                <th>Доля %</th>
              </tr>
            </thead>
            <tbody>
              {s.goalShares.map((e, i) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>
                    <input
                      type="number"
                      value={e.share}
                      onChange={(ev) => {
                        const goalShares = s.goalShares.map((x, j) =>
                          j === i ? { ...x, share: Number(ev.target.value) } : x,
                        )
                        setSettings({ goalShares })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Счета</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Счёт</th>
                <th>Тип</th>
                <th>Валюта</th>
                <th>Старт ₽</th>
                <th>Конверт</th>
                <th>Цель ₽</th>
              </tr>
            </thead>
            <tbody>
              {s.accounts.map((a, i) => (
                <tr key={a.name}>
                  <td>
                    <input
                      value={a.name}
                      onChange={(e) => {
                        const accounts = s.accounts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                        setSettings({ accounts })
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={a.type}
                      onChange={(e) => {
                        const accounts = s.accounts.map((x, j) => (j === i ? { ...x, type: e.target.value } : x))
                        setSettings({ accounts })
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={a.currency}
                      onChange={(e) => {
                        const accounts = s.accounts.map((x, j) => (j === i ? { ...x, currency: e.target.value } : x))
                        setSettings({ accounts })
                      }}
                    >
                      {s.currencies.map((c) => (
                        <option key={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={a.start}
                      onChange={(e) => {
                        const accounts = s.accounts.map((x, j) =>
                          j === i ? { ...x, start: Number(e.target.value) } : x,
                        )
                        setSettings({ accounts })
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={a.envelope}
                      onChange={(e) => {
                        const accounts = s.accounts.map((x, j) => (j === i ? { ...x, envelope: e.target.value } : x))
                        setSettings({ accounts })
                      }}
                    >
                      <option value="">—</option>
                      {s.envelopes.map((en) => (
                        <option key={en.name}>{en.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={a.goal}
                      onChange={(e) => {
                        const accounts = s.accounts.map((x, j) =>
                          j === i ? { ...x, goal: Number(e.target.value) } : x,
                        )
                        setSettings({ accounts })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="btn ghost small"
          style={{ marginTop: 10 }}
          onClick={() =>
            setSettings({
              accounts: [
                ...s.accounts,
                { name: 'Новый счёт', type: 'Карта', currency: 'RUB', start: 0, envelope: '', goal: 0 },
              ],
            })
          }
        >
          + счёт
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Категории</h3>
        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Категория</th>
                <th>Группа</th>
              </tr>
            </thead>
            <tbody>
              {s.categories.map((c, i) => (
                <tr key={c.name + i}>
                  <td>
                    <input
                      value={c.name}
                      onChange={(e) => {
                        const categories = s.categories.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                        setSettings({ categories })
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={c.group}
                      onChange={(e) => {
                        const categories = s.categories.map((x, j) => (j === i ? { ...x, group: e.target.value } : x))
                        setSettings({ categories })
                      }}
                    >
                      {GROUPS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="btn ghost small"
          style={{ marginTop: 10 }}
          onClick={() =>
            setSettings({
              categories: [...s.categories, { name: 'Новая категория', group: 'Переменные расходы' }],
            })
          }
        >
          + категория (в конец справочника)
        </button>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Ревизор подписок</h3>
          <p className="muted">Памятка: пересмотр раз в квартал.</p>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>₽/мес</th>
                  <th>День</th>
                  <th>Активна</th>
                </tr>
              </thead>
              <tbody>
                {s.subscriptions.map((sub, i) => (
                  <tr key={sub.id}>
                    <td>
                      <input
                        value={sub.name}
                        onChange={(e) => {
                          const subscriptions = s.subscriptions.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          )
                          setSettings({ subscriptions })
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={sub.amount}
                        onChange={(e) => {
                          const subscriptions = s.subscriptions.map((x, j) =>
                            j === i ? { ...x, amount: Number(e.target.value) } : x,
                          )
                          setSettings({ subscriptions })
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={sub.day}
                        onChange={(e) => {
                          const subscriptions = s.subscriptions.map((x, j) =>
                            j === i ? { ...x, day: numOrEmpty(e.target.value) } : x,
                          )
                          setSettings({ subscriptions })
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={sub.active}
                        onChange={(e) => {
                          const subscriptions = s.subscriptions.map((x, j) =>
                            j === i ? { ...x, active: e.target.checked } : x,
                          )
                          setSettings({ subscriptions })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn ghost small"
            style={{ marginTop: 10 }}
            onClick={() =>
              setSettings({
                subscriptions: [...s.subscriptions, { id: uid('sub'), name: '', amount: 0, day: '', active: true }],
              })
            }
          >
            + подписка
          </button>
        </div>

        <div className="card">
          <h3>Трекер кредитов</h3>
          <p className="muted">Колонка «Закроется» = сегодня + осталось мес. Пусто, если нет данных.</p>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Кредит (банк)</th>
                  <th>Платёж ₽/мес</th>
                  <th>Осталось мес.</th>
                  <th>Закроется</th>
                </tr>
              </thead>
              <tbody>
                {s.credits.map((cr, i) => (
                  <tr key={cr.id}>
                    <td>
                      <input
                        value={cr.bank}
                        onChange={(e) => {
                          const credits = s.credits.map((x, j) => (j === i ? { ...x, bank: e.target.value } : x))
                          setSettings({ credits })
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={cr.payment}
                        onChange={(e) => {
                          const credits = s.credits.map((x, j) =>
                            j === i ? { ...x, payment: numOrEmpty(e.target.value) } : x,
                          )
                          setSettings({ credits })
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={cr.monthsLeft}
                        onChange={(e) => {
                          const credits = s.credits.map((x, j) =>
                            j === i ? { ...x, monthsLeft: numOrEmpty(e.target.value) } : x,
                          )
                          setSettings({ credits })
                        }}
                      />
                    </td>
                    <td>{closeDate(cr.monthsLeft) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn ghost small"
            style={{ marginTop: 10 }}
            onClick={() =>
              setSettings({
                credits: [...s.credits, { id: uid('cr'), bank: '', payment: '', monthsLeft: '' }],
              })
            }
          >
            + кредит
          </button>
        </div>
      </div>
    </div>
  )
}
