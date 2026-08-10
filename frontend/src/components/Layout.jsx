import { NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";

const NAV = [
  { to: "/", end: true, icon: "home", label: "Start" },
  { to: "/dziennik", icon: "activity", label: "Objawy" },
  { to: "/inspiracje", icon: "book", label: "Inspiracje" },
  { to: "/czat", icon: "sparkles", label: "Asystent" },
  { to: "/profil", icon: "user", label: "Profil" },
];

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <div className="app-bg" />
      <main className={`page${pathname === "/" ? " page--flush" : ""}`}>
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
