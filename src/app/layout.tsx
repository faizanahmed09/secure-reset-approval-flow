import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import { Providers } from '../providers/user-providers'
import BProgressProvider from './n-progress-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AuthenPush',
  description: 'User verificatrion system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <BProgressProvider>
        <Providers>
          {children}
        </Providers>
        </BProgressProvider>
      </body>
    </html>
  )
} 