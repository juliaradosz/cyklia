import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import Icon from "./Icon.jsx";

const NAV = [
  { to: "/", end: true, icon: "home", label: "Start" },
  { to: "/kalendarz", icon: "calendar", label: "Kalendarz" },
  { to: "/dziennik", icon: "journal", label: "Dziennik" },
  { to: "/statystyki", icon: "chart", label: "Statystyki" },
  { to: "/inspiracje", icon: "book", label: "Inspiracje" },
  { to: "/czat", icon: "sparkles", label: "Asystent" },
  { to: "/profil", icon: "user", label: "Profil" },
];

export default function Layout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const hideTop = pathname === "/";
  const first = (user?.display_name || user?.email || "?")[0] || "?";

  return (
    <>
      {!hideTop && (
        <div className="top-bar">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Icon name="flower" size={18} strokeWidth={2.2} />
            </span>
            Cyklia
          </Link>
          <div className="top-actions">
            <Link to="/inspiracje" className="icon-btn" aria-label="Inspiracje">
              <Icon name="book" size={20} />
            </Link>
            <NavLink to="/profil" className="avatar" aria-label="Profil">
              {first}
            </NavLink>
          </div>
        </div>
      )}
      <main className="page">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <span className="nav-ico">
              <Icon name={n.icon} size={21} />
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
