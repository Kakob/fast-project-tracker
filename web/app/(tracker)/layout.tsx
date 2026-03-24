'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { TrackerLayout } from '@/components/tracker-layout'

export default function TrackerRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { session, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/sign-in')
    }
  }, [session, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return <TrackerLayout>{children}</TrackerLayout>
}
