import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import LiveJobs from './pages/LiveJobs'
import LiveJobDetail from './pages/LiveJobDetail'
import Activity from './pages/Activity'
import TechNews from './pages/TechNews'
import TechNewsDetail from './pages/TechNewsDetail'
import Profile from './pages/Profile'
import Preferences from './pages/Preferences'
import Video from './pages/Video'
import SiteContent from './pages/SiteContent'
import Seo from './pages/Seo'
import Domain from './pages/Domain'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'
import SessionLoader from './components/SessionLoader'
import LoginIntro from './components/LoginIntro'
import ScrollToTop from './components/ScrollToTop'
import DocNotificationToast from './components/DocNotificationToast'
import GlobalErrorToast from './components/GlobalErrorToast'
import ErrorBoundary, { PageError } from './components/ErrorBoundary'
import { useAuth } from './contexts/AuthContext'

const NoFallback = () => null

function ProtectedRoute({ children }) {
  const { status } = useAuth()
  if (status === 'loading') return <SessionLoader />
  return status === 'authenticated' ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { status, showLoginIntro, completeLoginIntro } = useAuth()
  const location = useLocation()
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(() => sessionStorage.getItem('outrightfeedportal-welcome-intro') !== 'seen')

  const completeWelcomeIntro = () => {
    sessionStorage.setItem('outrightfeedportal-welcome-intro', 'seen')
    setShowWelcomeIntro(false)
  }

  if (showWelcomeIntro) return <LoginIntro onComplete={completeWelcomeIntro} />
  if (status === 'authenticated' && showLoginIntro) return <LoginIntro onComplete={completeLoginIntro} />

  return <>
    <ScrollToTop />
    {/* Toasts are extras: if one fails it disappears instead of taking the app down. */}
    <ErrorBoundary name="doc-toast" fallback={NoFallback}><DocNotificationToast /></ErrorBoundary>
    <ErrorBoundary name="error-toast" fallback={NoFallback}><GlobalErrorToast /></ErrorBoundary>
    {/* A page that fails to render shows an error inside the normal header; changing route clears it. */}
    <ErrorBoundary name="page" fallback={PageError} resetKey={location.pathname}>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
      <Route path="/live-jobs" element={<ProtectedRoute><LiveJobs /></ProtectedRoute>} />
      <Route path="/live-jobs/:id" element={<ProtectedRoute><LiveJobDetail /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
      <Route path="/tech-news" element={<ProtectedRoute><TechNews /></ProtectedRoute>} />
      <Route path="/tech-news/:id" element={<ProtectedRoute><TechNewsDetail /></ProtectedRoute>} />
      <Route path="/site-content" element={<ProtectedRoute><SiteContent /></ProtectedRoute>} />
      <Route path="/daily-news" element={<Navigate to="/site-content" replace />} />
      <Route path="/domain" element={<ProtectedRoute><Domain /></ProtectedRoute>} />
      <Route path="/video" element={<ProtectedRoute><Video /></ProtectedRoute>} />
      <Route path="/seo" element={<ProtectedRoute><Seo /></ProtectedRoute>} />
      <Route path="/appscript" element={<ProtectedRoute><ComingSoon title="AppScript" subtitle="automation incoming." description="The AppScript workspace is being prepared for automation workflows and integrations." type="appscript" /></ProtectedRoute>} />
      <Route path="/llm" element={<ProtectedRoute><ComingSoon title="LLM" subtitle="intelligence incoming." description="The LLM workspace is being prepared for model tools, prompts, and experiments." type="llm" /></ProtectedRoute>} />
      <Route path="/wordpress" element={<ProtectedRoute><ComingSoon title="Wordpress" subtitle="publishing incoming." description="The Wordpress workspace is being prepared for publishing and site management workflows." type="wordpress" /></ProtectedRoute>} />
      <Route path="/cloud" element={<ProtectedRoute><ComingSoon title="Cloud" subtitle="infrastructure incoming." description="The Cloud workspace is being prepared for cloud infrastructure, deployments, and server management." type="cloud" /></ProtectedRoute>} />
      <Route path="/social" element={<ProtectedRoute><ComingSoon title="Social" subtitle="connections incoming." description="The Social workspace is being prepared for social media integrations, channels, and community feeds." type="social" /></ProtectedRoute>} />
      <Route path="/email-to-blog" element={<ProtectedRoute><ComingSoon title="Email to Blog" subtitle="publishing incoming." description="The Email to Blog workspace is being prepared to turn emails into ready-to-publish blog posts." type="email-to-blog" /></ProtectedRoute>} />
      <Route path="/technews" element={<Navigate to="/tech-news" replace />} />
      <Route path="/news" element={<Navigate to="/tech-news" replace />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </ErrorBoundary>
  </>
}
