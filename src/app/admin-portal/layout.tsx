import type { Metadata } from 'next'
import { Providers } from '../../providers/admin-providers'

export const metadata: Metadata = {
  title: 'AuthenPush',
  description: 'User verificatrion system',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
        <Providers>
          {children}
        </Providers>
  )
} 