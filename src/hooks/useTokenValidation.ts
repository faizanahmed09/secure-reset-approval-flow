import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { tokenInterceptor } from '@/utils/tokenInterceptor';
import { useAuth } from '@/contexts/AuthContext';

interface UseTokenValidationResult {
  isValidating: boolean;
  isTokenValid: boolean;
  validateTokens: () => Promise<boolean>;
  error: string | null;
}

/**
 * Custom hook for token validation
 * Automatically validates tokens and provides utilities for components
 */
export const useTokenValidation = (): UseTokenValidationResult => {
  const { instance, accounts } = useMsal();
  const { isAuthenticated, user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to manually validate tokens
  const validateTokens = async (): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      setIsTokenValid(false);
      return false;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Initialize token interceptor with current MSAL instance and accounts
      tokenInterceptor.initialize(instance, accounts);
      
      // Validate authentication state
      const isValid = await tokenInterceptor.validateAuthenticationState();
      
      setIsTokenValid(isValid);
      return isValid;
    } catch (err: any) {
      console.error('Token validation failed:', err);
      setError(err.message || 'Token validation failed');
      setIsTokenValid(false);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Validate tokens when authentication state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      validateTokens();
    } else {
      setIsTokenValid(false);
    }
  }, [isAuthenticated, user]);

  return {
    isValidating,
    isTokenValid,
    validateTokens,
    error,
  };
}; 