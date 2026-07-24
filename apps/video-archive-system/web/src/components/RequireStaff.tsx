import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/** Gates staff-only routes (Add/Edit Video, Categories, Dashboard). */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { isStaff, loading } = useAuth();

  if (loading) return null;
  if (!isStaff) return <Navigate to="/staff-login" replace />;
  return <>{children}</>;
}
