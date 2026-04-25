import { create } from 'zustand'
import type { FocusSessionStatus, Reminder } from '@/types'

interface FocusSessionState {
  // Session identity
  activeSessionId: string | null
  sessionStatus: FocusSessionStatus | null

  // Timer state (updated every second by the Provider)
  sessionElapsedMs: number
  currentTaskElapsedMs: number
  currentTaskIndex: number
  taskStartSessionElapsedMs: number // sessionElapsedMs when current task started
  totalAllocatedMs: number

  // Transition state (3-5 sec animation between tasks)
  isInTransition: boolean
  transitionFromTaskId: string | null
  transitionToTaskId: string | null

  // Warning zone
  isWarningActive: boolean

  // Break state
  isOnBreak: boolean
  breakElapsedMs: number
  breakPlannedDurationSec: number | null
  activeBreakId: string | null

  // Pause tracking
  totalPauseMs: number
  totalBreakMs: number
  pauseStartedAt: number | null // Date.now() when paused

  // Reminder engine
  firedReminderIds: string[]
  pendingReminderPrompt: Reminder | null

  // UI state
  showLogPrompt: boolean
  showBreakPrompt: boolean
  showEndConfirm: boolean
  showSetupModal: boolean
  showExtendMenu: boolean

  // Actions
  initSession: (sessionId: string, totalAllocatedMs: number) => void
  clearSession: () => void
  setSessionStatus: (status: FocusSessionStatus) => void
  setCurrentTaskIndex: (index: number, sessionElapsedAtStart?: number) => void
  setCurrentTaskElapsedMs: (ms: number) => void
  setSessionElapsedMs: (ms: number) => void
  setTotalAllocatedMs: (ms: number) => void

  // Transition
  enterTransition: (fromId: string | null, toId: string | null) => void
  exitTransition: () => void

  // Warning
  setWarningActive: (active: boolean) => void

  // Break
  startBreak: (breakId: string, plannedSec: number | null) => void
  endBreak: () => void
  setBreakElapsedMs: (ms: number) => void

  // Pause
  startPause: () => void
  endPause: (accumulatedPauseMs: number) => void
  setTotalPauseMs: (ms: number) => void
  setTotalBreakMs: (ms: number) => void

  // Reminders
  addFiredReminder: (id: string) => void
  setPendingReminderPrompt: (reminder: Reminder | null) => void

  // UI toggles
  setShowLogPrompt: (show: boolean) => void
  setShowBreakPrompt: (show: boolean) => void
  setShowEndConfirm: (show: boolean) => void
  setShowSetupModal: (show: boolean) => void
  setShowExtendMenu: (show: boolean) => void
}

