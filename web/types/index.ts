// Type definitions for Project Tracker

export type ItemStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type ItemPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type ProjectColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray'
export type ViewType = 'board' | 'list' | 'calendar' | 'projects' | 'archive' | 'focus'

export interface Item {
  id: string
  user_id: string
  parent_id: string | null
  project_id: string | null
  title: string
  description: string | null
  status: ItemStatus
  priority: ItemPriority
  due_date: string | null // ISO date string (YYYY-MM-DD)
  start_date: string | null
  completed_at: string | null
  scheduled_start: string | null // ISO datetime (timestamptz)
  duration_minutes: number
  intention: string | null
  cumulative_time_ms: number
  session_count: number
  position: number
  created_at: string
  updated_at: string
}

// Item with nested children (computed client-side)
export interface ItemWithChildren extends Item {
  children: ItemWithChildren[]
  depth: number
}

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  photo_url: string | null
  default_warning_buffer_sec: number
  default_break_duration_sec: number
  preferred_time_increments: number[]
  tier: UserTier
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  color: ProjectColor
  icon: string | null
  position: number
  created_at: string
  updated_at: string
}

// Time tracking
export interface TimeEntry {
  id: string
  user_id: string
  item_id: string
  started_at: string   // ISO datetime
  ended_at: string | null
  duration_seconds: number | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface CreateTimeEntryInput {
  item_id: string
  started_at?: string
  note?: string | null
}

export interface UpdateTimeEntryInput {
  ended_at?: string | null
  duration_seconds?: number | null
  note?: string | null
}

// For creating new projects
export interface CreateProjectInput {
  title: string
  description?: string | null
  color?: ProjectColor
  icon?: string | null
}

// For updating projects
export interface UpdateProjectInput {
  title?: string
  description?: string | null
  color?: ProjectColor
  icon?: string | null
  position?: number
}

// For creating new items
export interface CreateItemInput {
  title: string
  description?: string | null
  parent_id?: string | null
  project_id?: string | null
  status?: ItemStatus
  priority?: ItemPriority
  due_date?: string | null
  start_date?: string | null
  scheduled_start?: string | null
  duration_minutes?: number
}

// For updating items
export interface UpdateItemInput {
  title?: string
  description?: string | null
  parent_id?: string | null
  project_id?: string | null
  status?: ItemStatus
  priority?: ItemPriority
  due_date?: string | null
  start_date?: string | null
  scheduled_start?: string | null
  duration_minutes?: number
  position?: number
}

// Status display config
export const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  done: { label: 'Done', color: 'text-green-600', bgColor: 'bg-green-100' },
  archived: { label: 'Archived', color: 'text-gray-400', bgColor: 'bg-gray-50' },
}

