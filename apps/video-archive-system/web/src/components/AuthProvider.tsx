import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  anonId: string;
  orgId: string | null;
  orgError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  anonId: "",
  orgId: null,
  orgError: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anonId, setAnonId] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    // Get or create anon ID
    try {
      let storedAnonId = localStorage.getItem("anon_id");
      if (!storedAnonId) {
        storedAnonId = crypto.randomUUID();
        localStorage.setItem("anon_id", storedAnonId);
      }
      setAnonId(storedAnonId);
    } catch (err) {
      console.error("Error setting anon_id:", err);
      setAnonId("fallback-anon-id");
    }

    // Fetch org ID — looked up by slug only. Do not fall back to guessing an
    // org_id from another table: the schema is multi-tenant, and grabbing
    // "any" org_id would silently attach visitors to the wrong org once a
    // second one exists. If this fails, RLS on `organizations` is almost
    // certainly the cause — see apps/video-archive-system/schema.sql for the
    // correct policy (public SELECT only, not DISABLE ROW LEVEL SECURITY).
    const fetchOrgId = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("id, slug")
          .eq("slug", "gm_baptist_outreach")
          .single();

        if (error || !data) {
          console.error("Error fetching org:", error);
          setOrgError(
            error?.message ?? "No organization found for slug 'gm_baptist_outreach'."
          );
          return;
        }

        setOrgId(data.id);
      } catch (err: any) {
        console.error("Fetch org exception:", err);
        setOrgError(err.message || "Unknown error");
      }
    };
    fetchOrgId();

    // Setup auth
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error("Error getting session:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, anonId, orgId, orgError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
