/**
 * ExtensionMarketplaceService — 扩展市场服务
 *
 * Smithery MCP 市场 + GitHub Skills 搜索 + 本地扫描
 */

import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getCwd } from '../../utils/cwd.js'
import { findCanonicalGitRoot } from '../../utils/git.js'
import { ApiError } from '../middleware/errorHandler.js'

// ─── Types ───────────────────────────────────────────────────────────

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
  /** MCP-specific: JSON config ready to write to .mcp.json */
  mcpConfig?: Record<string, unknown>
  /** Skill-specific: markdown content */
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

// ─── Smithery ────────────────────────────────────────────────────────

const SMITHERY_API_BASE = 'https://registry.smithery.ai'

async function smitheryFetch(path: string): Promise<unknown> {
  const res = await fetch(`${SMITHERY_API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw ApiError.internal(`Smithery API error: ${res.status}`)
  }
  return res.json()
}

export async function searchSmithery(query: string, page = 1): Promise<MarketplaceSearchResult> {
  const data = (await smitheryFetch(
    `/servers?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`,
  )) as { servers?: Array<Record<string, unknown>>; total?: number }

  const servers = data.servers ?? []
  const items: ExtensionItem[] = servers.map((s) => ({
    id: `smithery:${s.id || s.name || ''}`,
    name: String(s.name || s.displayName || ''),
    description: String(s.description || ''),
    category: 'mcp' as const,
    source: 'smithery' as const,
    sourceUrl: String(s.homepage || s.repository || ''),
    author: String(s.author || s.owner || ''),
    stars: typeof s.stars === 'number' ? s.stars : undefined,
    installed: false,
    mcpConfig: buildSmitheryMcpConfig(s),
  }))

  return { items, total: typeof data.total === 'number' ? data.total : items.length, source: 'smithery', page }
}

function buildSmitheryMcpConfig(server: Record<string, unknown>): Record<string, unknown> | undefined {
  const command = server.command ?? server.bin
  if (!command) return undefined

  return {
    command: String(command),
    args: Array.isArray(server.args) ? server.args : [],
    env: server.env && typeof server.env === 'object' ? server.env : {},
  }
}

export async function getSmitheryFeatured(): Promise<MarketplaceSearchResult> {
  const data = (await smitheryFetch('/servers?sort=popular&pageSize=12')) as {
    servers?: Array<Record<string, unknown>>
    total?: number
  }

  const servers = data.servers ?? []
  const items: ExtensionItem[] = servers.map((s) => ({
    id: `smithery:${s.id || s.name || ''}`,
    name: String(s.name || s.displayName || ''),
    description: String(s.description || ''),
    category: 'mcp' as const,
    source: 'smithery' as const,
    sourceUrl: String(s.homepage || s.repository || ''),
    author: String(s.author || s.owner || ''),
    stars: typeof s.stars === 'number' ? s.stars : undefined,
    installed: false,
    mcpConfig: buildSmitheryMcpConfig(s),
  }))

  return { items, total: items.length, source: 'smithery', page: 1 }
}

// ─── GitHub Skills Search ────────────────────────────────────────────

async function githubSearch(query: string, page = 1): Promise<MarketplaceSearchResult> {
  const searchQuery = encodeURIComponent(`${query} SKILL.md path:.claude/skills`)
  const res = await fetch(
    `https://api.github.com/search/code?q=${searchQuery}&per_page=20&page=${page}`,
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'claude-code-haha-zym',
      },
    },
  )
  if (!res.ok) {
    throw ApiError.internal(`GitHub API error: ${res.status}`)
  }

  const data = (await res.json()) as {
    items?: Array<{
      path: string
      repository: { full_name: string; stargazers_count?: number; html_url: string }
      html_url: string
    }>
    total_count: number
  }

  const items: ExtensionItem[] = (data.items ?? []).map((item) => {
    const repoName = item.repository.full_name
    const fileName = item.path.split('/').pop() || 'SKILL.md'
    return {
      id: `github:${repoName}:${item.path}`,
      name: repoName,
      description: `${fileName} from ${repoName}`,
      category: 'skill' as const,
      source: 'github' as const,
      sourceUrl: item.html_url,
      author: repoName.split('/')[0],
      stars: item.repository.stargazers_count,
      installed: false,
      skillFileName: fileName,
    }
  })

  return { items, total: data.total_count, source: 'github', page }
}

