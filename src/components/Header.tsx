"use client";

import { usePathname } from "next/navigation";
import Link from 'next/link'
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "./ui/badge";

// Helper function to display role text
const getRoleDisplay = (role: string) => {
  if (role === 'basic') {
    return 'View Only';
  }
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

const Header = () => {
  const { user } = useAuth();
  const pathname = usePathname();

  // Determine page title based on route
  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return "";
      case "/admin-portal/reset-approval":
        return "Verify User Request";
      default:
        return "Verify User Request";
    }
  };

  return (
    <header className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/admin-portal" className="flex items-center space-x-2">
            <img src="/logo.png" alt="Authenpush Logo" className="h-6 w-6"/>
            <span className="font-semibold text-lg">AuthenPush</span>
          </Link>
        </div>
        
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">{user.display_name || user.name}</span>
            <Badge variant="outline">{getRoleDisplay(user.role || '')}</Badge>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
