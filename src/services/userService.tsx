import { jwtDecode } from "jwt-decode";
import { IPublicClientApplication, AuthenticationResult } from "@azure/msal-browser";

const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co";


export function getCurrentUser() {
  if (typeof window !== 'undefined') {
    const userStr = window.sessionStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
}

export function isUserProcessed() {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('userProcessed') === 'true';
  }
  return false;
}

export function clearUserSession() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('currentUser');
    window.sessionStorage.removeItem('userProcessed');
    window.sessionStorage.removeItem('mfaSecretChecked');
    // Reset the processing flag when clearing session
  }
}