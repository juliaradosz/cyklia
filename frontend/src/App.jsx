import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./api/auth.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import JournalPage from "./pages/JournalPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ArticlesPage from "./pages/ArticlesPage.jsx";
import ArticlePage from "./pages/ArticlePage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Ładowanie…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="kalendarz" element={<CalendarPage />} />
        <Route path="dziennik" element={<JournalPage />} />
        <Route path="statystyki" element={<StatsPage />} />
        <Route path="czat" element={<ChatPage />} />
        <Route path="artykuly" element={<ArticlesPage />} />
        <Route path="artykuly/:id" element={<ArticlePage />} />
        <Route path="profil" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