export { githubSearch as searchGitHubSkills }

export async function getGitHubSkillContent(url: string): Promise<string> {
  const rawUrl = url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/')

  const res = await fetch(rawUrl, {
    headers: { 'User-Agent': 'claude-code-haha-zym' },
  })
  if (!res.ok) {
    throw ApiError.internal(`Failed to fetch skill content: ${res.status}`)
  }
  return res.text()
}

// ─── Local Scan ──────────────────────────────────────────────────────

export async function scanLocalExtensions(cwd?: string): Promise<LocalScanResult> {
  const items: ExtensionItem[] = []

  // Scan ECC skills
  const userSkillsDir = path.join(getClaudeConfigHomeDir(), 'skills')
  await scanSkillsDir(userSkillsDir, items, 'local')

  // Scan project skills
  const projectRoot = cwd ? (await findCanonicalGitRoot(cwd) || cwd) : getCwd()
  const projectSkillsDir = path.join(projectRoot, '.claude', 'skills')
  await scanSkillsDir(projectSkillsDir, items, 'local')

  // Scan MCP configs
  await scanMcpConfigs(items)

  return { items, total: items.length }
}

async function scanSkillsDir(
  dir: string,
  items: ExtensionItem[],
  source: 'local',
): Promise<void> {
  try {
    await fs.access(dir)
  } catch {
    return
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillFile = path.join(dir, entry.name, 'SKILL.md')
    try {
      const content = await fs.readFile(skillFile, 'utf-8')
      const frontmatter = parseFrontmatter(content)
      const meta = frontmatter?.data ?? ({} as Record<string, unknown>)
      items.push({
        id: `local:${entry.name}`,
        name: String(meta.name || entry.name),
        description: String(meta.description || ''),
        category: 'skill',
        source,
        installed: true,
        skillContent: content,
        skillFileName: 'SKILL.md',
      })
    } catch {
      // Skip unreadable skills
    }
  }
}

async function scanMcpConfigs(items: ExtensionItem[]): Promise<void> {
  // Check user .mcp.json
  const homeMcpPath = path.join(os.homedir(), '.mcp.json')
  try {
    const content = await fs.readFile(homeMcpPath, 'utf-8')
    const config = JSON.parse(content)
    const servers = config?.mcpServers ?? {}
    for (const [name] of Object.entries(servers)) {
      items.push({
        id: `local:mcp:${name}`,
        name,
        description: 'Local MCP server',
        category: 'mcp',
        source: 'local',
        installed: true,
      })
    }
  } catch {
    // No user .mcp.json
  }

  // Check project .mcp.json
  const projectMcpPath = path.join(getCwd(), '.mcp.json')
  try {
    const content = await fs.readFile(projectMcpPath, 'utf-8')
    const config = JSON.parse(content)
    const servers = config?.mcpServers ?? {}
    for (const [name] of Object.entries(servers)) {
      items.push({
        id: `local:mcp:${name}`,
        name: `${name} (project)`,
        description: 'Project MCP server',
        category: 'mcp',
        source: 'local',
        installed: true,
      })
    }
  } catch {
    // No project .mcp.json
  }
}

// ─── Install ─────────────────────────────────────────────────────────

export async function installMcpExtension(
  name: string,
  config: Record<string, unknown>,
  scope: 'user' | 'project' = 'user',
): Promise<void> {
  const mcpPath =
    scope === 'project'
      ? path.join(getCwd(), '.mcp.json')
      : path.join(os.homedir(), '.mcp.json')

  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(await fs.readFile(mcpPath, 'utf-8'))
  } catch {
    existing = {}
  }

  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>
  servers[name] = config
  existing.mcpServers = servers

  await fs.writeFile(mcpPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
}

export async function installSkillExtension(
  name: string,
  content: string,
  scope: 'user' | 'project' = 'user',
): Promise<void> {
  const skillsDir =
    scope === 'project'
      ? path.join(getCwd(), '.claude', 'skills', name)
      : path.join(getClaudeConfigHomeDir(), 'skills', name)

  await fs.mkdir(skillsDir, { recursive: true })
  await fs.writeFile(path.join(skillsDir, 'SKILL.md'), content, 'utf-8')
}
