import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Landing, Upload, Report, Rules, Privacy } from './pages'
import { Navigation } from './components'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-ink-950">
        <a href="#main" className="skip-link">Skip to main content</a>
        <Navigation />
        <main id="main">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/report/:jobId" element={<Report />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
