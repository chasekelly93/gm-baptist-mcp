import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

/** Staff auth state — gates the Add/Edit Video, Categories, and Dashboard pages. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return {
    session,
    isStaff: !!session,
    loading,
    signInWithMagicLink: (email: string) =>
      supabase.auth.signInWithOtp({ email }),
    signOut: () => supabase.auth.signOut(),
  };
}
