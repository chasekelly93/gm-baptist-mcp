import { Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";

export function NavBar() {
  const { user } = useAuth();

  return (
    <nav className="p-4 border-b flex gap-4 items-center bg-background sticky top-0 z-10">
      <Link to="/" className="font-bold text-lg">
        Video Archive
      </Link>
      <div className="flex gap-4 ml-auto items-center">
        <Link to="/add" className="text-sm font-medium hover:underline">
          Add Video
        </Link>
        <Link to="/dashboard" className="text-sm font-medium hover:underline">
          Dashboard
        </Link>
        {user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </Button>
        ) : (
          <Link to="/staff-login" className="text-sm text-muted-foreground hover:underline">
            Staff Login
          </Link>
        )}
      </div>
    </nav>
  );
}
