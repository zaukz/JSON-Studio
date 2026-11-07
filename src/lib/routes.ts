export type Route = 'studio' | 'compare' | 'convert'

export type IncomingDocument = {
  text: string
  name: string
  token: number
}

export const ROUTE_HASH: Record<Route, string> = {
  studio: '#/',
  compare: '#/compare',
  convert: '#/convert',
}

export function routeFromHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').toLowerCase()
  if (clean.startsWith('compare')) return 'compare'
  if (clean.startsWith('convert')) return 'convert'
  return 'studio'
}
