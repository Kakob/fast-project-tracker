'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LogOut, LayoutGrid, List, Calendar, Plus, FolderOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCreateItem } from '@/lib/hooks/use-items'
import { ItemDetailsPanel } from '@/components/item/item-details-panel'
import { useState, useRef, useEffect } from 'react'
import type { ViewType } from '@/types'

const VIEW_TABS: { view: ViewType; path: string; label: string; icon: typeof LayoutGrid }[] = [
  { view: 'board', path: '/board', label: 'Board', icon: LayoutGrid },
  { view: 'list', path: '/list', label: 'List', icon: List },
  { view: 'calendar', path: '/calendar', label: 'Calendar', icon: Calendar },
  { view: 'projects', path: '/projects', label: 'Projects', icon: FolderOpen },
]

export function TrackerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setCurrentView } = useUIStore()
  const createItem = useCreateItem()

  const [quickAddValue, setQuickAddValue] = useState('')
  const [isQuickAddFocused, setIsQuickAddFocused] = useState(false)
  const quickAddRef = useRef<HTMLInputElement>(null)

  // Determine current view from pathname
  const currentView = pathname.includes('/list')
    ? 'list'
    : pathname.includes('/calendar')
    ? 'calendar'
    : pathname.includes('/projects')
    ? 'projects'
    : 'board'

  useEffect(() => {
    setCurrentView(currentView)
  }, [currentView, setCurrentView])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickAddValue.trim()) return

    try {
      await createItem.mutateAsync({ title: quickAddValue.trim() })
      setQuickAddValue('')
    } catch (error) {
      console.error('Failed to create item:', error)
    }
  }

  // Global keyboard shortcut for quick add
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'n' to focus quick add (when not in an input)
      if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) {
        e.preventDefault()
        quickAddRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-gray-900">Tracker</span>
            </div>

            {/* View Tabs */}
            <nav className="flex items-center gap-1">
              {VIEW_TABS.map(({ view, path, label, icon: Icon }) => (
                <button
                  key={view}
                  onClick={() => router.push(path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentView === view
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Quick Add + Sign Out */}
            <div className="flex items-center gap-3">
              <form onSubmit={handleQuickAdd} className="relative">
                <input
                  ref={quickAddRef}
                  type="text"
                  value={quickAddValue}
                  onChange={(e) => setQuickAddValue(e.target.value)}
                  onFocus={() => setIsQuickAddFocused(true)}
                  onBlur={() => setIsQuickAddFocused(false)}
                  placeholder="Add item... (n)"
                  className={`w-48 pl-9 pr-3 py-2 text-sm border rounded-lg transition-all bg-white text-gray-900 ${
                    isQuickAddFocused
                      ? 'w-64 border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-gray-300'
                  }`}
                />
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </form>

              <button
                onClick={handleSignOut}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Details Panel */}
      <ItemDetailsPanel />
    </div>
  )
}
