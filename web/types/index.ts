// Type definitions for Project Tracker

export type ItemStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type ItemPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type ProjectColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray'
export type ViewType = 'board' | 'list' | 'calendar' | 'projects'

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
