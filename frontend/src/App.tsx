import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Landing, Upload, Report, Rules, Privacy, Terms } from './pages'
import { Navigation, Footer } from './components'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-ink-950 flex flex-col">
        <a href="#main" className="skip-link">Skip to main content</a>
        <Navigation />
        <main id="main" className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/report/:jobId" element={<Report />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  )
}

export default App
