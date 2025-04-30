
export interface AzureADCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  error?: string;
}

export interface ResetRequestState {
  email: string;
  status: 'idle' | 'loading' | 'approved' | 'rejected' | 'completed' | 'error';
  message?: string;
}
