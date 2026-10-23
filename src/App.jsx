import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import SessionLoader from './components/SessionLoader'
import ScrollToTop from './components/ScrollToTop'
import DocNotificationToast from './components/DocNotificationToast'
import GlobalErrorToast from './components/GlobalErrorToast'
import ErrorBoundary, { PageError } from './components/ErrorBoundary'
import { useAuth } from './contexts/AuthContext'
import { canAccess, homePath, needsRole } from './lib/permissions'

// Each page downloads only when it is first opened, so the app starts with a small bundle.
const Jobs = lazy(() => import('./pages/Jobs'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const LiveJobs = lazy(() => import('./pages/LiveJobs'))
const LiveJobDetail = lazy(() => import('./pages/LiveJobDetail'))
const Activity = lazy(() => import('./pages/Activity'))
const TechNews = lazy(() => import('./pages/TechNews'))
const TechNewsDetail = lazy(() => import('./pages/TechNewsDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const Preferences = lazy(() => import('./pages/Preferences'))
const Video = lazy(() => import('./pages/Video'))
const SiteContent = lazy(() => import('./pages/SiteContent'))
const Seo = lazy(() => import('./pages/Seo'))
const Domain = lazy(() => import('./pages/Domain'))
const ApiPlayground = lazy(() => import('./pages/ApiPlayground'))
const Wordpress = lazy(() => import('./pages/Wordpress'))
const Llm = lazy(() => import('./pages/Llm'))
const AppScript = lazy(() => import('./pages/AppScript'))
const Social = lazy(() => import('./pages/Social'))
const ComingSoon = lazy(() => import('./pages/ComingSoon'))
const CustomFeed = lazy(() => import('./pages/CustomFeed'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'))

const NoFallback = () => null


// Signed-in users only. A user without a role picks one on the onboarding page first.
// A page the user has no permission for (or an admin page, for a non-admin) shows a 403 page at the same URL,
// never a redirect; URLs that do not exist at all fall through to the 404 route. Rules: lib/permissions.
function ProtectedRoute({ children }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <SessionLoader />
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  if (needsRole(user)) return <Navigate to="/onboarding" replace />
  if (!canAccess(user, location.pathname)) return <NotFound type="forbidden" />
  return children
}

// First-login role picker; a user who already has a role is sent on to their home page.
function OnboardingRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') return <SessionLoader />
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  return needsRole(user) ? <Onboarding /> : <Navigate to={homePath(user)} replace />
}

export default function App() {
  const location = useLocation()

  return <>
    <ScrollToTop />
    {/* Toasts are extras: if one fails it disappears instead of taking the app down. */}
    <ErrorBoundary name="doc-toast" fallback={NoFallback}><DocNotificationToast /></ErrorBoundary>
    <ErrorBoundary name="error-toast" fallback={NoFallback}><GlobalErrorToast /></ErrorBoundary>
    {/* A page that fails to render shows an error inside the normal header; changing route clears it. */}
    <ErrorBoundary name="page" fallback={PageError} resetKey={location.pathname}>
    <Suspense fallback={<SessionLoader />}>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<OnboardingRoute />} />
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
      <Route path="/appscript" element={<ProtectedRoute><AppScript /></ProtectedRoute>} />
      <Route path="/llm" element={<ProtectedRoute><Llm /></ProtectedRoute>} />
      <Route path="/wordpress" element={<ProtectedRoute><Wordpress /></ProtectedRoute>} />
      <Route path="/cloud" element={<ProtectedRoute><ComingSoon title="Cloud" subtitle="infrastructure incoming." description="The Cloud workspace is being prepared for cloud infrastructure, deployments, and server management." type="cloud" /></ProtectedRoute>} />
      <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
      <Route path="/email-to-blog" element={<ProtectedRoute><ComingSoon title="Email to Blog" subtitle="publishing incoming." description="The Email to Blog workspace is being prepared to turn emails into ready-to-publish blog posts." type="email-to-blog" /></ProtectedRoute>} />
      <Route path="/api-playground" element={<ProtectedRoute><ApiPlayground /></ProtectedRoute>} />
      {/* Feeds users created (CRM outr_feeds); open to every signed-in user. */}
      <Route path="/feeds/:id" element={<ProtectedRoute><CustomFeed /></ProtectedRoute>} />
      <Route path="/technews" element={<Navigate to="/tech-news" replace />} />
      <Route path="/news" element={<Navigate to="/tech-news" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/permissions" replace />} />
      <Route path="/admin/permissions" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  </>
}
