'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLoginAgain: () => void;
}

export const SessionExpiredModal = ({ isOpen, onLoginAgain }: SessionExpiredModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md"  onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Session Expired
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-600 text-left">
            Your session has expired for security reasons. Please sign in again to continue using the application.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">What happened?</h4>
                <p className="text-sm text-blue-700">
                  For your security, we automatically sign you out after a period of inactivity. 
                  This helps protect your account and sensitive information.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={onLoginAgain}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Sign In Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 