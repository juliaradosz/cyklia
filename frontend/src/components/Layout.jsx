import { NavLink, Outlet } from "react-router-dom";
import Icon from "./Icon.jsx";

const NAV = [
  { to: "/", end: true, icon: "home", label: "Start" },
  { to: "/dziennik", icon: "journal", label: "Dziennik" },
  { to: "/statystyki", icon: "chart", label: "Statystyki" },
  { to: "/inspiracje", icon: "book", label: "Inspiracje" },
  { to: "/czat", icon: "sparkles", label: "Asystent" },
  { to: "/profil", icon: "user", label: "Profil" },
];

export default function Layout() {
  return (
    <>
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
