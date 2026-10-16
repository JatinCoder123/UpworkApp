import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ErrorBoundary, { AppError } from './components/ErrorBoundary.jsx'

// Runs before React mounts, so no error boundary can catch it: blocked storage must not stop the app loading.
let storedTheme = null
try { storedTheme = localStorage.getItem('pitchflow-theme') } catch { storedTheme = null }
const initialTheme = storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
document.documentElement.dataset.theme = initialTheme
document.documentElement.style.colorScheme = initialTheme

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost net: if anything below fails to render, show a themed error screen instead of a blank page. */}
    <ErrorBoundary name="app" fallback={AppError}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
