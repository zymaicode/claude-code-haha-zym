import { api } from './client'

export type ExtensionItem = {
  id: string
  name: string
  description: string
  category: 'mcp' | 'skill'
  source: 'smithery' | 'github' | 'local'
  sourceUrl?: string
  author?: string
  stars?: number
  installed: boolean
  mcpConfig?: Record<string, unknown>
  skillContent?: string
  skillFileName?: string
}

export type MarketplaceSearchResult = {
  items: ExtensionItem[]
  total: number
  source: 'smithery' | 'github'
  page: number
}

export type LocalScanResult = {
  items: ExtensionItem[]
  total: number
}

export const extensionsApi = {
  searchSmithery: (q: string, page = 1) =>
    api.get<MarketplaceSearchResult>(
      `/api/extensions/smithery/search?q=${encodeURIComponent(q)}&page=${page}`,
    ),

  getSmitheryFeatured: () =>
    api.get<MarketplaceSearchResult>('/api/extensions/smithery/featured'),

  searchGitHubSkills: (q: string, page = 1) =>
    api.get<MarketplaceSearchResult>(
      `/api/extensions/github/search?q=${encodeURIComponent(q)}&page=${page}`,
    ),

  getGitHubSkillContent: (url: string) =>
    api.get<{ content: string }>(
      `/api/extensions/github/content?url=${encodeURIComponent(url)}`,
    ),

  scanLocal: () =>
    api.get<LocalScanResult>('/api/extensions/local/scan'),

  installMcp: (name: string, config: Record<string, unknown>, scope?: 'user' | 'project') =>
    api.post<{ ok: boolean }>('/api/extensions/mcp/install', { name, config, scope }),

  installSkill: (name: string, content: string, scope?: 'user' | 'project') =>
    api.post<{ ok: boolean }>('/api/extensions/skill/install', { name, content, scope }),
}
