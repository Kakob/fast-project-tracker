// Type definitions for Project Tracker

export type ItemStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type ItemPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type ViewType = 'board' | 'list' | 'calendar'

export interface Item {
  id: string
  user_id: string
  parent_id: string | null
  title: string
  description: string | null
  status: ItemStatus
  priority: ItemPriority
  due_date: string | null // ISO date string (YYYY-MM-DD)
  start_date: string | null
  completed_at: string | null
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
  created_at: string
  updated_at: string
}

// For creating new items
export interface CreateItemInput {
  title: string
  description?: string | null
  parent_id?: string | null
  status?: ItemStatus
  priority?: ItemPriority
  due_date?: string | null
  start_date?: string | null
}

// For updating items
export interface UpdateItemInput {
  title?: string
  description?: string | null
  parent_id?: string | null
  status?: ItemStatus
  priority?: ItemPriority
  due_date?: string | null
  start_date?: string | null
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

// Kanban column order
export const STATUS_ORDER: ItemStatus[] = ['todo', 'in_progress', 'done', 'archived']
