import { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useProviderStore } from '../../stores/providerStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore'
import { useTabStore } from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'

export function StatusBar() {
  const { currentModel, effortLevel, activeProviderName } = useSettingsStore()
  const { providers } = useProviderStore()
  const activeTabId = useTabStore((s) => s.activeTabId)
  const runtimeSelection = useSessionRuntimeStore((s) =>
    activeTabId ? s.selections[activeTabId] : undefined,
  )
  const projectPath = useSessionStore((s) => s.sessions.find((session) => session.id === activeTabId)?.projectPath)
  const [showQuickSwitch, setShowQuickSwitch] = useState(false)

  const projectName = projectPath
    ? projectPath.split('-').filter(Boolean).pop() || ''
    : ''

  const modelId = runtimeSelection?.modelId ?? currentModel?.name ?? null
  const providerName = activeProviderName ?? 'Official'
  const effortLabel = effortLevel === 'high' ? '🔥' : effortLevel === 'max' ? '⚡' : ''

  return (
    <div className="h-[var(--statusbar-height)] flex items-center justify-between px-4 border-t border-[var(--color-border)] bg-[var(--color-surface-sidebar)] select-none text-[11px]">
      <div className="flex items-center gap-3">
        {projectName && (
          <span className="text-[var(--color-text-secondary)] font-[var(--font-mono)]">{projectName}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowQuickSwitch(!showQuickSwitch)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        >
          <span className="text-[var(--color-brand)]">{providerName}</span>
          <span className="text-[var(--color-text-tertiary)] opacity-60">/</span>
          <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">{modelId}</span>
          {effortLabel && <span className="ml-0.5">{effortLabel}</span>}
        </button>

        {showQuickSwitch && (
          <div className="flex items-center gap-1.5">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  const store = useSessionRuntimeStore.getState()
                  const tabId = useTabStore.getState().activeTabId
                  if (tabId) {
                    store.setRuntimeSelection(tabId, { providerId: p.id, modelId: p.models.main })
                  }
                  setShowQuickSwitch(false)
                }}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  p.name === providerName
                    ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)]'
                    : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
