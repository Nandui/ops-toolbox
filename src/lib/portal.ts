/**
 * Canonical LeisureWorld portal metadata.
 *
 * Keep shared role labels, site definitions, and display helpers here so the
 * UI, auth layer, and seed data all read from one source of truth.
 */
export const USER_ROLES = [
  'admin',
  'operations_manager',
  'duty_manager',
  'shift_supervisor',
  'manager',
] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:              'Admin',
  operations_manager: 'Operations Manager',
  duty_manager:       'Duty Manager',
  shift_supervisor:   'Shift Supervisor',
  manager:            'Manager',
}

export interface SiteDefinition {
  id: number
  name: string
  pools: readonly string[]
}

export const SITES = [
  { id: 23201, name: 'Bishopstown', pools: ['25m', '18m', 'learners'] },
  { id: 26173, name: 'Churchfield', pools: ['25m', 'learners'] },
  { id: 32587, name: 'Douglas', pools: ['25m'] },
] as const satisfies readonly SiteDefinition[]

export const SITE_BY_ID = Object.fromEntries(
  SITES.map(site => [site.id, site]),
) as Record<number, SiteDefinition>

export const SITE_LABEL_BY_ID = Object.fromEntries(
  SITES.map(site => [site.id, site.name]),
) as Record<number, string>

export const SITE_IDS = SITES.map(site => site.id) as number[]
