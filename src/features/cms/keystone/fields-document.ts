import type { StructureFieldOptions } from '../fields'

export { document, structure } from '../fields'
export type { StructureFieldOptions } from '../fields'
export type StructureFieldConfig<TListTypeInfo = unknown> =
  TListTypeInfo extends unknown ? StructureFieldOptions : never
export type { StructureSchema } from '../structure'
