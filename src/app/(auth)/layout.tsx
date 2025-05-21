'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useIsAuthenticated } from "@azure/msal-react"
import { redirect } from 'next/navigation'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isAuthenticated = useIsAuthenticated()

  if (!isAuthenticated) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  )
} 