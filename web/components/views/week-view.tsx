'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Item } from '@/types'
import { STATUS_CONFIG } from '@/types'
import { useCreateItem, useUpdateItem } from '@/lib/hooks/use-items'
import { useUIStore } from '@/lib/stores/ui-store'

const HOUR_HEIGHT = 60 // 1px per minute
const SNAP_MINUTES = 15
const MIN_DURATION = 15
const HOUR_LABEL_WIDTH = 60
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface ScheduledItem extends Item {
  startMin: number
  endMin: number
  dayIdx: number
}

interface LaidOutItem extends ScheduledItem {
  lane: number
  totalLanes: number
}

type DragState =
  | {
      kind: 'move'
      itemId: string
      grabOffsetMin: number
      grabDayIdx: number
      duration: number
    }
  | {
      kind: 'resize'
      itemId: string
      originStartMin: number
      originDuration: number
      originDayIdx: number
    }
  | {
      kind: 'create'
      originMin: number
      dayIdx: number
    }
  | null

interface PreviewState {
  kind: 'move' | 'resize' | 'create'
  itemId: string | null
  startMin: number
  duration: number
  dayIdx: number
}

interface WeekViewProps {
  items: Item[] | undefined
  currentDate: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}

export function WeekView({ items, currentDate, onPrevWeek, onNextWeek, onToday }: WeekViewProps) {
  const updateItem = useUpdateItem()
  const createItem = useCreateItem()
  const openDetailsPanel = useUIStore((s) => s.openDetailsPanel)
  const setFocusedItemId = useUIStore((s) => s.setFocusedItemId)
  const focusedItemId = useUIStore((s) => s.focusedItemId)
  const setAutoClearTitleItemId = useUIStore((s) => s.setAutoClearTitleItemId)

  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const createDragMovedRef = useRef(false)
  const [drag, setDrag] = useState<DragState>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)

  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [currentDate])

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d
      }),
    [weekStart]
  )

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + 7)
    return d
  }, [weekStart])

  const scheduledByDay = useMemo(() => {
    const byDay: ScheduledItem[][] = Array.from({ length: 7 }, () => [])
    items?.forEach((item) => {
      if (!item.scheduled_start || item.status === 'archived') return
      const start = new Date(item.scheduled_start)
      if (start < weekStart || start >= weekEnd) return
      const dayIdx = Math.floor(
        (start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)
      )
      const startMin = start.getHours() * 60 + start.getMinutes()
      const duration = item.duration_minutes ?? 30
      const endMin = Math.min(startMin + duration, 24 * 60)
      byDay[dayIdx].push({ ...item, startMin, endMin, dayIdx })
    })
    return byDay
  }, [items, weekStart, weekEnd])

  const laidOutByDay = useMemo(() => {
    return scheduledByDay.map((dayEvents) => layoutLanes(dayEvents))
  }, [scheduledByDay])

  // Original day of the currently-dragged item (so we know to draw a ghost
  // when the preview lands in a different column).
  const draggedHomeDayIdx = useMemo(() => {
    if (!drag || drag.kind === 'create') return -1
    for (let i = 0; i < laidOutByDay.length; i++) {
      if (laidOutByDay[i].some((ev) => ev.id === drag.itemId)) return i
    }
    return -1
  }, [drag, laidOutByDay])

  // Auto-scroll to 7am once
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT
    }
  }, [])

  // Update "now" indicator each minute
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Mouse-based drag handling
  useEffect(() => {
    if (!drag) return

    const onMove = (e: MouseEvent) => {
      const grid = gridRef.current
      if (!grid) return
      const rect = grid.getBoundingClientRect()
      const dayColWidth = (rect.width - HOUR_LABEL_WIDTH) / 7
      const relY = e.clientY - rect.top
      const cursorMin = clamp(snap(relY), 0, 24 * 60)

      if (drag.kind === 'move') {
        const relX = e.clientX - rect.left - HOUR_LABEL_WIDTH
        const dayIdx = clamp(Math.floor(relX / dayColWidth), 0, 6)
        const newStart = clamp(
          snap(cursorMin - drag.grabOffsetMin),
          0,
          24 * 60 - drag.duration
        )
        setPreview({
          kind: 'move',
          itemId: drag.itemId,
          startMin: newStart,
          duration: drag.duration,
          dayIdx,
        })
      } else if (drag.kind === 'resize') {
        // End-time = origin start + duration. Snap the end-time to a 5-min
        // boundary, then back out the duration so the bottom edge always
        // lands on a gridline (even if the start was unsnapped).
        const snappedEnd = snap(cursorMin)
        const newDuration = clamp(
          snappedEnd - drag.originStartMin,
          MIN_DURATION,
          24 * 60 - drag.originStartMin
        )
        setPreview({
          kind: 'resize',
          itemId: drag.itemId,
          startMin: drag.originStartMin,
          duration: newDuration,
          dayIdx: drag.originDayIdx,
        })
      } else {
        // Slot-based: the cursor's slot (floor of pixel / 15) is the "slot"
        // they're pointing at. Event spans from the top of the earliest slot
        // to the bottom of the latest slot.
        const currentSlot = clamp(
          floorSnap(relY),
          0,
          24 * 60 - SNAP_MINUTES
        )
        if (currentSlot !== drag.originMin) createDragMovedRef.current = true
        const lo = Math.min(drag.originMin, currentSlot)
        const hi = Math.max(drag.originMin, currentSlot)
        const duration = hi - lo + SNAP_MINUTES
        const startMin = clamp(lo, 0, 24 * 60 - duration)
        setPreview({
          kind: 'create',
          itemId: null,
          startMin,
          duration,
          dayIdx: drag.dayIdx,
        })
      }
    }

    const onUp = () => {
      const finalPreview = preview
      const currentDrag = drag
      setDrag(null)
      setPreview(null)
      if (!currentDrag) return
      if (currentDrag.kind === 'move') {
        if (!finalPreview) return
        const newDay = days[finalPreview.dayIdx]
        const newDate = new Date(newDay)
        newDate.setHours(0, 0, 0, 0)
        newDate.setMinutes(finalPreview.startMin)
        updateItem.mutate({
          id: currentDrag.itemId,
          scheduled_start: newDate.toISOString(),
        })
      } else if (currentDrag.kind === 'resize') {
        if (!finalPreview) return
        updateItem.mutate({
          id: currentDrag.itemId,
          duration_minutes: finalPreview.duration,
        })
      } else {
        // 'create' — if user only clicked (no drag), default to 30 min
        const dragged = createDragMovedRef.current
        createDragMovedRef.current = false
        const startMin = dragged && finalPreview ? finalPreview.startMin : currentDrag.originMin
        const duration = dragged && finalPreview ? finalPreview.duration : 30
        const dayIdx = dragged && finalPreview ? finalPreview.dayIdx : currentDrag.dayIdx
        const day = days[dayIdx]
        const start = new Date(day)
        start.setHours(0, 0, 0, 0)
        start.setMinutes(startMin)
        const clampedDuration = Math.min(duration, 24 * 60 - startMin)
        createItem
          .mutateAsync({
            title: 'New task',
            scheduled_start: start.toISOString(),
            duration_minutes: clampedDuration,
          })
          .then((created) => {
            setAutoClearTitleItemId(created.id)
            openDetailsPanel(created.id)
          })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, preview, updateItem, createItem, openDetailsPanel, setAutoClearTitleItemId, days])

  const startCreateDrag = (e: React.MouseEvent, dayIdx: number) => {
    if (e.button !== 0) return
    const grid = gridRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    // Use floor-snap: the slot you click in is the slot the event starts in
    const slotStart = clamp(
      floorSnap(e.clientY - rect.top),
      0,
      24 * 60 - SNAP_MINUTES
    )
    e.preventDefault() // suppress text selection while dragging
    createDragMovedRef.current = false
    setDrag({ kind: 'create', originMin: slotStart, dayIdx })
    setPreview({
      kind: 'create',
      itemId: null,
      startMin: slotStart,
      duration: 30,
      dayIdx,
    })
  }

  const startBlockDrag = (
    e: React.MouseEvent,
    item: ScheduledItem,
    kind: 'move' | 'resize'
  ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const grid = gridRef.current
    if (!grid) return
    if (kind === 'move') {
      const rect = grid.getBoundingClientRect()
      const cursorMin = e.clientY - rect.top
      const grabOffsetMin = cursorMin - item.startMin
      setDrag({
        kind: 'move',
        itemId: item.id,
        grabOffsetMin,
        grabDayIdx: item.dayIdx,
        duration: item.endMin - item.startMin,
      })
    } else {
      setDrag({
        kind: 'resize',
        itemId: item.id,
        originStartMin: item.startMin,
        originDuration: item.endMin - item.startMin,
        originDayIdx: item.dayIdx,
      })
    }
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 flex flex-col"
      style={{ maxHeight: 'calc(100vh - 140px)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">{formatRange(days)}</h2>
          <button
            onClick={onToday}
            className="px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevWeek}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onNextWeek}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-gray-200 bg-white">
        <div style={{ width: HOUR_LABEL_WIDTH }} className="flex-none" />
        {days.map((day, i) => {
          const today = isSameDay(day, now)
          return (
            <div key={i} className="flex-1 px-2 py-2 text-center border-l border-gray-100">
              <div className="text-[11px] uppercase text-gray-500 tracking-wide">
                {DAY_NAMES[i]}
              </div>
              <div
                className={
                  today
                    ? 'mt-0.5 inline-flex items-center justify-center w-7 h-7 text-sm font-semibold bg-indigo-600 text-white rounded-full'
                    : 'mt-0.5 text-sm font-medium text-gray-700'
                }
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      <div ref={scrollRef} className="overflow-y-auto flex-1">
        <div ref={gridRef} className="flex relative" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div
            style={{ width: HOUR_LABEL_WIDTH }}
            className="flex-none relative border-r border-gray-200"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-1 text-[10px] text-gray-400"
                style={{ top: h * HOUR_HEIGHT - 5 }}
              >
                {h === 0 ? '' : formatHourLabel(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const todayCol = isSameDay(day, now)
            const dayEvents = laidOutByDay[dayIdx]
            // If preview block is moving INTO this column, include it; if it's
            // moving OUT, hide its original render.
            const previewInThisCol =
              preview && preview.dayIdx === dayIdx ? preview : null
            return (
              <div
                key={dayIdx}
                onMouseDown={(e) => startCreateDrag(e, dayIdx)}
                className={`flex-1 relative border-l border-gray-100 select-none ${
                  todayCol ? 'bg-indigo-50/30' : ''
                } ${drag?.kind === 'create' ? 'cursor-ns-resize' : 'cursor-cell'}`}
              >
                {/* Hour gridlines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="border-b border-gray-100"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Half-hour faint lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={`half-${h}`}
                    className="absolute left-0 right-0 border-t border-dashed border-gray-100/70 pointer-events-none"
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const isPreview = preview?.itemId === ev.id
                  // Hide original if it's been moved to another column
                  if (isPreview && preview && preview.dayIdx !== dayIdx) return null
                  const startMin = isPreview && preview ? preview.startMin : ev.startMin
                  const duration =
                    isPreview && preview ? preview.duration : ev.endMin - ev.startMin
                  return (
                    <EventBlock
                      key={ev.id}
                      item={ev}
                      startMin={startMin}
                      duration={duration}
                      lane={ev.lane}
                      totalLanes={ev.totalLanes}
                      isFocused={focusedItemId === ev.id}
                      isDragging={drag?.kind !== 'create' && drag?.itemId === ev.id}
                      onMouseDown={(e, kind) => startBlockDrag(e, ev, kind)}
                      onClick={() => openDetailsPanel(ev.id)}
                      onMouseEnter={() => setFocusedItemId(ev.id)}
                    />
                  )
                })}

                {/* Ghost block: shown for create drags, or when moving an event INTO this column from another */}
                {previewInThisCol &&
                  (previewInThisCol.kind === 'create' ||
                    draggedHomeDayIdx !== dayIdx) && (
                    <PreviewGhost
                      startMin={previewInThisCol.startMin}
                      duration={previewInThisCol.duration}
                    />
                  )}

                {/* Now indicator */}
                {todayCol && <NowLine now={now} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EventBlock({
  item,
  startMin,
  duration,
  lane,
  totalLanes,
  isFocused,
  isDragging,
  onMouseDown,
  onClick,
  onMouseEnter,
}: {
  item: Item
  startMin: number
  duration: number
  lane: number
  totalLanes: number
  isFocused: boolean
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent, kind: 'move' | 'resize') => void
  onClick: () => void
  onMouseEnter: () => void
}) {
  const cfg = STATUS_CONFIG[item.status]
  const widthPct = 100 / totalLanes
  const leftPct = lane * widthPct
  const height = Math.max(duration, 14)

  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={(e) => {
        e.stopPropagation()
        if (!isDragging) onClick()
      }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement
        if (target.dataset.resize === 'true') return
        onMouseDown(e, 'move')
      }}
      className={`absolute text-[11px] px-1.5 py-0.5 rounded overflow-hidden border-l-2 ${cfg.bgColor} ${cfg.color} ${
        isFocused ? 'ring-2 ring-indigo-500 z-20' : 'z-10'
      } ${isDragging ? 'opacity-80 shadow-lg cursor-grabbing' : 'cursor-grab hover:brightness-95'}`}
      style={{
        top: startMin,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
        height,
        borderLeftColor: 'currentColor',
      }}
    >
      <div className="font-medium truncate leading-tight">{item.title}</div>
      {duration >= 25 && (
        <div className="text-[10px] opacity-70 leading-tight truncate">
          {formatTimeRange(startMin, duration)}
        </div>
      )}
      <div
        data-resize="true"
        onMouseDown={(e) => {
          e.stopPropagation()
          onMouseDown(e, 'resize')
        }}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
      />
    </div>
  )
}

function PreviewGhost({ startMin, duration }: { startMin: number; duration: number }) {
  return (
    <div
      className="absolute left-0.5 right-0.5 bg-indigo-200/60 border border-indigo-400 border-dashed rounded pointer-events-none z-30"
      style={{ top: startMin, height: Math.max(duration, 14) }}
    />
  )
}

function NowLine({ now }: { now: Date }) {
  const min = now.getHours() * 60 + now.getMinutes()
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-30"
      style={{ top: min - 1, height: 2, background: 'rgb(220, 38, 38)' }}
    >
      <div className="absolute -left-1 -top-1 w-3 h-3 rounded-full bg-red-600" />
    </div>
  )
}

function snap(min: number): number {
  return Math.round(min / SNAP_MINUTES) * SNAP_MINUTES
}

function floorSnap(min: number): number {
  return Math.floor(min / SNAP_MINUTES) * SNAP_MINUTES
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatHourLabel(h: number): string {
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatMin(m: number): string {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  const ampm = h < 12 ? 'a' : 'p'
  const hour12 = h % 12 || 12
  return mm === 0
    ? `${hour12}${ampm}`
    : `${hour12}:${String(mm).padStart(2, '0')}${ampm}`
}

function formatTimeRange(startMin: number, duration: number): string {
  return `${formatMin(startMin)}–${formatMin(startMin + duration)}`
}

function formatRange(days: Date[]): string {
  const first = days[0]
  const last = days[6]
  const monthFmt: Intl.DateTimeFormatOptions = { month: 'short' }
  const sameMonth = first.getMonth() === last.getMonth()
  const sameYear = first.getFullYear() === last.getFullYear()
  if (sameMonth && sameYear) {
    return `${first.toLocaleDateString(undefined, monthFmt)} ${first.getDate()}–${last.getDate()}, ${last.getFullYear()}`
  }
  if (sameYear) {
    return `${first.toLocaleDateString(undefined, monthFmt)} ${first.getDate()} – ${last.toLocaleDateString(undefined, monthFmt)} ${last.getDate()}, ${last.getFullYear()}`
  }
  return `${first.toLocaleDateString(undefined, monthFmt)} ${first.getDate()}, ${first.getFullYear()} – ${last.toLocaleDateString(undefined, monthFmt)} ${last.getDate()}, ${last.getFullYear()}`
}

function layoutLanes(events: ScheduledItem[]): LaidOutItem[] {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
  )
  const result: LaidOutItem[] = []
  let cluster: LaidOutItem[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const lanes: number[] = []
    for (const ev of cluster) {
      let laneIdx = lanes.findIndex((endMin) => endMin <= ev.startMin)
      if (laneIdx === -1) {
        laneIdx = lanes.length
        lanes.push(ev.endMin)
      } else {
        lanes[laneIdx] = ev.endMin
      }
      ev.lane = laneIdx
    }
    cluster.forEach((ev) => (ev.totalLanes = lanes.length))
    result.push(...cluster)
    cluster = []
    clusterEnd = -1
  }

  for (const ev of sorted) {
    const laneEv: LaidOutItem = { ...ev, lane: 0, totalLanes: 1 }
    if (cluster.length === 0 || laneEv.startMin < clusterEnd) {
      cluster.push(laneEv)
      clusterEnd = Math.max(clusterEnd, laneEv.endMin)
    } else {
      flush()
      cluster.push(laneEv)
      clusterEnd = laneEv.endMin
    }
  }
  flush()
  return result
}
