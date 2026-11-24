import { VIEW_ORDER } from '../../../../.cms/view-order'

/**
 * Resolve the generated field kind for an admin-meta views index.
 *
 * `npm run cms:generate` writes the same ordered array used by the runtime's
 * admin metadata. Keeping this as a static import lets Vite resolve the module
 * during dependency scanning; a conditional `require()` of the old Keystone
 * feature path made a fresh `npm run dev` fail before the app could start.
 */
export function getFieldTypeFromViewsIndex(viewsIndex: number): string {
  const fieldType = VIEW_ORDER[viewsIndex]
  if (!fieldType) {
    throw new Error(
      `Invalid views index: ${viewsIndex}. Available indices: 0-${VIEW_ORDER.length - 1}`,
    )
  }

  return fieldType
}
