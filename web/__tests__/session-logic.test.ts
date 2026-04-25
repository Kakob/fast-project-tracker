import { describe, it, expect, beforeEach } from 'vitest'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'

beforeEach(() => {
  useFocusSessionStore.getState().clearSession()
})

describe('session lifecycle', () => {
  it('full flow: init → pause → resume → complete', () => {
    const store = useFocusSessionStore.getState

    store().initSession('s-1', 900000)
    expect(store().sessionStatus).toBe('active')
    expect(store().activeSessionId).toBe('s-1')

    store().setSessionElapsedMs(30000)
    store().setCurrentTaskElapsedMs(30000)

    // Pause
    store().startPause()
    store().setSessionStatus('paused')
    expect(store().sessionStatus).toBe('paused')
    expect(store().pauseStartedAt).not.toBeNull()

    // Resume (5 seconds of pause)
    const pauseDuration = 5000
    const newTotalPause = store().totalPauseMs + pauseDuration
    store().endPause(newTotalPause)
    store().setSessionStatus('active')
    expect(store().sessionStatus).toBe('active')
    expect(store().pauseStartedAt).toBeNull()
    expect(store().totalPauseMs).toBe(5000)

    // Complete
    store().setSessionStatus('completed')
    expect(store().sessionStatus).toBe('completed')
  })

  it('multi-task flow: task 0 → done → task 1 → done → completed', () => {
    const store = useFocusSessionStore.getState

    store().initSession('s-1', 600000)
    expect(store().currentTaskIndex).toBe(0)
    expect(store().taskStartSessionElapsedMs).toBe(0)

    // Work on task 0 for 5 min
    store().setSessionElapsedMs(300000)

    // Transition to task 1
    store().enterTransition('task-a', 'task-b')
    expect(store().isInTransition).toBe(true)

    store().exitTransition()
    store().setCurrentTaskIndex(1, 300000)
    expect(store().currentTaskIndex).toBe(1)
    expect(store().taskStartSessionElapsedMs).toBe(300000)
    expect(store().currentTaskElapsedMs).toBe(0)
    expect(store().isInTransition).toBe(false)

    // Work on task 1
    store().setSessionElapsedMs(450000)
    const taskElapsed = store().sessionElapsedMs - store().taskStartSessionElapsedMs
    expect(taskElapsed).toBe(150000)

    store().setSessionStatus('completed')
    expect(store().sessionStatus).toBe('completed')
  })

  it('break flow: active → break → end break → active', () => {
    const store = useFocusSessionStore.getState

    store().initSession('s-1', 900000)
    store().setSessionElapsedMs(60000)

    store().startBreak('break-1', 180)
    store().setSessionStatus('paused')
    expect(store().isOnBreak).toBe(true)
    expect(store().sessionStatus).toBe('paused')

    store().setBreakElapsedMs(120000)

    store().endBreak()
    store().setSessionStatus('active')
    expect(store().isOnBreak).toBe(false)
    expect(store().sessionStatus).toBe('active')
    expect(store().totalBreakMs).toBe(120000)
    expect(store().breakElapsedMs).toBe(0)
  })

  it('abandon session preserves state for summary', () => {
    const store = useFocusSessionStore.getState

    store().initSession('s-1', 900000)
    store().setSessionElapsedMs(120000)
    store().setCurrentTaskElapsedMs(120000)

    store().setSessionStatus('abandoned')
    expect(store().sessionStatus).toBe('abandoned')
    expect(store().sessionElapsedMs).toBe(120000)
    expect(store().activeSessionId).toBe('s-1')
  })

  it('clearSession after summary resets everything', () => {
    const store = useFocusSessionStore.getState

    store().initSession('s-1', 900000)
    store().setSessionElapsedMs(120000)
    store().setSessionStatus('completed')

    store().clearSession()
    expect(store().activeSessionId).toBeNull()
    expect(store().sessionStatus).toBeNull()
    expect(store().sessionElapsedMs).toBe(0)
    expect(store().taskStartSessionElapsedMs).toBe(0)
  })
})

