import { createServerFn } from '@tanstack/react-start'

/** Whether the public sign-up page is open; the sign-in page only links to it when it is. */
export const getPublicSignupsAllowed = createServerFn({
  method: 'GET',
}).handler(() => process.env.PUBLIC_SIGNUPS_ALLOWED === 'true')
