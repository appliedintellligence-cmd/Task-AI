import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Results from './pages/Results'
import History from './pages/History'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}
