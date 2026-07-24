import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="text-brand underline">
        Back to search
      </Link>
    </div>
  );
}
