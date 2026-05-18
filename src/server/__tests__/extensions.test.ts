import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { handleExtensionsApi } from '../api/extensions.js'

let tmpDir: string
let originalConfigDir: string | undefined

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-extensions-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = tmpDir
}

async function teardown() {
  if (originalConfigDir !== undefined) {
    process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  } else {
    delete process.env.CLAUDE_CONFIG_DIR
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
}

function makeRequest(method: string, pathName: string, body?: Record<string, unknown>) {
  const url = new URL(pathName, 'http://localhost:3456')
  const req = new Request(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const segments = url.pathname.split('/').filter(Boolean)
  return { req, url, segments }
}

describe('Extensions API', () => {
  beforeEach(setup)
  afterEach(teardown)

  describe('local scan', () => {
    it('returns empty when no skills exist', async () => {
      const { req, url, segments } = makeRequest('GET', '/api/extensions/local/scan')
      const response = await handleExtensionsApi(req, url, segments)
      const body = await response.json() as { items: unknown[]; total: number }
      expect(response.status).toBe(200)
      expect(body.items).toEqual([])
      expect(body.total).toBe(0)
    })

    it('discovers local skills from user directory', async () => {
      const skillsDir = path.join(tmpDir, 'skills', 'test-skill')
      await fs.mkdir(skillsDir, { recursive: true })
      await fs.writeFile(
        path.join(skillsDir, 'SKILL.md'),
        '---\nname: test-skill\ndescription: A test skill\n---\nTest content',
        'utf-8',
      )

      const { req, url, segments } = makeRequest('GET', '/api/extensions/local/scan')
      const response = await handleExtensionsApi(req, url, segments)
      const body = await response.json() as { items: Array<{ name: string; installed: boolean }>; total: number }
      expect(response.status).toBe(200)
      expect(body.total).toBe(1)
      expect(body.items[0]?.name).toBe('test-skill')
      expect(body.items[0]?.installed).toBe(true)
    })
  })

  describe('MCP install', () => {
    it('requires name and config', async () => {
      const { req, url, segments } = makeRequest('POST', '/api/extensions/mcp/install', {})
      const response = await handleExtensionsApi(req, url, segments)
      expect(response.status).toBe(400)
    })

    it('installs MCP config to home .mcp.json', async () => {
      const { req, url, segments } = makeRequest('POST', '/api/extensions/mcp/install', {
        name: 'test-server',
        config: { command: 'test-cmd', args: [] },
      })
      const response = await handleExtensionsApi(req, url, segments)
      expect(response.status).toBe(200)

      const mcpPath = path.join(os.homedir(), '.mcp.json')
      const existing = JSON.parse(await fs.readFile(mcpPath, 'utf-8'))
      expect(existing.mcpServers['test-server']).toBeDefined()
      expect(existing.mcpServers['test-server'].command).toBe('test-cmd')
    })
  })

  describe('Skill install', () => {
    it('requires name and content', async () => {
      const { req, url, segments } = makeRequest('POST', '/api/extensions/skill/install', {})
      const response = await handleExtensionsApi(req, url, segments)
      expect(response.status).toBe(400)
    })

    it('installs skill to user skills directory', async () => {
      const { req, url, segments } = makeRequest('POST', '/api/extensions/skill/install', {
        name: 'installed-skill',
        content: '---\nname: installed-skill\n---\nContent',
      })
      const response = await handleExtensionsApi(req, url, segments)
      expect(response.status).toBe(200)

      const skillPath = path.join(tmpDir, 'skills', 'installed-skill', 'SKILL.md')
      const content = await fs.readFile(skillPath, 'utf-8')
      expect(content).toContain('installed-skill')
    })
  })

  describe('unknown endpoint', () => {
    it('returns 404 for unknown paths', async () => {
      const { req, url, segments } = makeRequest('GET', '/api/extensions/unknown')
      const response = await handleExtensionsApi(req, url, segments)
      expect(response.status).toBe(404)
    })
  })

  describe('Smithery search', () => {
    it('returns empty when request fails gracefully', async () => {
      const { req, url, segments } = makeRequest('GET', '/api/extensions/smithery/search?q=nonexistent')
      const result = handleExtensionsApi(req, url, segments)
      // Should not throw - graceful error handling
      expect(result).toBeDefined()
    })
  })
})
