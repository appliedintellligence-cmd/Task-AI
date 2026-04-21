import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import Login from './pages/Login'
import ChatPage from './pages/ChatPage'
import History from './pages/History'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><ChatPage /></AuthGuard>} />
        <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