// Priority display config
export const PRIORITY_CONFIG: Record<ItemPriority, { label: string; color: string; bgColor: string }> = {
  none: { label: 'None', color: 'text-gray-400', bgColor: 'bg-transparent' },
  low: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  medium: { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
}

// Project color config
export const PROJECT_COLORS: Record<ProjectColor, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  red: { label: 'Red', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-300' },
  orange: { label: 'Orange', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-300' },
  yellow: { label: 'Yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700', borderColor: 'border-yellow-300' },
  green: { label: 'Green', bgColor: 'bg-green-100', textColor: 'text-green-700', borderColor: 'border-green-300' },
  blue: { label: 'Blue', bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-300' },
  indigo: { label: 'Indigo', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', borderColor: 'border-indigo-300' },
  purple: { label: 'Purple', bgColor: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-300' },
  pink: { label: 'Pink', bgColor: 'bg-pink-100', textColor: 'text-pink-700', borderColor: 'border-pink-300' },
  gray: { label: 'Gray', bgColor: 'bg-gray-100', textColor: 'text-gray-600', borderColor: 'border-gray-300' },
}

// Kanban column order
export const STATUS_ORDER: ItemStatus[] = ['todo', 'in_progress', 'done', 'archived']

// =============================================================================
// Focus Session Types
// =============================================================================

export type FocusSessionStatus = 'setup' | 'active' | 'paused' | 'completed' | 'abandoned'
export type SessionEndReason = 'completed' | 'abandoned' | 'free_tier_cap'
export type SessionTaskStatus = 'pending' | 'active' | 'completed' | 'paused_incomplete' | 'skipped'
export type ReminderSourceType = 'global' | 'task' | 'session'
export type ReminderTriggerType = 'interval' | 'moment' | 'manual'
export type ReminderDelivery = 'visual' | 'audio' | 'both'
export type LogInputType = 'numeric_scale' | 'text' | 'multiple_choice'
export type LogEntrySource = 'manual' | 'reminder_prompt' | 'session_end'
export type BreakType = 'between_tasks' | 'manual'
export type UserTier = 'free' | 'premium'

export interface FocusSession {
  id: string
  user_id: string
  status: FocusSessionStatus
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  total_pause_ms: number
  total_break_ms: number
  total_active_ms: number
  template_id: string | null
  ended_by: SessionEndReason | null
  created_at: string
  updated_at: string
}

export interface SessionTask {
  id: string
  session_id: string
  task_id: string
  position: number
  allocated_time_ms: number
  actual_time_ms: number
  warning_buffer_sec: number
  status: SessionTaskStatus
  started_at: string | null
  completed_at: string | null
  extensions_ms: number
  extension_count: number
}

export interface SessionTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  template_data: {
    slots: Array<{
      task_id: string | null
      allocated_time_ms: number
      warning_buffer_sec: number
      position: number
    }>
  }
  created_at: string
  updated_at: string
}

export interface Reminder {
  id: string
  user_id: string
  content: string
  source_type: ReminderSourceType
  source_id: string | null
  delivery: ReminderDelivery
  audio_url: string | null
  trigger_type: ReminderTriggerType
  trigger_interval_ms: number | null
  trigger_moment: string | null
  trigger_timestamp_ms: number | null
  triggers_log_type_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LogType {
  id: string
  user_id: string
  name: string
  input_type: LogInputType
  config: Record<string, unknown>
  is_default: boolean
  is_custom: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface LogEntry {
  id: string
  user_id: string
  session_id: string
  session_task_id: string | null
  log_type_id: string
  value_numeric: number | null
  value_text: string | null
  value_choice: string | null
  source: LogEntrySource
  created_at: string
}

export interface SessionReflection {
  id: string
  session_id: string
  user_id: string
  how_it_went: number | null
  wins: string | null
  friction: string | null
  notes: string | null
  created_at: string
}

export interface Break {
  id: string
  session_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  planned_duration_sec: number | null
  break_type: BreakType
  created_at: string
}

// Focus session mutation inputs
export interface CreateFocusSessionInput {
  template_id?: string | null
}

export interface CreateSessionTaskInput {
  session_id: string
  task_id: string
  position: number
  allocated_time_ms: number
  warning_buffer_sec?: number
}

export interface UpdateSessionTaskInput {
  position?: number
  allocated_time_ms?: number
  actual_time_ms?: number
  warning_buffer_sec?: number
  status?: SessionTaskStatus
  started_at?: string | null
  completed_at?: string | null
  extensions_ms?: number
  extension_count?: number
}

export interface CreateReminderInput {
  content: string
  source_type: ReminderSourceType
  source_id?: string | null
  delivery?: ReminderDelivery
  trigger_type: ReminderTriggerType
  trigger_interval_ms?: number | null
  trigger_moment?: string | null
  trigger_timestamp_ms?: number | null
  triggers_log_type_id?: string | null
}

export interface UpdateReminderInput {
  content?: string
  delivery?: ReminderDelivery
  trigger_type?: ReminderTriggerType
  trigger_interval_ms?: number | null
  trigger_moment?: string | null
  trigger_timestamp_ms?: number | null
  triggers_log_type_id?: string | null
  is_active?: boolean
}

export interface CreateLogEntryInput {
  session_id: string
  session_task_id?: string | null
  log_type_id: string
  value_numeric?: number | null
  value_text?: string | null
  value_choice?: string | null
  source: LogEntrySource
}

export interface CreateSessionReflectionInput {
  session_id: string
  how_it_went?: number | null
  wins?: string | null
  friction?: string | null
  notes?: string | null
}

export interface CreateBreakInput {
  session_id: string
  planned_duration_sec?: number | null
  break_type: BreakType
}

export interface CreateSessionTemplateInput {
  name: string
  description?: string | null
  template_data: SessionTemplate['template_data']
}
