import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Landing, Upload, Report, Rules, Privacy, Terms } from './pages'
import { Navigation, Footer } from './components'
import SmoothScroll from './components/SmoothScroll'

function App() {
  return (
    <Router>
      {/* Lenis smooth scroll + scroll-to-top on route change */}
      <SmoothScroll />
      <div className="grain min-h-screen bg-ink-950 text-bone flex flex-col">
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
