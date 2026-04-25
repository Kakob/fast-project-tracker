import { describe, it, expect, beforeEach } from 'vitest'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'

// Reset store before each test
beforeEach(() => {
  useFocusSessionStore.getState().clearSession()
})

describe('focus-session-store', () => {
  describe('initSession', () => {
    it('sets activeSessionId and sessionStatus to active', () => {
      useFocusSessionStore.getState().initSession('session-1', 900000)

      const s = useFocusSessionStore.getState()
      expect(s.activeSessionId).toBe('session-1')
      expect(s.sessionStatus).toBe('active')
      expect(s.totalAllocatedMs).toBe(900000)
    })

    it('resets all timer state to zero', () => {
      const store = useFocusSessionStore.getState()
      store.setSessionElapsedMs(5000)
      store.setCurrentTaskElapsedMs(3000)
      store.setTotalPauseMs(1000)

      store.initSession('session-2', 600000)

      const s = useFocusSessionStore.getState()
      expect(s.sessionElapsedMs).toBe(0)
      expect(s.currentTaskElapsedMs).toBe(0)
      expect(s.totalPauseMs).toBe(0)
      expect(s.totalBreakMs).toBe(0)
      expect(s.currentTaskIndex).toBe(0)
    })

    it('resets UI state', () => {
      const store = useFocusSessionStore.getState()
      store.setShowLogPrompt(true)
      store.setShowBreakPrompt(true)
      store.setShowEndConfirm(true)

      store.initSession('session-3', 300000)

      const s = useFocusSessionStore.getState()
      expect(s.showLogPrompt).toBe(false)
      expect(s.showBreakPrompt).toBe(false)
      expect(s.showEndConfirm).toBe(false)
    })
  })

  describe('clearSession', () => {
    it('resets everything to null/default', () => {
      const store = useFocusSessionStore.getState()
      store.initSession('session-1', 900000)
      store.setSessionElapsedMs(5000)
      store.setSessionStatus('paused')

      store.clearSession()

      const s = useFocusSessionStore.getState()
      expect(s.activeSessionId).toBeNull()
      expect(s.sessionStatus).toBeNull()
      expect(s.sessionElapsedMs).toBe(0)
      expect(s.currentTaskElapsedMs).toBe(0)
      expect(s.totalAllocatedMs).toBe(0)
    })
  })

  describe('pause / resume', () => {
    beforeEach(() => {
      useFocusSessionStore.getState().initSession('session-1', 900000)
    })

    it('startPause sets pauseStartedAt to a timestamp', () => {
      const before = Date.now()
      useFocusSessionStore.getState().startPause()
      const after = Date.now()

      const s = useFocusSessionStore.getState()
      expect(s.pauseStartedAt).toBeGreaterThanOrEqual(before)
      expect(s.pauseStartedAt).toBeLessThanOrEqual(after)
    })

    it('endPause clears pauseStartedAt and sets totalPauseMs', () => {
      useFocusSessionStore.getState().startPause()
      useFocusSessionStore.getState().endPause(5000)

      const s = useFocusSessionStore.getState()
      expect(s.pauseStartedAt).toBeNull()
      expect(s.totalPauseMs).toBe(5000)
    })

    it('endPause accumulates across multiple pauses', () => {
      const store = useFocusSessionStore.getState()
      store.startPause()
      store.endPause(3000) // first pause: 3s

      store.startPause()
      store.endPause(8000) // total now: 8s (3s first + 5s second)

      expect(useFocusSessionStore.getState().totalPauseMs).toBe(8000)
    })
  })

  describe('break', () => {
    beforeEach(() => {
      useFocusSessionStore.getState().initSession('session-1', 900000)
    })

    it('startBreak sets break state', () => {
      useFocusSessionStore.getState().startBreak('break-1', 180)

      const s = useFocusSessionStore.getState()
      expect(s.isOnBreak).toBe(true)
      expect(s.activeBreakId).toBe('break-1')
      expect(s.breakPlannedDurationSec).toBe(180)
      expect(s.breakElapsedMs).toBe(0)
    })

    it('startBreak with null duration is pause-style', () => {
      useFocusSessionStore.getState().startBreak('break-2', null)

      const s = useFocusSessionStore.getState()
      expect(s.isOnBreak).toBe(true)
      expect(s.breakPlannedDurationSec).toBeNull()
    })

    it('endBreak clears break state and accumulates totalBreakMs', () => {
      useFocusSessionStore.getState().startBreak('break-1', 60)
      useFocusSessionStore.getState().setBreakElapsedMs(45000)
      useFocusSessionStore.getState().endBreak()

      const s = useFocusSessionStore.getState()
      expect(s.isOnBreak).toBe(false)
      expect(s.activeBreakId).toBeNull()
      expect(s.breakElapsedMs).toBe(0)
      expect(s.totalBreakMs).toBe(45000)
    })

    it('endBreak accumulates across multiple breaks', () => {
      const store = useFocusSessionStore.getState()

      store.startBreak('break-1', 60)
      store.setBreakElapsedMs(30000)
      store.endBreak() // totalBreakMs = 30000

      store.startBreak('break-2', 60)
      store.setBreakElapsedMs(20000)
      store.endBreak() // totalBreakMs = 30000 + 20000 = 50000

      expect(useFocusSessionStore.getState().totalBreakMs).toBe(50000)
    })
  })

  describe('task transitions', () => {
    beforeEach(() => {
      useFocusSessionStore.getState().initSession('session-1', 900000)
    })

    it('setCurrentTaskIndex resets task elapsed and warning', () => {
      const store = useFocusSessionStore.getState()
      store.setCurrentTaskElapsedMs(50000)
      store.setWarningActive(true)

      store.setCurrentTaskIndex(1, 50000)

      const s = useFocusSessionStore.getState()
      expect(s.currentTaskIndex).toBe(1)
      expect(s.currentTaskElapsedMs).toBe(0)
      expect(s.isWarningActive).toBe(false)
    })

    it('setCurrentTaskIndex stores taskStartSessionElapsedMs', () => {
      useFocusSessionStore.getState().setSessionElapsedMs(30000)
      useFocusSessionStore.getState().setCurrentTaskIndex(1, 30000)

      const s = useFocusSessionStore.getState()
      expect(s.taskStartSessionElapsedMs).toBe(30000)
    })

    it('taskStartSessionElapsedMs defaults to current sessionElapsedMs', () => {
      useFocusSessionStore.getState().setSessionElapsedMs(20000)
      useFocusSessionStore.getState().setCurrentTaskIndex(2)

      expect(useFocusSessionStore.getState().taskStartSessionElapsedMs).toBe(20000)
    })

    it('initSession sets taskStartSessionElapsedMs to 0', () => {
      useFocusSessionStore.getState().setCurrentTaskIndex(1, 50000)
      useFocusSessionStore.getState().initSession('session-2', 600000)

      expect(useFocusSessionStore.getState().taskStartSessionElapsedMs).toBe(0)
    })

    it('enterTransition sets transition state', () => {
      useFocusSessionStore.getState().enterTransition('task-a', 'task-b')

      const s = useFocusSessionStore.getState()
      expect(s.isInTransition).toBe(true)
      expect(s.transitionFromTaskId).toBe('task-a')
      expect(s.transitionToTaskId).toBe('task-b')
      expect(s.isWarningActive).toBe(false)
    })

    it('exitTransition clears transition state', () => {
      useFocusSessionStore.getState().enterTransition('task-a', 'task-b')
      useFocusSessionStore.getState().exitTransition()

      const s = useFocusSessionStore.getState()
      expect(s.isInTransition).toBe(false)
      expect(s.transitionFromTaskId).toBeNull()
      expect(s.transitionToTaskId).toBeNull()
    })
  })

  describe('session status', () => {
    it('setSessionStatus updates status', () => {
      useFocusSessionStore.getState().initSession('s-1', 900000)
      useFocusSessionStore.getState().setSessionStatus('paused')
      expect(useFocusSessionStore.getState().sessionStatus).toBe('paused')
    })

    it('setSessionStatus to completed', () => {
      useFocusSessionStore.getState().initSession('s-1', 900000)
      useFocusSessionStore.getState().setSessionStatus('completed')
      expect(useFocusSessionStore.getState().sessionStatus).toBe('completed')
    })
  })

  describe('reminders', () => {
    beforeEach(() => {
      useFocusSessionStore.getState().initSession('session-1', 900000)
    })

    it('addFiredReminder appends to list', () => {
      const store = useFocusSessionStore.getState()
      store.addFiredReminder('r-1')
      store.addFiredReminder('r-2')

      const s = useFocusSessionStore.getState()
      expect(s.firedReminderIds).toEqual(['r-1', 'r-2'])
    })

    it('initSession resets firedReminderIds', () => {
      useFocusSessionStore.getState().addFiredReminder('r-1')
      useFocusSessionStore.getState().initSession('session-2', 600000)

      expect(useFocusSessionStore.getState().firedReminderIds).toEqual([])
    })
  })
})
