
import { Shield } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();
  
  // Determine page title based on route
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/':
        return 'Azure AD Authentication';
      case '/reset-approval':
        return 'Change Request Approval';
      default:
        return 'Change Request Approval Flow';
    }
  };

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-azure" />
          <span className="font-medium text-lg">Secure Reset</span>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">Admin Portal</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
