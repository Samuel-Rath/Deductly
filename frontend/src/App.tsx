import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Landing, Upload, Report, Rules, Privacy } from './pages'
import { Navigation } from './components'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-ink-950">
        <Navigation />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/report/:jobId" element={<Report />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
