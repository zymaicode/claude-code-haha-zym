import { useState, useEffect, useCallback } from 'react'
import { Search, Download, Check, Globe, FolderOpen, Package, LoaderCircle, Star } from 'lucide-react'
import { useTranslation } from '../i18n'
import { Button } from '../components/shared/Button'
import { Input } from '../components/shared/Input'
import { extensionsApi, type ExtensionItem, type MarketplaceSearchResult, type LocalScanResult } from '../api/extensions'

type TabId = 'mcp' | 'skills' | 'local'

export function ExtensionStore() {
  const t = useTranslation()
  const [activeTab, setActiveTab] = useState<TabId>('mcp')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // MCP / Skills search results
  const [searchResults, setSearchResults] = useState<ExtensionItem[]>([])
  const [featured, setFeatured] = useState<ExtensionItem[]>([])
  const [total, setTotal] = useState(0)

  // Local scan
  const [localItems, setLocalItems] = useState<ExtensionItem[]>([])

  // ── Load featured / local on tab switch ──────────────────────
  useEffect(() => {
    if (activeTab === 'mcp') {
      loadFeatured()
    }
    if (activeTab === 'local') {
      loadLocal()
    }
  }, [activeTab])

  const loadFeatured = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result: MarketplaceSearchResult = await extensionsApi.getSmitheryFeatured()
      setFeatured(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setFeatured([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLocal = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result: LocalScanResult = await extensionsApi.scanLocal()
      setLocalItems(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan')
      setLocalItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadFeatured()
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'mcp') {
        const result: MarketplaceSearchResult = await extensionsApi.searchSmithery(searchQuery)
        setSearchResults(result.items)
        setTotal(result.total)
      } else if (activeTab === 'skills') {
        const result: MarketplaceSearchResult = await extensionsApi.searchGitHubSkills(searchQuery)
        setSearchResults(result.items)
        setTotal(result.total)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery, activeTab, loadFeatured])

  const handleInstall = useCallback(async (item: ExtensionItem) => {
    setInstalling(item.id)
    setError(null)
    try {
      if (item.category === 'mcp' && item.mcpConfig) {
        await extensionsApi.installMcp(item.name, item.mcpConfig)
      } else if (item.category === 'skill' && item.sourceUrl) {
        const result = await extensionsApi.getGitHubSkillContent(item.sourceUrl)
        await extensionsApi.installSkill(item.name, result.content)
      }
      // Refresh
      if (activeTab === 'local') loadLocal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed')
    } finally {
      setInstalling(null)
    }
  }, [activeTab, loadLocal])

  const displayItems = searchQuery.trim() ? searchResults : (activeTab === 'mcp' ? featured : localItems)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t('settings.extensions') || 'Extension Store'}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 border-b border-[var(--color-border)]">
        {(['mcp', 'skills', 'local'] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchQuery(''); setSearchResults([]) }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab === 'mcp' && <Globe className="inline w-4 h-4 mr-1.5" />}
            {tab === 'skills' && <Package className="inline w-4 h-4 mr-1.5" />}
            {tab === 'local' && <FolderOpen className="inline w-4 h-4 mr-1.5" />}
            {tab === 'mcp' ? 'MCP Market' : tab === 'skills' ? 'Skills' : 'Local'}
          </button>
        ))}
      </div>

      {/* Search bar */}
      {activeTab !== 'local' && (
        <div className="flex gap-2 px-6 py-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={activeTab === 'mcp' ? 'Search Smithery MCP servers...' : 'Search GitHub skills...'}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 py-2 text-sm text-red-500">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="w-6 h-6 animate-spin text-[var(--color-text-tertiary)]" />
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className="flex-1 overflow-auto px-6 py-2">
          {displayItems.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)] py-8 text-center">
              {searchQuery.trim()
                ? `No results for "${searchQuery}"`
                : activeTab === 'local'
                  ? 'No local extensions found'
                  : 'Browse the marketplace or search above'}
            </p>
          ) : (
            <div className="space-y-2 pb-4">
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-container-low)] transition-colors"
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
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                        {item.author}
                      </p>
                    )}
                  </div>
                  {item.installed ? (
                    <span className="flex items-center gap-1 text-xs text-green-500">
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
              {total > 20 && (
                <p className="text-xs text-[var(--color-text-tertiary)] text-center py-2">
                  Showing top {Math.min(displayItems.length, 20)} of {total} results
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
