
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetApprovalClient from '@/components/ResetApprovalClient';

export default function ResetApproval() {
  return (
    <>
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Reset Approvals</h2>
              <p className="text-muted-foreground">
                Request and monitor reset approvals
              </p>
            </div>
            
            <ResetApprovalClient />
            
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">Process Information:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enter the user's email address</li>
                <li>• System sends a secure push notification to the user</li>
                <li>• User approves or rejects the request</li>
                <li>• On approval, the password is reset automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
