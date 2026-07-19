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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard><ProductShell /></AuthGuard>}>
          <Route path="/app" element={<Home />} />
          <Route path="/diagnose" element={<ChatPage />} />
          <Route path="/repairs" element={<History />} />
          <Route path="/lists" element={<ShoppingLists />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/results" element={<Results />} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/history" element={<Navigate to="/repairs" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
