import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {type User } from '../types';

// فانكشن آمنة لفك تشفير الـ JWT عشان متضربش Error
const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

interface AuthStore {
  token: string | null;
  signupToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAuth: (apiUser: any, token: string) => void;
  setSignupToken: (token: string) => void;
  login: (token: string) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  isRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      signupToken: null,
      user: null,
      isAuthenticated: false,

      // حفظ توكن التسجيل المؤقت
      setSignupToken: (signupToken) => set({ signupToken }),

      // الفانكشن اللي بتشتغل بعد اللوجين أو بعد آخر خطوة في التسجيل
      setAuth: (apiUser, token) => {
        const decoded = decodeToken(token);
        if (!decoded) return;

        // استخراج الرول (سواء كان مكتوب role أو بالرابط الطويل بتاع .NET)
        const userRole = decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'Citizen';

        const user: User = {
          id: decoded.sub || decoded.nameidentifier || '',
          displayName: apiUser?.displayName || decoded.given_name || decoded.name || 'User',
          email: apiUser?.email || decoded.email || '',
          role: userRole,
          token: token,
          authorityId: decoded.authorityId
        };

        set({ token, user, isAuthenticated: true, signupToken: null });
      },

      // للتوافق لو حبيت تستخدم login وتبعث التوكن بس
      login: (token: string) => {
        get().setAuth(null, token);
      },

      logout: () => set({ token: null, user: null, isAuthenticated: false, signupToken: null }),

      hasRole: (role: string) => {
        const user = get().user;
        if (!user) return false;
        const userRoles = Array.isArray(user.role) ? user.role : [user.role];
        return userRoles.includes(role);
      },

      isRole: (...roles: string[]) => {
        const user = get().user;
        if (!user) return false;
        const userRoles = Array.isArray(user.role) ? user.role : [user.role];
        return roles.some((r) => userRoles.includes(r));
      },
    }),
    {
      name: 'ain-auth-storage', // الاسم اللي هيتحفظ بيه في الـ Local Storage
    }
  )
);