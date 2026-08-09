import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";

const NAV = [
  { to: "/", end: true, icon: "🌸", label: "Start" },
  { to: "/kalendarz", icon: "📅", label: "Kalendarz" },
  { to: "/dziennik", icon: "📝", label: "Dziennik" },
  { to: "/czat", icon: "💬", label: "Asystent" },
  { to: "/profil", icon: "👤", label: "Profil" },
];

export default function Layout() {
  const { user } = useAuth();
  return (
    <>
      <div className="top-bar">
        <Link to="/" className="logo">
          🌸 Cyklia
        </Link>
        <NavLink to="/profil" className="tag" style={{ textDecoration: "none" }}>
          {(user?.display_name || user?.email || "").split("@")[0]}
        </NavLink>
      </div>
      <main className="page">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="nav-ico">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
