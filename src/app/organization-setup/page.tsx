"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/services/organizationService";

export default function OrganizationSetup() {
  const { user, isLoading, markOrganizationSetupCompleted, updateUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [organizationName, setOrganizationName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading) {
      // Check if user is authenticated and is admin
      if (!user) {
        router.push("/");
        return;
      }

      if (user.role !== "admin") {
        router.push("/admin-portal");
        return;
      }

      // Set initial organization name from user data
      if (user.organizations?.display_name) {
        setOrganizationName(user.organizations.display_name);
      } else if (user.organizations?.name) {
        setOrganizationName(user.organizations.name);
      }
    }
  }, [user, isLoading, router]);

  const handleSave = async () => {
    if (!organizationName.trim()) {
      setError("Organization name is required");
      return;
    }

    if (!user?.organizations?.id || !user?.email) {
      setError("Missing organization or user information");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const result = await organizationService.updateOrganization({
        organizationId: user.organizations.id,
        organizationName: organizationName.trim(),
        userEmail: user.email,
      });

      if (result.success && result.organization) {
        toast({
          title: "Success",
          description: "Organization updated successfully",
        });
        
        // Mark organization setup as completed
        markOrganizationSetupCompleted();
        
        // Update user data with new organization information
        const updatedUser = {
          ...user,
          organizations: result.organization
        };
        updateUser(updatedUser);
        
        // Also update session storage
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
        
        // Redirect to admin portal after successful update
        router.push("/admin-portal");
      } else {
        setError(result.message || "Failed to update organization");
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      setError("An error occurred while updating organization");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    // Mark organization setup as completed (even if skipped)
    markOrganizationSetupCompleted();
    router.push("/admin-portal");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-blue-100 rounded-full p-3 w-16 h-16 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-2xl">Welcome to Your Admin Portal</CardTitle>
            <CardDescription className="mt-2">
              Let's set up your organization details. You can customize the organization name or keep the default.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Enter organization name"
              disabled={isSaving}
            />
            <p className="text-sm text-gray-500">
              This name will be displayed across the application
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving || !organizationName.trim()}
              className="flex-1"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSaving}
            >
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 