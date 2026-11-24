import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getDashboardAuthState } from './dashboard-auth'

export const getDashboardAuthStateForCurrentRequest = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getDashboardAuthState(getRequest())
})
