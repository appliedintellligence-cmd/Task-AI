import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import Login from './pages/Login'
import Home from './pages/Home'
import Results from './pages/Results'
import History from './pages/History'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Home /></AuthGuard>} />
        <Route path="/results" element={<AuthGuard><Results /></AuthGuard>} />
        <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
