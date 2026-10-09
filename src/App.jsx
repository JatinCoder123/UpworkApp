import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Activity from './pages/Activity'
import TechNews from './pages/TechNews'
import TechNewsDetail from './pages/TechNewsDetail'
import Profile from './pages/Profile'
import Preferences from './pages/Preferences'
import NotFound from './pages/NotFound'
import SessionLoader from './components/SessionLoader'
import LoginIntro from './components/LoginIntro'
import ScrollToTop from './components/ScrollToTop'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }) {
  const { status } = useAuth()
  if (status === 'loading') return <SessionLoader />
  return status === 'authenticated' ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { status, showLoginIntro, completeLoginIntro } = useAuth()
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(() => sessionStorage.getItem('upworkapp-welcome-intro') !== 'seen')

  const completeWelcomeIntro = () => {
    sessionStorage.setItem('upworkapp-welcome-intro', 'seen')
    setShowWelcomeIntro(false)
  }

  if (showWelcomeIntro) return <LoginIntro onComplete={completeWelcomeIntro} />
  if (status === 'authenticated' && showLoginIntro) return <LoginIntro onComplete={completeLoginIntro} />

  return <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
      <Route path="/tech-news" element={<ProtectedRoute><TechNews /></ProtectedRoute>} />
      <Route path="/tech-news/:id" element={<ProtectedRoute><TechNewsDetail /></ProtectedRoute>} />
      <Route path="/technews" element={<Navigate to="/tech-news" replace />} />
      <Route path="/news" element={<Navigate to="/tech-news" replace />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
}
