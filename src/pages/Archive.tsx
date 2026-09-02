import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { archiveRows } from '../calc'
import { formatMoney } from '../format'
import { useStore } from '../store'

export default function ArchivePage() {
  const { state } = useStore()
  const rows = archiveRows(state)

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Архив</h2>
          <p>Журнал один — год это фильтр. Файл не нужно копировать каждый год. 2026–2040.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Год</th>
                <th>Доходы ₽</th>
                <th>Расходы ₽</th>
                <th>Сальдо</th>
                <th>Капитализация</th>
                <th>Средний расход/мес</th>
                <th>Операций</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td className="right">{formatMoney(r.income)}</td>
                  <td className="right">{formatMoney(r.expense, 2)}</td>
                  <td className={`right ${r.saldo < 0 ? 'neg' : ''}`}>{formatMoney(r.saldo, 2)}</td>
                  <td className="right">{formatMoney(r.capitalization, 2)}</td>
                  <td className="right">{formatMoney(r.avgExpense, 2)}</td>
                  <td className="right">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>График по годам — сальдо и капитализация</h3>
        <div className="chart-box" style={{ height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}к`} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="saldo" name="Сальдо" stroke="#EF5350" strokeWidth={2} dot />
              <Line type="monotone" dataKey="capitalization" name="Капитализация" stroke="#26A69A" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
