import { formatDistanceToNow } from 'date-fns'

export function formatTimeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true })
}

export function getCategoryEmoji(category: string): string {
  switch (category.toLowerCase()) {
    case 'build':
      return '🔨'
    case 'learn':
      return '📚'
    case 'move':
      return '🏃'
    case 'create':
      return '🎨'
    case 'care':
      return '💚'
    default:
      return '⭐'
  }
}

export function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'build':
      return 'bg-blue-100 text-blue-700'
    case 'learn':
      return 'bg-green-100 text-green-700'
    case 'move':
      return 'bg-orange-100 text-orange-700'
    case 'create':
      return 'bg-purple-100 text-purple-700'
    case 'care':
      return 'bg-pink-100 text-pink-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function xpToNextLevel(totalXp: number): number {
  const level = Math.floor(totalXp / 250) + 1
  const xpInCurrentLevel = totalXp % 250
  return 250 - xpInCurrentLevel
}

export function getLevel(totalXp: number): number {
  return Math.floor(totalXp / 250) + 1
}

