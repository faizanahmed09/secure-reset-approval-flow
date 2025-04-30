
import { Shield } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full py-6 border-t mt-auto">
      <div className="container flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-azure" />
          <span className="text-sm font-medium">Secure Reset Approval Flow</span>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Your Organization. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
