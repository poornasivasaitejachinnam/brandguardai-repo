import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Lightfall from './components/Lightfall';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BrandsPage from './pages/BrandsPage';
import ContentPage from './pages/ContentPage';
import ReviewsPage from './pages/ReviewsPage';
import UsersPage from './pages/UsersPage';
import AlertsPage from './pages/AlertsPage';
import OrganizationsPage from './pages/OrganizationsPage';
import GuidelinesPage from './pages/GuidelinesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="app-shell"><div className="auth-panel">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app-root">
      <div className="app-lightfall" aria-hidden="true">
        <Lightfall
          colors={["#ffffff"]}
          backgroundColor="#000000"
          speed={0.3}
          streakCount={2}
          streakWidth={0.8}
          twinkle={0.3}
          backgroundGlow={0.1}
          headGlow={0.6}
          bloom={0.35}
          mouseInteraction
          holdToWarp
          intro
          streakLength={1}
          density={0.6}
          glow={1}
          depth={0.5}
          zoom={3}
          mouseStrength={0.4}
          mouseRadius={0.45}
          lens={0.5}
          fade={0}
          lightMode={false}
        />
      </div>
      <div className="app-content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><Layout user={user} onLogout={logout}><DashboardPage /></Layout></ProtectedRoute>} />
          <Route path="/brands" element={<ProtectedRoute><Layout user={user} onLogout={logout}><BrandsPage /></Layout></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><Layout user={user} onLogout={logout}><OrganizationsPage /></Layout></ProtectedRoute>} />
          <Route path="/guidelines" element={<ProtectedRoute><Layout user={user} onLogout={logout}><GuidelinesPage /></Layout></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><Layout user={user} onLogout={logout}><ContentPage /></Layout></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><Layout user={user} onLogout={logout}><ReviewsPage /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Layout user={user} onLogout={logout}><UsersPage /></Layout></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Layout user={user} onLogout={logout}><AlertsPage /></Layout></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Layout user={user} onLogout={logout}><AnalyticsPage /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout user={user} onLogout={logout}><SettingsPage /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
