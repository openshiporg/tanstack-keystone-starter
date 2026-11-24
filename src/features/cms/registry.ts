import cmsConfig from '../../../cms.config'
import { initialiseLists } from './config'

export { cmsConfig }

export const cmsLists = initialiseLists(cmsConfig)

export function getCmsListByPath(path: string) {
  const normalized = path.toLowerCase()
  return cmsLists.find(
    (list) =>
      list.path === path ||
      list.key === path ||
      list.path.toLowerCase() === normalized ||
      list.key.toLowerCase() === normalized,
  )
}

export function getCanonicalCmsListPath(path: string) {
  return getCmsListByPath(path)?.path
}
