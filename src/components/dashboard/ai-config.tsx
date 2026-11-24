import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type AiKeyMode = 'server'

export type AiConfig = {
  enabled: boolean
  completionEndpoint: string
  keyMode: AiKeyMode
}

type AiConfigContextValue = {
  config: AiConfig
  setConfig: (
    value: Partial<AiConfig> | ((previous: AiConfig) => Partial<AiConfig>),
  ) => void
  isHydrated: boolean
}

const STORAGE_KEY = 'dashboard-ai-config'
const defaultAiConfig: AiConfig = {
  enabled: true,
  completionEndpoint: '/api/completion',
  keyMode: 'server',
}

const AiConfigContext = createContext<AiConfigContextValue | null>(null)

function loadStoredConfig() {
  if (typeof window === 'undefined') return defaultAiConfig
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultAiConfig
    const parsed = JSON.parse(stored) as Partial<AiConfig>
    return { ...defaultAiConfig, ...parsed }
  } catch {
    return defaultAiConfig
  }
}

function saveStoredConfig(config: AiConfig) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore storage failures
  }
}

export function AiConfigProvider({
  children,
  defaultConfig,
}: {
  children: React.ReactNode
  defaultConfig?: Partial<AiConfig>
}) {
  const mergedDefaults = useMemo(
    () => ({ ...defaultAiConfig, ...defaultConfig }),
    [defaultConfig],
  )
  const [config, setConfigState] = useState<AiConfig>(() => ({
    ...mergedDefaults,
    ...loadStoredConfig(),
  }))
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const hydrated = { ...mergedDefaults, ...loadStoredConfig() }
    setConfigState(hydrated)
    setIsHydrated(true)
  }, [mergedDefaults])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      setConfigState({ ...mergedDefaults, ...loadStoredConfig() })
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [mergedDefaults])

  const setConfig = useCallback(
    (
      value: Partial<AiConfig> | ((previous: AiConfig) => Partial<AiConfig>),
    ) => {
      setConfigState((previous) => {
        const updates = typeof value === 'function' ? value(previous) : value
        const next = { ...previous, ...updates }
        saveStoredConfig(next)
        return next
      })
    },
    [],
  )

  const contextValue = useMemo<AiConfigContextValue>(
    () => ({
      config: isHydrated ? config : mergedDefaults,
      setConfig,
      isHydrated,
    }),
    [config, isHydrated, mergedDefaults, setConfig],
  )

  return (
    <AiConfigContext.Provider value={contextValue}>
      {children}
    </AiConfigContext.Provider>
  )
}

export function useAiConfig() {
  const context = useContext(AiConfigContext)
  if (!context)
    throw new Error('useAiConfig must be used within AiConfigProvider')
  return context
}
