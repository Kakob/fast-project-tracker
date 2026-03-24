'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const router = useRouter()
  const { session, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      router.push(session ? '/board' : '/sign-in')
    }
  }, [session, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  )
}
