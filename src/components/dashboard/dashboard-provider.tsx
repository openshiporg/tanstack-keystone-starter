import { createContext, useContext } from 'react'

const DashboardContext = createContext<
  { basePath: string; version: string } | undefined
>(undefined)

export function DashboardProvider({
  children,
  basePath = '/dashboard',
  version = '2.0.0',
}: {
  children: React.ReactNode
  basePath?: string
  version?: string
}) {
  return (
    <DashboardContext.Provider value={{ basePath, version }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context)
    throw new Error('useDashboard must be used within a DashboardProvider')
  return context
}
