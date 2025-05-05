
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AzureAuthClient from '@/components/AzureAuthClient';

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Password Reset Flow</h2>
              <p className="text-muted-foreground">
                Secure multi-factor password reset approval system
              </p>
            </div>
            
            <AzureAuthClient />
            
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">About this system:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Authenticate using Azure AD credentials</li>
                <li>• View users in your Azure Active Directory</li>
                <li>• Initiate secure password reset requests</li>
                <li>• Requires user approval via push notification</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
