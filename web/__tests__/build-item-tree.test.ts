import { describe, it, expect, vi } from 'vitest'
import type { Item } from '@/types'

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { buildItemTree, flattenItemTree } from '@/lib/hooks/use-items'

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    id: overrides.id,
    user_id: 'user-1',
    parent_id: null,
    project_id: null,
    title: overrides.id,
    description: null,
    status: 'todo',
    priority: 'none',
    due_date: null,
    start_date: null,
    completed_at: null,
    scheduled_start: null,
    duration_minutes: 30,
    intention: null,
    cumulative_time_ms: 0,
    session_count: 0,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildItemTree', () => {
  it('returns an empty array for empty input', () => {
    expect(buildItemTree([])).toEqual([])
  })

  it('returns a single root with no children', () => {
    const items = [makeItem({ id: 'a' })]
    const tree = buildItemTree(items)

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('a')
    expect(tree[0].children).toEqual([])
    expect(tree[0].depth).toBe(0)
  })

  it('nests a single child under its parent and sets depth', () => {
    const items = [
      makeItem({ id: 'parent' }),
      makeItem({ id: 'child', parent_id: 'parent' }),
    ]
    const tree = buildItemTree(items)

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('parent')
    expect(tree[0].depth).toBe(0)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe('child')
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('computes depth across multiple levels', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b', parent_id: 'a' }),
      makeItem({ id: 'c', parent_id: 'b' }),
      makeItem({ id: 'd', parent_id: 'c' }),
    ]
    const tree = buildItemTree(items)

    expect(tree[0].depth).toBe(0)
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[0].children[0].children[0].depth).toBe(2)
    expect(tree[0].children[0].children[0].children[0].depth).toBe(3)
  })

  it('promotes orphaned children (parent_id refers to non-existent item) to roots', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'orphan', parent_id: 'missing-parent' }),
    ]
    const tree = buildItemTree(items)

    expect(tree).toHaveLength(2)
    const ids = tree.map((n) => n.id).sort()
    expect(ids).toEqual(['a', 'orphan'])
    const orphan = tree.find((n) => n.id === 'orphan')!
    expect(orphan.depth).toBe(0)
  })

  it('sorts roots by position', () => {
    const items = [
      makeItem({ id: 'second', position: 2 }),
      makeItem({ id: 'first', position: 1 }),
      makeItem({ id: 'third', position: 3 }),
    ]
    const tree = buildItemTree(items)

    expect(tree.map((n) => n.id)).toEqual(['first', 'second', 'third'])
  })

  it('sorts children by position within each parent', () => {
    const items = [
      makeItem({ id: 'parent', position: 1 }),
      makeItem({ id: 'c-third', parent_id: 'parent', position: 3 }),
      makeItem({ id: 'c-first', parent_id: 'parent', position: 1 }),
      makeItem({ id: 'c-second', parent_id: 'parent', position: 2 }),
    ]
    const tree = buildItemTree(items)

    expect(tree[0].children.map((n) => n.id)).toEqual([
      'c-first',
      'c-second',
      'c-third',
    ])
  })

  it('handles multiple sibling roots with their own subtrees', () => {
    const items = [
      makeItem({ id: 'root1', position: 1 }),
      makeItem({ id: 'root2', position: 2 }),
      makeItem({ id: 'r1-child', parent_id: 'root1', position: 1 }),
      makeItem({ id: 'r2-child', parent_id: 'root2', position: 1 }),
    ]
    const tree = buildItemTree(items)

    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe('root1')
    expect(tree[0].children[0].id).toBe('r1-child')
    expect(tree[1].id).toBe('root2')
    expect(tree[1].children[0].id).toBe('r2-child')
  })

  it('does not mutate the input items', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b', parent_id: 'a' }),
    ]
    const snapshot = JSON.parse(JSON.stringify(items))

    buildItemTree(items)

    expect(items).toEqual(snapshot)
  })
})

describe('flattenItemTree', () => {
  it('returns an empty array for empty roots', () => {
    expect(flattenItemTree([])).toEqual([])
  })

  it('flattens a tree in depth-first pre-order', () => {
    const items = [
      makeItem({ id: 'a', position: 1 }),
      makeItem({ id: 'a1', parent_id: 'a', position: 1 }),
      makeItem({ id: 'a2', parent_id: 'a', position: 2 }),
      makeItem({ id: 'a1a', parent_id: 'a1', position: 1 }),
      makeItem({ id: 'b', position: 2 }),
    ]
    const tree = buildItemTree(items)
    const flat = flattenItemTree(tree)

    expect(flat.map((n) => n.id)).toEqual(['a', 'a1', 'a1a', 'a2', 'b'])
  })

  it('preserves the depth assigned by buildItemTree', () => {
    const items = [
      makeItem({ id: 'root' }),
      makeItem({ id: 'mid', parent_id: 'root' }),
      makeItem({ id: 'leaf', parent_id: 'mid' }),
    ]
    const flat = flattenItemTree(buildItemTree(items))

    expect(flat.map((n) => [n.id, n.depth])).toEqual([
      ['root', 0],
      ['mid', 1],
      ['leaf', 2],
    ])
  })
})
