import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const staffLinks = [
  { to: "/add", label: "Add Video" },
  { to: "/categories", label: "Categories" },
  { to: "/dashboard", label: "Dashboard" },
];

export function NavBar() {
  const { isStaff, signOut } = useAuth();
  const location = useLocation();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700">
      <Link to="/" className="font-semibold">
        Video Archive
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {isStaff &&
          staffLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                location.pathname === link.to
                  ? "font-medium text-indigo-600"
                  : "text-gray-600 dark:text-gray-300"
              }
            >
              {link.label}
            </Link>
          ))}
        {isStaff ? (
          <button type="button" onClick={() => signOut()} className="text-gray-500">
            Sign out
          </button>
        ) : (
          <Link to="/staff-login" className="text-gray-500">
            Staff sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
