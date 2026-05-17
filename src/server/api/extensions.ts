/**
 * Extensions REST API — MCP/Skills 扩展市场
 *
 * GET  /api/extensions/smithery/search?q=xxx&page=1
 * GET  /api/extensions/smithery/featured
 * GET  /api/extensions/github/search?q=xxx&page=1
 * GET  /api/extensions/github/content?url=xxx
 * POST /api/extensions/mcp/install   — { name, config, scope }
 * POST /api/extensions/skill/install — { name, content, scope }
 * GET  /api/extensions/local/scan    — 扫描本地
 */

import { ApiError, errorResponse } from '../middleware/errorHandler.js'
import {
  searchSmithery,
  getSmitheryFeatured,
  searchGitHubSkills,
  getGitHubSkillContent,
  scanLocalExtensions,
  installMcpExtension,
  installSkillExtension,
} from '../services/extensionMarketplaceService.js'

export async function handleExtensionsApi(
  req: Request,
  url: URL,
  _segments: string[],
): Promise<Response> {
  try {
    const pathname = url.pathname
    const method = req.method

    // ── Smithery ──────────────────────────────────────────────
    if (pathname === '/api/extensions/smithery/search' && method === 'GET') {
      const q = url.searchParams.get('q') || ''
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      return Response.json(await searchSmithery(q, page))
    }

    if (pathname === '/api/extensions/smithery/featured' && method === 'GET') {
      return Response.json(await getSmitheryFeatured())
    }

    // ── GitHub ────────────────────────────────────────────────
    if (pathname === '/api/extensions/github/search' && method === 'GET') {
      const q = url.searchParams.get('q') || ''
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      return Response.json(await searchGitHubSkills(q, page))
    }

    if (pathname === '/api/extensions/github/content' && method === 'GET') {
      const contentUrl = url.searchParams.get('url')
      if (!contentUrl) {
        throw ApiError.badRequest('Missing required "url" query parameter')
      }
      return Response.json({ content: await getGitHubSkillContent(contentUrl) })
    }

    // ── Local scan ────────────────────────────────────────────
    if (pathname === '/api/extensions/local/scan' && method === 'GET') {
      const cwd = url.searchParams.get('cwd') || undefined
      return Response.json(await scanLocalExtensions(cwd))
    }

    // ── Install ───────────────────────────────────────────────
    if (pathname === '/api/extensions/mcp/install' && method === 'POST') {
      const body = await req.json() as Record<string, unknown>
      if (!body.name || !body.config) {
        throw ApiError.badRequest('Missing required fields: name, config')
      }
      const scope = (body.scope === 'project' ? 'project' : 'user') as 'user' | 'project'
      await installMcpExtension(String(body.name), body.config as Record<string, unknown>, scope)
      return Response.json({ ok: true })
    }

    if (pathname === '/api/extensions/skill/install' && method === 'POST') {
      const body = await req.json() as Record<string, unknown>
      if (!body.name || !body.content) {
        throw ApiError.badRequest('Missing required fields: name, content')
      }
      const scope = (body.scope === 'project' ? 'project' : 'user') as 'user' | 'project'
      await installSkillExtension(String(body.name), String(body.content), scope)
      return Response.json({ ok: true })
    }

    throw ApiError.notFound(`Unknown extensions endpoint: ${pathname}`)
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error)
    }
    return errorResponse(ApiError.internal(
      error instanceof Error ? error.message : 'Internal extensions error',
    ))
  }
}
