import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Loader2 } from "lucide-react";

export function RequireStaff({ children }: { children: ReactNode }) {
  const { user, loading, orgError } = useAuth();

  if (orgError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-destructive">
        <p>Error loading organization: {orgError}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/staff-login" replace />;
  }

  return <>{children}</>;
}
