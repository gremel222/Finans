import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { defaultState } from './defaults'
import type { AppState, Debt, Operation, Settings } from './types'

const KEY = 'fintracker-semyon-v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const base = defaultState()
    return {
      settings: { ...base.settings, ...(parsed.settings ?? {}), 
        currencies: parsed.settings?.currencies ?? base.settings.currencies,
        categories: parsed.settings?.categories ?? base.settings.categories,
        accounts: parsed.settings?.accounts ?? base.settings.accounts,
        envelopes: parsed.settings?.envelopes ?? base.settings.envelopes,
        goalShares: parsed.settings?.goalShares ?? base.settings.goalShares,
        subscriptions: parsed.settings?.subscriptions ?? base.settings.subscriptions,
        credits: parsed.settings?.credits ?? base.settings.credits,
      },
      operations: parsed.operations ?? base.operations,
      debts: parsed.debts ?? base.debts,
      debtorSlots: parsed.debtorSlots ?? base.debtorSlots,
      creditorSlots: parsed.creditorSlots ?? base.creditorSlots,
    }
  } catch {
    return defaultState()
  }
}

type Store = {
  state: AppState
  setSettings: (patch: Partial<Settings> | ((s: Settings) => Settings)) => void
  setOperations: (ops: Operation[] | ((o: Operation[]) => Operation[])) => void
  setDebts: (d: Debt[] | ((o: Debt[]) => Debt[])) => void
  setDebtorSlots: (s: string[]) => void
  setCreditorSlots: (s: string[]) => void
  resetAll: () => void
  exportJson: () => string
  importJson: (raw: string) => boolean
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => load())

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  const api = useMemo<Store>(
    () => ({
      state,
      setSettings: (patch) =>
        setState((s) => ({
          ...s,
          settings: typeof patch === 'function' ? patch(s.settings) : { ...s.settings, ...patch },
        })),
      setOperations: (ops) =>
        setState((s) => ({ ...s, operations: typeof ops === 'function' ? ops(s.operations) : ops })),
      setDebts: (d) => setState((s) => ({ ...s, debts: typeof d === 'function' ? d(s.debts) : d })),
      setDebtorSlots: (slots) => setState((s) => ({ ...s, debtorSlots: slots })),
      setCreditorSlots: (slots) => setState((s) => ({ ...s, creditorSlots: slots })),
      resetAll: () => setState(defaultState()),
      exportJson: () => JSON.stringify(state, null, 2),
      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as AppState
          if (!parsed.settings || !Array.isArray(parsed.operations)) return false
          setState({ ...defaultState(), ...parsed })
          return true
        } catch {
          return false
        }
      },
    }),
    [state],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('Store missing')
  return v
}
