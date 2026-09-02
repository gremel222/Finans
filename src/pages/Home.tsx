import type { TabId } from '../App'

const SHEETS = [
  { name: 'Начало', color: '#607d8b', text: 'Памятка, легенда, правила A–E' },
  { name: 'Настройки', color: '#FFB300', text: 'Справочники, курсы, планы, конверты, ревизор' },
  { name: 'Операции', color: '#66BB6A', text: 'Единый журнал доходов, расходов и переводов' },
  { name: 'Долги', color: '#AB47BC', text: 'Реестр, должники и кредиторы' },
  { name: 'Распределение', color: '#5C6BC0', text: 'Конверты 15 / 35 / 50 / 0 и прогресс целей' },
  { name: 'Сводка', color: '#26A69A', text: 'Баланс, лимит на день, план/факт, топ-10' },
  { name: 'Архив', color: '#8D6E63', text: 'Годы 2026–2040, капитализация' },
]

export default function Home({ go }: { go: (t: TabId) => void }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>МОЯ ФИНАНСОВАЯ СИСТЕМА — Семён</h2>
          <p>
            График ЗП: 15-е / 30-е / остаток 15-го след. месяца. 5 минут в день — остальное считается само.
            Работает полностью офлайн: данные хранятся в браузере этого устройства.
          </p>
        </div>
        <button className="btn" onClick={() => go('sum')}>
          Открыть сводку
        </button>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Состав системы</h3>
          <div className="grid" style={{ gap: 8 }}>
            {SHEETS.map((s) => (
              <div key={s.name} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="dot" style={{ background: s.color, width: 12, height: 12 }} />
                <div>
                  <b>{s.name}</b>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {s.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Легенда цветов</h3>
          <div className="legend" style={{ marginBottom: 16 }}>
            <span className="chip income">Доход</span>
            <span className="chip expense">Расход</span>
            <span className="chip transfer">Перевод</span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Погашение мной — жёлтый. Просроченный долг — красный. Несовпадение категории и группы — жёлтый флаг.
            Вводимые поля подсвечены кремовым.
          </p>
          <h3 style={{ marginTop: 18 }}>Памятка частых сумм</h3>
          <ul className="plain">
            <li>Бензин ~3 000 ₽ / заправка (еженедельно, 12–15 тыс. ₽/мес)</li>
            <li>Продукты ~4 000–5 500 ₽</li>
            <li>Загородные поездки — тег <code>#загород</code> в примечании</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Инструкция — 5 шагов</h3>
        <ol className="steps" style={{ padding: 0, margin: 0 }}>
          <li>
            Впиши стартовые остатки в <b>Настройки → Старт ₽</b> по каждой карте и наличным.
          </li>
          <li>
            Зарплату проводи на <b>🩵 Газпромбанк (ЗП)</b> или <b>💛 Т-Банк</b> категорией «ЗП на работе».
          </li>
          <li>
            Операции заноси на листе <b>Операции</b> из списков (тип, счёт, группа, категория).
          </li>
          <li>
            Взносы в цели = тип <b>Перевод</b> на счёт цели (подушка / цели / ремонт).
          </li>
          <li>
            Смотри <b>Сводку</b> и <b>Распределение</b> — балансы, лимит, конверты и диаграммы считаются сами.
          </li>
        </ol>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Вехи накоплений</h3>
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Срок</th>
                  <th>Накоплено (ориентир)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>6 мес</td>
                  <td>1 080 000 ₽ (подушка закрыта)</td>
                </tr>
                <tr>
                  <td>12 мес</td>
                  <td>2 160 000 ₽</td>
                </tr>
                <tr>
                  <td>18 мес</td>
                  <td>3 240 000 ₽</td>
                </tr>
                <tr>
                  <td>24 мес</td>
                  <td>4 320 000 ₽ (с учётом вклада до ~5 млн ₽)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
            При доходе 360 000 ₽ и конверте сбережений 50% (180 000 ₽/мес).
          </p>
        </div>

        <div className="card">
          <h3>Правила-комбинации A–E</h3>
          <ul className="plain">
            <li>
              <b>A.</b> Возвраты долгов → сразу в цели (перевод на 🎯 Цели), не в траты.
            </li>
            <li>
              <b>B.</b> Учётный месяц = календарный: «хвост» ЗП относится к месяцу поступления.
            </li>
            <li>
              <b>C.</b> Плати себе первым: после ЗП (15/30) — переводы по рекомендации Сводки, тратим остаток.
            </li>
            <li>
              <b>D.</b> Закрылся кредит → ~30 000 ₽/мес в цели; сигнал на Сводке подскажет перестроить конверты.
            </li>
            <li>
              <b>E.</b> Бензин за город — тег <code>#загород</code>; подписки — пересмотр раз в квартал (ревизор в Настройках).
            </li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Как пользоваться офлайн</h3>
        <ol className="plain">
          <li>Открой приложение один раз — оно сохранится в браузере (PWA).</li>
          <li>На телефоне: «На экран Домой» — ярлык как у обычного приложения, без интернета.</li>
          <li>
            В Настройках скачай JSON-копию. Если сменишь браузер или устройство — импортируй файл обратно.
          </li>
        </ol>
      </div>
    </div>
  )
}
