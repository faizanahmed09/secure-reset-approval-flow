
import { Shield } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full py-6 border-t mt-auto">
      <div className="container flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Authenpush Logo" className="h-7 w-7" />
          <span className="text-sm font-medium">AuthenPush</span>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Your Organization. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
