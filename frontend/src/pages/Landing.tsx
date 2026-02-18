import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../components'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-line-700">
        <div className="container mx-auto px-6 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-display font-semibold text-white mb-6">
              Turn your bank CSV into an evidence-ready deduction report
            </h1>
            <p className="text-body text-slate-300 mb-8 max-w-2xl mx-auto">
              Upload your Australian bank statement and get a comprehensive analysis of likely deductible transactions for the income year.
            </p>
            <Button
              variant="primary"
              size="large"
              onClick={() => navigate('/upload')}
            >
              Upload CSV
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-b border-line-700 bg-ink-900">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-h3 font-semibold text-white mb-2">Privacy</div>
              <p className="text-small text-slate-300">
                Ephemeral mode by default. Your data is processed and deleted immediately.
              </p>
            </div>
            <div className="text-center">
              <div className="text-h3 font-semibold text-white mb-2">Explainability</div>
              <p className="text-small text-slate-300">
                Every classification includes the reasoning, matched rules, and evidence requirements.
              </p>
            </div>
            <div className="text-center">
              <div className="text-h3 font-semibold text-white mb-2">Australian Income Year</div>
              <p className="text-small text-slate-300">
                Aligned with 1 July to 30 June income year and ATO record-keeping expectations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-line-700">
        <div className="container mx-auto px-6 py-16">
          <h2 className="text-h2 font-semibold text-white text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-ink-900 border border-line-700 flex items-center justify-center mx-auto mb-4">
                <span className="text-h2 font-semibold text-white">1</span>
              </div>
              <h3 className="text-h3 font-semibold text-white mb-2">Upload</h3>
              <p className="text-small text-slate-300">
                Upload your bank CSV file and select the income year
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-ink-900 border border-line-700 flex items-center justify-center mx-auto mb-4">
                <span className="text-h2 font-semibold text-white">2</span>
              </div>
              <h3 className="text-h3 font-semibold text-white mb-2">Classify</h3>
              <p className="text-small text-slate-300">
                Transactions are analyzed, categorized, and assigned confidence scores
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-ink-900 border border-line-700 flex items-center justify-center mx-auto mb-4">
                <span className="text-h2 font-semibold text-white">3</span>
              </div>
              <h3 className="text-h3 font-semibold text-white mb-2">Export</h3>
              <p className="text-small text-slate-300">
                Download PDF, CSV, or JSON reports with evidence checklists
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Example Preview */}
      <section className="border-b border-line-700">
        <div className="container mx-auto px-6 py-16">
          <h2 className="text-h2 font-semibold text-white text-center mb-12">
            Example report preview
          </h2>
          <div className="max-w-4xl mx-auto">
            <Card>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-micro font-medium text-slate-500 mb-1">
                      LIKELY DEDUCTIBLE
                    </div>
                    <div className="text-h2 font-semibold text-white">$12,450.00</div>
                  </div>
                  <div>
                    <div className="text-micro font-medium text-slate-500 mb-1">
                      NEEDS REVIEW
                    </div>
                    <div className="text-h2 font-semibold text-slate-300">$2,340.00</div>
                  </div>
                  <div>
                    <div className="text-micro font-medium text-slate-500 mb-1">
                      EXCLUDED
                    </div>
                    <div className="text-h2 font-semibold text-slate-500">$45,210.00</div>
                  </div>
                </div>
                <div className="border-t border-line-700 pt-6">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-micro font-medium text-slate-500">
                        <th className="pb-3">DATE</th>
                        <th className="pb-3">MERCHANT</th>
                        <th className="pb-3">CATEGORY</th>
                        <th className="pb-3 text-right">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="text-small text-slate-300">
                      <tr className="border-t border-line-700">
                        <td className="py-3">15/01/2024</td>
                        <td className="py-3">Adobe</td>
                        <td className="py-3">Work Software</td>
                        <td className="py-3 text-right">$79.99</td>
                      </tr>
                      <tr className="border-t border-line-700">
                        <td className="py-3">22/01/2024</td>
                        <td className="py-3">Officeworks</td>
                        <td className="py-3">Work Equipment</td>
                        <td className="py-3 text-right">$145.50</td>
                      </tr>
                      <tr className="border-t border-line-700">
                        <td className="py-3">28/01/2024</td>
                        <td className="py-3">Telstra</td>
                        <td className="py-3">Phone & Internet</td>
                        <td className="py-3 text-right">$89.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section>
        <div className="container mx-auto px-6 py-16 text-center">
          <h2 className="text-h2 font-semibold text-white mb-4">
            Ready to analyze your transactions?
          </h2>
          <p className="text-body text-slate-300 mb-8">
            We generate likely deductible candidates. You confirm. Keep records.
          </p>
          <Button
            variant="primary"
            size="large"
            onClick={() => navigate('/upload')}
          >
            Get Started
          </Button>
        </div>
      </section>
    </div>
  )
}
