import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import Login from './pages/Login'
import ChatPage from './pages/ChatPage'
import History from './pages/History'
import Results from './pages/Results'
import Home from './pages/Home'
import ProductShell from './components/ProductShell'
import ShoppingLists from './pages/ShoppingLists'
import SettingsPage from './pages/SettingsPage'
import GuidedRepair from './pages/GuidedRepair'
import Landing from './pages/Landing'
import ResetPassword from './pages/ResetPassword'
import AuthCallback from './pages/AuthCallback'
import LegalPage from './pages/LegalPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/support" element={<LegalPage type="support" />} />
        <Route element={<AuthGuard><ProductShell /></AuthGuard>}>
          <Route path="/app" element={<Home />} />
          <Route path="/diagnose" element={<ChatPage />} />
          <Route path="/repairs" element={<History />} />
          <Route path="/lists" element={<ShoppingLists />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/results" element={<Results />} />
          <Route path="/guided" element={<GuidedRepair />} />
        </Route>
        <Route path="/history" element={<Navigate to="/repairs" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
