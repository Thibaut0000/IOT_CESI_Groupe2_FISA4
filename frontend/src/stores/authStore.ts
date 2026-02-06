import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "../types";

interface AuthState {
  token: string | null;
  role: Role | null;
  email: string | null;
  login: (token: string, role: Role, email: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: null,
      email: null,
      login: (token, role, email) => set({ token, role, email }),
      logout: () => set({ token: null, role: null, email: null }),
      isAuthenticated: () => get().token !== null,
      isAdmin: () => get().role === "admin"
    }),
    { name: "auth-storage" }
  )
);
