import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { Item, CreateItemInput, UpdateItemInput, ItemWithChildren } from '@/types'

// Query key factory
export const itemKeys = {
  all: ['items'] as const,
  byId: (id: string) => ['items', id] as const,
}

// Fetch all items for the current user
export function useItems() {
  return useQuery({
    queryKey: itemKeys.all,
    queryFn: async (): Promise<Item[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    },
  })
}

// Fetch a single item
export function useItem(id: string | null) {
  return useQuery({
    queryKey: itemKeys.byId(id || ''),
    queryFn: async (): Promise<Item | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// Create item mutation
export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateItemInput): Promise<Item> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('items')
        .insert({
          user_id: user.id,
          title: input.title,
          description: input.description || null,
          parent_id: input.parent_id || null,
          status: input.status || 'todo',
          priority: input.priority || 'none',
          due_date: input.due_date || null,
          start_date: input.start_date || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    // Optimistic update
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all })
      const previousItems = queryClient.getQueryData<Item[]>(itemKeys.all)

      // Create optimistic item
      const optimisticItem: Item = {
        id: `temp-${Date.now()}`,
        user_id: '',
        parent_id: newItem.parent_id || null,
        title: newItem.title,
        description: newItem.description || null,
        status: newItem.status || 'todo',
        priority: newItem.priority || 'none',
        due_date: newItem.due_date || null,
        start_date: newItem.start_date || null,
        completed_at: null,
        position: (previousItems?.length || 0) + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData<Item[]>(itemKeys.all, (old) => [
        ...(old || []),
        optimisticItem,
      ])

      return { previousItems }
    },
    onError: (err, newItem, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(itemKeys.all, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

// Update item mutation
export function useUpdateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateItemInput & { id: string }): Promise<Item> => {
      const updateData: Record<string, unknown> = { ...updates }

      // If status is changing to 'done', set completed_at
      if (updates.status === 'done') {
        updateData.completed_at = new Date().toISOString()
      } else if (updates.status) {
        // Status is changing to something other than 'done', clear completed_at
        updateData.completed_at = null
      }

      const { data, error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    // Optimistic update
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all })
      const previousItems = queryClient.getQueryData<Item[]>(itemKeys.all)

      queryClient.setQueryData<Item[]>(itemKeys.all, (old) =>
        old?.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                completed_at: updates.status === 'done' ? new Date().toISOString() :
                              updates.status ? null : item.completed_at,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      )

      return { previousItems }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(itemKeys.all, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

// Delete item mutation
export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all })
      const previousItems = queryClient.getQueryData<Item[]>(itemKeys.all)

      queryClient.setQueryData<Item[]>(itemKeys.all, (old) =>
        old?.filter((item) => item.id !== id)
      )

      return { previousItems }
    },
    onError: (err, id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(itemKeys.all, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

// Helper: Build tree structure from flat items
export function buildItemTree(items: Item[]): ItemWithChildren[] {
  const itemMap = new Map<string, ItemWithChildren>()
  const roots: ItemWithChildren[] = []

  // First pass: create all nodes
  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [], depth: 0 })
  })

  // Second pass: build tree
  items.forEach((item) => {
    const node = itemMap.get(item.id)!
    if (item.parent_id && itemMap.has(item.parent_id)) {
      const parent = itemMap.get(item.parent_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Sort children by position
  const sortChildren = (nodes: ItemWithChildren[]) => {
    nodes.sort((a, b) => a.position - b.position)
    nodes.forEach((node) => sortChildren(node.children))
  }
  sortChildren(roots)

  return roots
}

// Helper: Flatten tree back to list (for list view)
export function flattenItemTree(roots: ItemWithChildren[]): ItemWithChildren[] {
  const result: ItemWithChildren[] = []

  const flatten = (nodes: ItemWithChildren[]) => {
    nodes.forEach((node) => {
      result.push(node)
      flatten(node.children)
    })
  }

  flatten(roots)
  return result
}
