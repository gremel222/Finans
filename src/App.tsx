import { useState } from 'react'
import { Archive as ArchiveIcon, LayoutDashboard, ListChecks, PiggyBank, Settings2, Wallet, BookOpen } from 'lucide-react'
import Home from './pages/Home'
import SettingsPage from './pages/Settings'
import Operations from './pages/Operations'
import Debts from './pages/Debts'
import Distribution from './pages/Distribution'
import Summary from './pages/Summary'
import ArchivePage from './pages/Archive'

const TABS = [
  { id: 'home', label: 'Начало', color: '#607d8b', Icon: BookOpen },
  { id: 'settings', label: 'Настройки', color: '#FFB300', Icon: Settings2 },
  { id: 'ops', label: 'Операции', color: '#66BB6A', Icon: ListChecks },
  { id: 'debts', label: 'Долги', color: '#AB47BC', Icon: Wallet },
  { id: 'dist', label: 'Распределение', color: '#5C6BC0', Icon: PiggyBank },
  { id: 'sum', label: 'Сводка', color: '#26A69A', Icon: LayoutDashboard },
  { id: 'arch', label: 'Архив', color: '#8D6E63', Icon: ArchiveIcon },
] as const

export type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('sum')
  const [open, setOpen] = useState(false)

  return (
    <div className={`app ${open ? 'nav-open' : ''}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <h1>Финансы Семёна</h1>
            <p>Офлайн. 5 минут в день — остальное считается само.</p>
          </div>
          <button className="btn ghost small mobile-toggle" onClick={() => setOpen((v) => !v)}>
            Меню
          </button>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => {
                setTab(t.id)
                setOpen(false)
              }}
            >
              <span className="dot" style={{ background: t.color }} />
              <t.Icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Данные только на этом устройстве.
          <br />
          Интернет не нужен. Резервная копия — в Настройках.
        </div>
      </aside>
      <main className="main">
        {tab === 'home' && <Home go={setTab} />}
        {tab === 'settings' && <SettingsPage />}
        {tab === 'ops' && <Operations />}
        {tab === 'debts' && <Debts />}
        {tab === 'dist' && <Distribution />}
        {tab === 'sum' && <Summary />}
        {tab === 'arch' && <ArchivePage />}
      </main>
    </div>
  )
}
