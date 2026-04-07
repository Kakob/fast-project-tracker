'use client'

import {
  Check,
  SkipForward,
  Pause,
  Play,
  Plus,
  Coffee,
  FileEdit,
  XCircle,
} from 'lucide-react'

interface SessionControlsProps {
  isPaused: boolean
  isInTransition: boolean
  showExtendMenu: boolean
  onDone: () => void
  onSkip: () => void
  onPauseResume: () => void
  onExtendTime: (minutes: number) => void
  onToggleExtendMenu: () => void
  onBreak: () => void
  onLog: () => void
  onEndSession: () => void
}

const EXTEND_OPTIONS = [1, 5, 10, 15]

export function SessionControls({
  isPaused,
  isInTransition,
  showExtendMenu,
  onDone,
  onSkip,
  onPauseResume,
  onExtendTime,
  onToggleExtendMenu,
  onBreak,
  onLog,
  onEndSession,
}: SessionControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {/* Done */}
      <button
        onClick={onDone}
        disabled={isInTransition}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        title="Mark done (d)"
      >
        <Check className="w-4 h-4" />
        Done
        <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-green-700 rounded">d</kbd>
      </button>

      {/* Skip */}
      <button
        onClick={onSkip}
        disabled={isInTransition}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        title="Skip task (k)"
      >
        <SkipForward className="w-4 h-4" />
        Skip
        <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 rounded">k</kbd>
      </button>

      {/* Pause / Resume */}
      <button
        onClick={onPauseResume}
        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          isPaused
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}
        title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
      >
        {isPaused ? (
          <Play className="w-4 h-4" />
        ) : (
          <Pause className="w-4 h-4" />
        )}
        {isPaused ? 'Resume' : 'Pause'}
        <kbd className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
          isPaused ? 'bg-indigo-700' : 'bg-amber-200'
        }`}>
          &#9251;
        </kbd>
      </button>

      {/* +Time */}
      <div className="relative">
        <button
          onClick={onToggleExtendMenu}
          disabled={isInTransition}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          title="Extend time (+)"
        >
          <Plus className="w-4 h-4" />
          Time
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 rounded">+</kbd>
        </button>

        {showExtendMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] z-10">
            {EXTEND_OPTIONS.map((min) => (
              <button
                key={min}
                onClick={() => onExtendTime(min)}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50"
              >
                +{min} min
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Break */}
      <button
        onClick={onBreak}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        title="Take a break (b)"
      >
        <Coffee className="w-4 h-4" />
        <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 rounded">b</kbd>
      </button>

      {/* Log */}
      <button
        onClick={onLog}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        title="Log entry (l)"
      >
        <FileEdit className="w-4 h-4" />
        <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 rounded">l</kbd>
      </button>

      {/* End Session */}
      <button
        onClick={onEndSession}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
        title="End session (Esc)"
      >
        <XCircle className="w-4 h-4" />
        <kbd className="px-1.5 py-0.5 text-xs bg-red-100 rounded">Esc</kbd>
      </button>
    </div>
  )
}
