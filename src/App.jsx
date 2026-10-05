import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Activity from './pages/Activity'
import Profile from './pages/Profile'
import Preferences from './pages/Preferences'

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<Login />} />
    <Route path="/jobs" element={<Jobs />} />
    <Route path="/jobs/:id" element={<JobDetail />} />
    <Route path="/activity" element={<Activity />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/preferences" element={<Preferences />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
}
