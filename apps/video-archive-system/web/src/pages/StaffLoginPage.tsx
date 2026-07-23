import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export function StaffLoginPage() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: signInError } = await signInWithMagicLink(email);
    if (signInError) setError(signInError.message);
    else setSent(true);
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-16">
      <h1 className="text-xl font-bold">Staff sign in</h1>
      {sent ? (
        <p className="text-sm text-gray-500">
          Check {email} for a magic link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-sm text-white"
          >
            Send magic link
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}
    </div>
  );
}
