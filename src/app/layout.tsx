
import { Inter } from 'next/font/google';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '@/authConfig';

const inter = Inter({ subsets: ['latin'] });

// Initialize MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

export const metadata = {
  title: 'Azure Authentication and Password Reset Approval',
  description: 'Secure multi-factor password reset approval system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MsalProvider instance={msalInstance}>
          <div className="flex flex-col min-h-screen">
            {children}
          </div>
        </MsalProvider>
      </body>
    </html>
  );
}
