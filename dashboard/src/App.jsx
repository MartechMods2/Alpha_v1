import { lazy, Suspense, useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
const Login = lazy(() => import('./pages/Login.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const OperationsHub = lazy(() => import('./pages/OperationsHub.jsx'))
const ManagementSuite = lazy(() => import('./pages/ManagementSuite.jsx'))
const CustomizationStudio = lazy(() => import('./pages/CustomizationStudio.jsx'))
const EngagementCenter = lazy(() => import('./pages/EngagementCenter.jsx'))
const Commands = lazy(() => import('./pages/Commands.jsx'))
const CommandGuide = lazy(() => import('./pages/CommandGuide.jsx'))
const CommandLab = lazy(() => import('./pages/CommandLab.jsx'))
const Groups = lazy(() => import('./pages/Groups.jsx'))
const Members = lazy(() => import('./pages/Members.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const Broadcast = lazy(() => import('./pages/Broadcast.jsx'))
const Health = lazy(() => import('./pages/Health.jsx'))
const Logs = lazy(() => import('./pages/Logs.jsx'))
const DirectMessage = lazy(() => import('./pages/DirectMessage.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const MediaStudio = lazy(() => import('./pages/MediaStudio.jsx'))
const SafePack = lazy(() => import('./pages/SafePack.jsx'))
const ControlCenter = lazy(() => import('./pages/ControlCenter.jsx'))
const TemplateLibrary = lazy(() => import('./pages/TemplateLibrary.jsx'))
import { loadPersonalization } from './lib/personalization.js'

export const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)
export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function AuthGuard({ children }) {
  const { auth } = useAuth()
  const location = useLocation()
  if (auth === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}><div className="spinner" /></div>
  if (auth === false) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function StartupLanding() {
  const startup = loadPersonalization().startupPage
  return startup && startup !== '/' ? <Navigate to={startup} replace /> : <Dashboard />
}

function Toast({ toasts }) {
  return <div className="toast-stack">{toasts.map(t => <div key={t.id} className={`toast show ${t.ok ? 'ok' : 'err'}`}>{t.msg}</div>)}</div>
}

export default function App() {
  const [auth, setAuth] = useState(null)
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setAuth(data.authenticated === true); setGoogleAuthEnabled(!!data.googleAuthEnabled) })
      .catch(() => setAuth(false))
  }, [])

  const showToast = useCallback((msg, ok = true) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, msg, ok }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  const base = import.meta.env.BASE_URL
  const basename = base === '/' ? '' : base.replace(/\/$/, '')

  return (
    <AuthCtx.Provider value={{ auth, setAuth, googleAuthEnabled }}>
      <ToastCtx.Provider value={showToast}>
        <BrowserRouter basename={basename}>
          <Suspense fallback={<div className="route-loading" role="status"><div className="spinner" /><span>Loading workspace…</span></div>}><Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AuthGuard><Layout><Routes>
              <Route index element={<StartupLanding />} />
              <Route path="operations" element={<OperationsHub />} />
              <Route path="management" element={<ManagementSuite />} />
              <Route path="engagement" element={<EngagementCenter />} />
              <Route path="customize" element={<CustomizationStudio />} />
              <Route path="control-center" element={<ControlCenter />} />
              <Route path="templates" element={<TemplateLibrary />} />
              <Route path="commands" element={<Commands />} />
              <Route path="command-guide" element={<CommandGuide />} />
              <Route path="command-lab" element={<CommandLab />} />
              <Route path="groups" element={<Groups />} />
              <Route path="members" element={<Members />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="broadcast" element={<Broadcast />} />
              <Route path="health" element={<Health />} />
              <Route path="logs" element={<Logs />} />
              <Route path="dm" element={<DirectMessage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="media-studio" element={<MediaStudio />} />
              <Route path="safe-pack" element={<SafePack />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes></Layout></AuthGuard>} />
          </Routes></Suspense>
        </BrowserRouter>
        <Toast toasts={toasts} />
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  )
}
