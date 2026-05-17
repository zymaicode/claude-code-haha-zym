import { useState, useEffect, useCallback } from 'react'
import { Search, Download, Check, Star, LoaderCircle } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { Modal } from './Modal'
import { extensionsApi, type ExtensionItem } from '../../api/extensions'

type Props = {
  open: boolean
  onClose: () => void
  category: 'mcp' | 'skill'
  /** For MCP: the scope determines where config is written */
  scope?: 'user' | 'project'
}

export function ExtensionMarketplaceModal({ open, onClose, category, scope = 'user' }: Props) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ExtensionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      loadFeatured()
    }
  }, [open])

  const loadFeatured = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (category === 'mcp') {
        const result = await extensionsApi.getSmitheryFeatured()
        setItems(result.items)
      } else {
        // Skills: search popular
        const result = await extensionsApi.searchGitHubSkills('skill', 1)
        setItems(result.items)
      }
    } catch {
      setError('Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [category])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) { loadFeatured(); return }
    setLoading(true)
    setError(null)
    try {
      if (category === 'mcp') {
        const result = await extensionsApi.searchSmithery(query)
        setItems(result.items)
      } else {
        const result = await extensionsApi.searchGitHubSkills(query)
        setItems(result.items)
      }
    } catch {
      setError('Search failed')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [query, category, loadFeatured])

  const handleInstall = useCallback(async (item: ExtensionItem) => {
    setInstalling(item.id)
    setError(null)
    try {
      if (category === 'mcp' && item.mcpConfig) {
        await extensionsApi.installMcp(item.name, item.mcpConfig, scope)
      } else if (category === 'skill' && item.sourceUrl) {
        const { content } = await extensionsApi.getGitHubSkillContent(item.sourceUrl)
        await extensionsApi.installSkill(item.name, content, scope)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed')
    } finally {
      setInstalling(null)
    }
  }, [category, scope])

  const placeholder = category === 'mcp'
    ? 'Search Smithery MCP servers...'
    : 'Search GitHub skills...'
  const title = category === 'mcp' ? 'MCP Marketplace' : 'Skills Marketplace'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3" style={{ minWidth: 480, maxHeight: '70vh' }}>
        {/* Search */}
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoaderCircle className="w-6 h-6 animate-spin text-[var(--color-text-tertiary)]" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)] text-center py-8">
            Nothing found. Try a different search.
          </p>
        ) : (
          <div className="overflow-auto space-y-2" style={{ maxHeight: 400 }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-container-low)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {item.name}
                    </span>
                    {item.stars != null && (
                      <span className="flex items-center gap-0.5 text-xs text-[var(--color-text-tertiary)]">
                        <Star className="w-3 h-3" />
                        {item.stars}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                    {item.description}
                  </p>
                  {item.author && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">{item.author}</p>
                  )}
                </div>
                {item.installed ? (
                  <span className="flex items-center gap-1 text-xs text-green-500 whitespace-nowrap">
                    <Check className="w-3.5 h-3.5" /> Installed
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleInstall(item)}
                    disabled={installing === item.id}
                  >
                    {installing === item.id ? (
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="ml-1">Install</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
