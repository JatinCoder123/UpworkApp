import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Activity from './pages/Activity'
import Profile from './pages/Profile'
import Preferences from './pages/Preferences'
import { getSessionUser } from './lib/auth'

function ProtectedRoute({ children }) {
  return getSessionUser() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<Login />} />
    <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
    <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
    <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
}