describe('pause time does not cause timer jump', () => {
  // Simulates the exact computation the provider does:
  // elapsed = Date.now() - startedAt - totalPauseMs - totalBreakMs
  function computeElapsed(now: number, startedAt: number, totalPauseMs: number, totalBreakMs: number) {
    return now - startedAt - totalPauseMs - totalBreakMs
  }

  it('10s work, 5s pause, resume → elapsed stays at 10s', () => {
    const startedAt = 0
    // Work 10 seconds
    expect(computeElapsed(10000, startedAt, 0, 0)).toBe(10000)
    // Pause 5 seconds → totalPauseMs = 5000
    // After resume at t=15000:
    expect(computeElapsed(15000, startedAt, 5000, 0)).toBe(10000) // still 10s
    // Work 3 more seconds (t=18000):
    expect(computeElapsed(18000, startedAt, 5000, 0)).toBe(13000)
  })

  it('multiple pauses accumulate correctly', () => {
    const startedAt = 0
    // Work 20s, pause 10s, work 30s, pause 5s, resume
    // totalPauseMs = 15000, now = 65000
    expect(computeElapsed(65000, startedAt, 15000, 0)).toBe(50000)
  })

  it('break time also subtracted', () => {
    const startedAt = 0
    // 60s wall clock, 10s pause, 5s break → 45s active
    expect(computeElapsed(60000, startedAt, 10000, 5000)).toBe(45000)
  })
})

describe('per-task elapsed tracking', () => {
  it('first task: taskElapsed = sessionElapsed (both start at 0)', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 600000)

    store().setSessionElapsedMs(25000)
    const taskElapsed = store().sessionElapsedMs - store().taskStartSessionElapsedMs
    expect(taskElapsed).toBe(25000)
  })

  it('second task: taskElapsed resets to 0 at transition', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 600000)

    // First task runs for 2 min
    store().setSessionElapsedMs(120000)

    // Advance to task 1
    store().setCurrentTaskIndex(1, 120000)
    expect(store().taskStartSessionElapsedMs).toBe(120000)
    expect(store().currentTaskElapsedMs).toBe(0)

    // 30s into second task
    store().setSessionElapsedMs(150000)
    const taskElapsed = store().sessionElapsedMs - store().taskStartSessionElapsedMs
    expect(taskElapsed).toBe(30000)
  })

  it('third task after two completed tasks', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)

    // Task 0: 60s
    store().setSessionElapsedMs(60000)
    store().setCurrentTaskIndex(1, 60000)

    // Task 1: 90s
    store().setSessionElapsedMs(150000)
    store().setCurrentTaskIndex(2, 150000)

    // 20s into task 2
    store().setSessionElapsedMs(170000)
    const taskElapsed = store().sessionElapsedMs - store().taskStartSessionElapsedMs
    expect(taskElapsed).toBe(20000)
  })
})

describe('skip behavior', () => {
  it('skip sets task status without completing', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 600000)

    // Simulate skip: enter transition, advance
    store().setSessionElapsedMs(30000)
    store().enterTransition('task-a', 'task-b')
    expect(store().isInTransition).toBe(true)

    store().exitTransition()
    store().setCurrentTaskIndex(1, 30000)
    expect(store().currentTaskIndex).toBe(1)
    expect(store().currentTaskElapsedMs).toBe(0)
  })

  it('skip last task completes session', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 300000) // 1 task

    store().setSessionElapsedMs(30000)
    // No next task → session complete
    store().setSessionStatus('completed')
    expect(store().sessionStatus).toBe('completed')
  })
})

describe('warning zone state', () => {
  it('setWarningActive toggles warning state', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 300000)

    expect(store().isWarningActive).toBe(false)
    store().setWarningActive(true)
    expect(store().isWarningActive).toBe(true)
  })

  it('warning resets when advancing to next task', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 600000)

    store().setWarningActive(true)
    expect(store().isWarningActive).toBe(true)

    store().setCurrentTaskIndex(1, 300000)
    expect(store().isWarningActive).toBe(false)
  })

  it('warning resets on enterTransition', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 600000)

    store().setWarningActive(true)
    store().enterTransition('a', 'b')
    expect(store().isWarningActive).toBe(false)
  })
})

