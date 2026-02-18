import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Landing, Upload, Report, Rules, Privacy } from './pages'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-ink-950">
        <header className="border-b border-line-700 py-6">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between">
              <Link to="/" className="text-h2 font-semibold text-white hover:text-accent transition-colors">
                Tax Deduction Analyzer
              </Link>
              <nav className="flex items-center space-x-6">
                <Link to="/rules" className="text-small text-slate-300 hover:text-white transition-colors">
                  Rules
                </Link>
                <Link to="/privacy" className="text-small text-slate-300 hover:text-white transition-colors">
                  Privacy
                </Link>
              </nav>
            </div>
          </div>
        </header>
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
