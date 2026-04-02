'use client'

import { useUIStore } from '@/lib/stores/ui-store'
import { X } from 'lucide-react'

export interface ShortcutGroup {
  title: string
  shortcuts: { key: string; description: string }[]
}

const GLOBAL_SHORTCUTS: ShortcutGroup = {
  title: 'Global',
  shortcuts: [
    { key: '1-4', description: 'Switch view (Board, List, Calendar, Projects)' },
    { key: 'n', description: 'Focus quick add input' },
    { key: '?', description: 'Toggle keyboard shortcuts' },
    { key: 't', description: 'Start/stop timer on focused item' },
  ],
}

export function KeyboardShortcutsHelp({ groups }: { groups: ShortcutGroup[] }) {
  const { isShortcutsHelpOpen, toggleShortcutsHelp } = useUIStore()

  if (!isShortcutsHelpOpen) return null

  const allGroups = [...groups, GLOBAL_SHORTCUTS]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={toggleShortcutsHelp}
      />

      {/* Panel */}
      <div className="fixed right-4 top-20 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Keyboard Shortcuts</h3>
          <button
            onClick={toggleShortcutsHelp}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto">
          {allGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {group.title}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-700">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