export const useFocusSessionStore = create<FocusSessionState>((set) => ({
  // Session identity
  activeSessionId: null,
  sessionStatus: null,

  // Timer state
  sessionElapsedMs: 0,
  currentTaskElapsedMs: 0,
  currentTaskIndex: 0,
  taskStartSessionElapsedMs: 0,
  totalAllocatedMs: 0,

  // Transition
  isInTransition: false,
  transitionFromTaskId: null,
  transitionToTaskId: null,

  // Warning
  isWarningActive: false,

  // Break
  isOnBreak: false,
  breakElapsedMs: 0,
  breakPlannedDurationSec: null,
  activeBreakId: null,

  // Pause
  totalPauseMs: 0,
  totalBreakMs: 0,
  pauseStartedAt: null,

  // Reminders
  firedReminderIds: [],
  pendingReminderPrompt: null,

  // UI
  showLogPrompt: false,
  showBreakPrompt: false,
  showEndConfirm: false,
  showSetupModal: false,
  showExtendMenu: false,

  // Actions
  initSession: (sessionId, totalAllocatedMs) =>
    set({
      activeSessionId: sessionId,
      sessionStatus: 'active',
      sessionElapsedMs: 0,
      currentTaskElapsedMs: 0,
      currentTaskIndex: 0,
      taskStartSessionElapsedMs: 0,
      totalAllocatedMs,
      isInTransition: false,
      isWarningActive: false,
      isOnBreak: false,
      breakElapsedMs: 0,
      breakPlannedDurationSec: null,
      activeBreakId: null,
      totalPauseMs: 0,
      totalBreakMs: 0,
      pauseStartedAt: null,
      firedReminderIds: [],
      pendingReminderPrompt: null,
      showLogPrompt: false,
      showBreakPrompt: false,
      showEndConfirm: false,
      showExtendMenu: false,
    }),

  clearSession: () =>
    set({
      activeSessionId: null,
      sessionStatus: null,
      sessionElapsedMs: 0,
      currentTaskElapsedMs: 0,
      currentTaskIndex: 0,
      taskStartSessionElapsedMs: 0,
      totalAllocatedMs: 0,
      isInTransition: false,
      transitionFromTaskId: null,
      transitionToTaskId: null,
      isWarningActive: false,
      isOnBreak: false,
      breakElapsedMs: 0,
      breakPlannedDurationSec: null,
      activeBreakId: null,
      totalPauseMs: 0,
      totalBreakMs: 0,
      pauseStartedAt: null,
      firedReminderIds: [],
      pendingReminderPrompt: null,
      showLogPrompt: false,
      showBreakPrompt: false,
      showEndConfirm: false,
      showSetupModal: false,
      showExtendMenu: false,
    }),

  setSessionStatus: (status) => set({ sessionStatus: status }),
  setCurrentTaskIndex: (index, sessionElapsedAtStart) => set((state) => ({
    currentTaskIndex: index,
    currentTaskElapsedMs: 0,
    taskStartSessionElapsedMs: sessionElapsedAtStart ?? state.sessionElapsedMs,
    isWarningActive: false,
  })),
  setCurrentTaskElapsedMs: (ms) => set({ currentTaskElapsedMs: ms }),
  setSessionElapsedMs: (ms) => set({ sessionElapsedMs: ms }),
  setTotalAllocatedMs: (ms) => set({ totalAllocatedMs: ms }),

  enterTransition: (fromId, toId) =>
    set({
      isInTransition: true,
      transitionFromTaskId: fromId,
      transitionToTaskId: toId,
      isWarningActive: false,
    }),

  exitTransition: () =>
    set({
      isInTransition: false,
      transitionFromTaskId: null,
      transitionToTaskId: null,
    }),

  setWarningActive: (active) => set({ isWarningActive: active }),

  startBreak: (breakId, plannedSec) =>
    set({
      isOnBreak: true,
      breakElapsedMs: 0,
      breakPlannedDurationSec: plannedSec,
      activeBreakId: breakId,
    }),

  endBreak: () =>
    set((state) => ({
      isOnBreak: false,
      breakElapsedMs: 0,
      breakPlannedDurationSec: null,
      activeBreakId: null,
      totalBreakMs: state.totalBreakMs + state.breakElapsedMs,
    })),

  setBreakElapsedMs: (ms) => set({ breakElapsedMs: ms }),

  startPause: () => set({ pauseStartedAt: Date.now() }),

  endPause: (accumulatedPauseMs) =>
    set({
      pauseStartedAt: null,
      totalPauseMs: accumulatedPauseMs,
    }),

  setTotalPauseMs: (ms) => set({ totalPauseMs: ms }),
  setTotalBreakMs: (ms) => set({ totalBreakMs: ms }),

  addFiredReminder: (id) =>
    set((state) => ({
      firedReminderIds: [...state.firedReminderIds, id],
    })),

  setPendingReminderPrompt: (reminder) => set({ pendingReminderPrompt: reminder }),

  setShowLogPrompt: (show) => set({ showLogPrompt: show }),
  setShowBreakPrompt: (show) => set({ showBreakPrompt: show }),
  setShowEndConfirm: (show) => set({ showEndConfirm: show }),
  setShowSetupModal: (show) => set({ showSetupModal: show }),
  setShowExtendMenu: (show) => set({ showExtendMenu: show }),
}))
