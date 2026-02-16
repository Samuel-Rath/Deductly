import { BrowserRouter as Router } from 'react-router-dom'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-ink-950">
        <header className="border-b border-line-700 py-6">
          <div className="container mx-auto px-6">
            <h1 className="text-h2">Tax Deduction Analyzer</h1>
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          <p className="text-slate-300">Application ready</p>
        </main>
      </div>
    </Router>
  )
}

export default App
