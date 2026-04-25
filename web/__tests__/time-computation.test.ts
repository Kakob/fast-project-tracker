import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests the core time computation used by FocusSessionProvider:
 *   elapsed = Date.now() - startedAt - totalPauseMs - totalBreakMs
 *
 * This is the formula that determines what the timer displays.
 */

// Extract the computation as a pure function for testing
function computeSessionElapsed(
  now: number,
  startedAt: number,
  totalPauseMs: number,
  totalBreakMs: number
): number {
  return now - startedAt - totalPauseMs - totalBreakMs
}

describe('time computation', () => {
  it('elapsed equals wall clock time when no pauses or breaks', () => {
    const startedAt = 1000
    const now = 11000 // 10 seconds later
    expect(computeSessionElapsed(now, startedAt, 0, 0)).toBe(10000)
  })

  it('subtracts pause time from elapsed', () => {
    const startedAt = 1000
    const now = 21000 // 20 seconds of wall clock
    const totalPauseMs = 5000 // 5 seconds paused
    expect(computeSessionElapsed(now, startedAt, totalPauseMs, 0)).toBe(15000)
  })

  it('subtracts break time from elapsed', () => {
    const startedAt = 1000
    const now = 31000 // 30 seconds of wall clock
    const totalBreakMs = 10000 // 10 seconds on break
    expect(computeSessionElapsed(now, startedAt, 0, totalBreakMs)).toBe(20000)
  })

  it('subtracts both pause and break time', () => {
    const startedAt = 1000
    const now = 61000 // 60 seconds of wall clock
    const totalPauseMs = 10000 // 10 seconds paused
    const totalBreakMs = 5000 // 5 seconds on break
    // 60 - 10 - 5 = 45 seconds of active work
    expect(computeSessionElapsed(now, startedAt, totalPauseMs, totalBreakMs)).toBe(45000)
  })

  it('elapsed is 0 at session start', () => {
    const startedAt = 50000
    const now = 50000
    expect(computeSessionElapsed(now, startedAt, 0, 0)).toBe(0)
  })

  it('multiple pauses accumulate correctly', () => {
    const startedAt = 0
    const now = 120000 // 2 minutes wall clock
    // Paused twice: 15s + 25s = 40s total
    const totalPauseMs = 40000
    expect(computeSessionElapsed(now, startedAt, totalPauseMs, 0)).toBe(80000) // 80s active
  })

  it('after resume, elapsed continues from where it was', () => {
    const startedAt = 0

    // At t=10s: elapsed = 10s
    expect(computeSessionElapsed(10000, startedAt, 0, 0)).toBe(10000)

    // Pause for 5 seconds (t=10s to t=15s). totalPauseMs = 5000
    // At t=15s after resume: elapsed should still be ~10s
    expect(computeSessionElapsed(15000, startedAt, 5000, 0)).toBe(10000)

    // 3 more seconds of work (t=18s): elapsed = 13s
    expect(computeSessionElapsed(18000, startedAt, 5000, 0)).toBe(13000)
  })
})

describe('formatTime', () => {
  // Import the component's format function pattern
  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  it('formats 0ms as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats seconds correctly', () => {
    expect(formatTime(5000)).toBe('0:05')
    expect(formatTime(59000)).toBe('0:59')
  })

  it('formats minutes correctly', () => {
    expect(formatTime(60000)).toBe('1:00')
    expect(formatTime(61000)).toBe('1:01')
    expect(formatTime(600000)).toBe('10:00')
  })

  it('formats hours correctly', () => {
    expect(formatTime(3600000)).toBe('1:00:00')
    expect(formatTime(3661000)).toBe('1:01:01')
  })

  it('handles negative values as 0:00', () => {
    expect(formatTime(-1000)).toBe('0:00')
  })

  it('formats 15 minutes correctly', () => {
    expect(formatTime(900000)).toBe('15:00')
  })
})

describe('per-task elapsed', () => {
  function computeTaskElapsed(sessionElapsedMs: number, taskStartSessionElapsedMs: number): number {
    return sessionElapsedMs - taskStartSessionElapsedMs
  }

  it('task elapsed is 0 at task start', () => {
    expect(computeTaskElapsed(30000, 30000)).toBe(0)
  })

  it('task elapsed tracks time since task started', () => {
    // Session started at 0, first task started at 0, 10s later
    expect(computeTaskElapsed(10000, 0)).toBe(10000)
  })

  it('task elapsed resets when moving to next task', () => {
    // First task ran for 30s. Second task starts at sessionElapsed=30000
    expect(computeTaskElapsed(30000, 30000)).toBe(0)
    // 5s into second task
    expect(computeTaskElapsed(35000, 30000)).toBe(5000)
  })

  it('task elapsed is independent of previous tasks', () => {
    // Session elapsed = 120s, task 3 started at 90s
    expect(computeTaskElapsed(120000, 90000)).toBe(30000) // 30s on current task
  })
})

describe('warning zone', () => {
  function shouldWarn(taskElapsedMs: number, allocatedMs: number, warningBufferSec: number): boolean {
    const remaining = allocatedMs - taskElapsedMs
    const warningMs = warningBufferSec * 1000
    return remaining <= warningMs && remaining > 0
  }

  it('no warning when plenty of time remains', () => {
    // 5 min task, 3 min buffer, only 1 min elapsed
    expect(shouldWarn(60000, 300000, 180)).toBe(false)
  })

  it('warning fires when remaining <= buffer', () => {
    // 5 min task, 3 min buffer, 2:01 elapsed (2:59 remaining)
    expect(shouldWarn(121000, 300000, 180)).toBe(true)
  })

  it('no warning after time expired', () => {
    // Time is up -- remaining is 0 or negative
    expect(shouldWarn(300000, 300000, 180)).toBe(false)
    expect(shouldWarn(310000, 300000, 180)).toBe(false)
  })

  it('warning with 0 buffer never fires', () => {
    expect(shouldWarn(299000, 300000, 0)).toBe(false)
  })

  it('warning fires at exact boundary', () => {
    // 5 min task, 3 min buffer, exactly 2 min elapsed (3 min remaining = buffer)
    expect(shouldWarn(120000, 300000, 180)).toBe(true)
  })
})

describe('auto-advance', () => {
  function shouldAutoAdvance(taskElapsedMs: number, allocatedMs: number): boolean {
    return taskElapsedMs >= allocatedMs
  }

  it('does not advance when time remains', () => {
    expect(shouldAutoAdvance(60000, 300000)).toBe(false)
  })

  it('advances when time expires', () => {
    expect(shouldAutoAdvance(300000, 300000)).toBe(true)
  })

  it('advances when time exceeded', () => {
    expect(shouldAutoAdvance(310000, 300000)).toBe(true)
  })
})

describe('formatDuration', () => {
  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1m 5s')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(3660000)).toBe('1h 1m')
  })

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0s')
  })
})