describe('keyboard blocking during break', () => {
  // This tests the guard logic used in the keyboard handler:
  // if (s.isOnBreak || s.showBreakPrompt) return
  function shouldBlockKeyboard(s: { isOnBreak: boolean; showBreakPrompt: boolean; showLogPrompt: boolean; showEndConfirm: boolean }) {
    return s.showLogPrompt || s.showEndConfirm || s.isOnBreak || s.showBreakPrompt
  }

  it('blocks keyboard during active break', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)
    store().startBreak('b-1', 60)

    expect(shouldBlockKeyboard(store())).toBe(true)
  })

  it('blocks keyboard when break prompt is showing', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)
    store().setShowBreakPrompt(true)

    expect(shouldBlockKeyboard(store())).toBe(true)
  })

  it('blocks keyboard when log prompt is showing', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)
    store().setShowLogPrompt(true)

    expect(shouldBlockKeyboard(store())).toBe(true)
  })

  it('blocks keyboard when end confirm is showing', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)
    store().setShowEndConfirm(true)

    expect(shouldBlockKeyboard(store())).toBe(true)
  })

  it('allows keyboard during normal active session', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)

    expect(shouldBlockKeyboard(store())).toBe(false)
  })
})

describe('end session data assembly', () => {
  // Simulates the data assembly logic from handleEndSession
  function assembleEndData(
    sessionTasks: Array<{ id: string; task_id: string; status: string; actual_time_ms: number }>,
    currentTaskId: string | undefined,
    currentTaskElapsedMs: number
  ) {
    return sessionTasks.map((st) => ({
      task_id: st.task_id,
      actual_time_ms: st.id === currentTaskId ? currentTaskElapsedMs : st.actual_time_ms,
      status: st.id === currentTaskId && st.status === 'active' ? 'paused_incomplete' : st.status,
    }))
  }

  it('current active task gets paused_incomplete status and current elapsed', () => {
    const tasks = [
      { id: 'st-1', task_id: 't-1', status: 'completed', actual_time_ms: 120000 },
      { id: 'st-2', task_id: 't-2', status: 'active', actual_time_ms: 0 },
      { id: 'st-3', task_id: 't-3', status: 'pending', actual_time_ms: 0 },
    ]

    const result = assembleEndData(tasks, 'st-2', 45000)

    expect(result[0]).toEqual({ task_id: 't-1', actual_time_ms: 120000, status: 'completed' })
    expect(result[1]).toEqual({ task_id: 't-2', actual_time_ms: 45000, status: 'paused_incomplete' })
    expect(result[2]).toEqual({ task_id: 't-3', actual_time_ms: 0, status: 'pending' })
  })

  it('already completed tasks keep their status', () => {
    const tasks = [
      { id: 'st-1', task_id: 't-1', status: 'completed', actual_time_ms: 300000 },
    ]

    const result = assembleEndData(tasks, undefined, 0)
    expect(result[0].status).toBe('completed')
    expect(result[0].actual_time_ms).toBe(300000)
  })

  it('skipped tasks keep skipped status', () => {
    const tasks = [
      { id: 'st-1', task_id: 't-1', status: 'skipped', actual_time_ms: 15000 },
    ]

    const result = assembleEndData(tasks, undefined, 0)
    expect(result[0].status).toBe('skipped')
  })
})

describe('extend time', () => {
  it('extending does not affect taskStartSessionElapsedMs', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 300000)
    store().setSessionElapsedMs(60000)

    const startBefore = store().taskStartSessionElapsedMs
    // Extensions happen at the DB level (session_tasks.extensions_ms)
    // Store just clears warning
    store().setWarningActive(false)

    expect(store().taskStartSessionElapsedMs).toBe(startBefore)
  })
})

describe('multiple breaks accumulate', () => {
  it('two breaks add up in totalBreakMs', () => {
    const store = useFocusSessionStore.getState
    store().initSession('s-1', 900000)

    // Break 1: 30s
    store().startBreak('b-1', 60)
    store().setBreakElapsedMs(30000)
    store().endBreak()
    expect(store().totalBreakMs).toBe(30000)

    // Break 2: 20s
    store().startBreak('b-2', 60)
    store().setBreakElapsedMs(20000)
    store().endBreak()
    expect(store().totalBreakMs).toBe(50000)
  })
})
