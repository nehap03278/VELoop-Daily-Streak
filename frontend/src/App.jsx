import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './pages/Login/LoginPage';
import HomePage from './pages/Home/HomePage';
import DailyStreakPage from './pages/DailyStreak/DailyStreakPage';
import ProfilePage from './pages/Profile/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/daily-streak"
        element={
          <ProtectedRoute>
            <DailyStreakPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/daily-streak" replace />} />
    </Routes>
  );
}
