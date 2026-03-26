import { Card, AnimatedSection, Icon } from '../components'

export default function Privacy() {
  return (
    <div className="pt-24 container mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <AnimatedSection className="mb-8">
          <h1 className="text-h1 font-semibold text-white mb-2">
            Privacy & Data Handling
          </h1>
          <p className="text-body text-slate-300">
            Understand how your data is processed and what we store
          </p>
        </AnimatedSection>

        <div>
          {/* What Data is Processed */}
          <AnimatedSection delay={0.1}>
            <Card className="mb-6">
              <div className="space-y-4">
                <h2 className="text-h2 font-semibold text-white">
                  What data is processed
                </h2>
                <p className="text-body text-slate-300">
                  When you upload a bank CSV file, we process the following information:
                </p>
                <ul className="space-y-2 text-body text-slate-300 list-disc list-inside">
                  <li>Transaction dates</li>
                  <li>Transaction descriptions</li>
                  <li>Transaction amounts (debits and credits)</li>
                  <li>Derived merchant names (extracted from descriptions)</li>
                </ul>
                <div className="mt-4 p-4 bg-ink-800 border border-line-700 rounded-lg">
                  <p className="text-small text-slate-300">
                    <span className="font-semibold text-white">Important:</span> We do not process or store 
                    account numbers, BSB codes, or any personally identifiable information beyond what's 
                    needed for transaction classification.
                  </p>
                </div>
              </div>
            </Card>
          </AnimatedSection>

          {/* What is Stored by Default */}
          <AnimatedSection delay={0.2}>
            <Card className="mb-6">
              <div className="space-y-4">
                <h2 className="text-h2 font-semibold text-white">
                  What is stored by default
                </h2>
                <p className="text-body text-slate-300">
                  By default, we operate in <span className="font-semibold text-white">ephemeral mode</span>, 
                  which means:
                </p>
                <ul className="space-y-2 text-body text-slate-300 list-disc list-inside">
                  <li>Raw CSV data is never written to disk</li>
                  <li>Transaction data is processed in memory only</li>
                  <li>Reports are generated and made available for download</li>
                  <li>All data is deleted immediately after report generation</li>
                </ul>
                <div className="mt-4 p-4 bg-accent bg-opacity-10 border border-accent rounded-lg">
                  <p className="text-small text-white">
                    <span className="font-semibold">Ephemeral mode is always on.</span> Your data is never
                    written to disk and is discarded as soon as your report is generated.
                  </p>
                </div>
              </div>
            </Card>
          </AnimatedSection>

          {/* Ephemeral Mode Explanation */}
          <AnimatedSection delay={0.3}>
            <Card className="mb-6">
              <div className="space-y-4">
                <h2 className="text-h2 font-semibold text-white">
                  Ephemeral mode explained
                </h2>
                <p className="text-body text-slate-300">
                  Ephemeral mode is our privacy-first approach to transaction analysis:
                </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-accent bg-opacity-20 flex items-center justify-center mt-1 flex-shrink-0">
                    <Icon name="Check" size={16} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">No persistent storage</div>
                    <div className="text-small text-slate-300">
                      Your transaction data is never saved to a database or file system
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-accent bg-opacity-20 flex items-center justify-center mt-1 flex-shrink-0">
                    <Icon name="Check" size={16} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">Memory-only processing</div>
                    <div className="text-small text-slate-300">
                      All analysis happens in memory and is cleared when complete
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-accent bg-opacity-20 flex items-center justify-center mt-1 flex-shrink-0">
                    <Icon name="Check" size={16} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">Download and delete</div>
                    <div className="text-small text-slate-300">
                      Reports are generated for immediate download, then removed from the server
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-ink-800 border border-line-700 rounded-lg">
                <p className="text-small text-slate-300">
                  <span className="font-semibold text-white">No opt-out:</span> Ephemeral mode cannot be
                  disabled. This is intentional — your financial data should never leave your session.
                </p>
              </div>
            </div>
            </Card>
          </AnimatedSection>

          {/* How Reports are Generated */}
          <AnimatedSection delay={0.4}>
            <Card className="mb-6">
              <div className="space-y-4">
                <h2 className="text-h2 font-semibold text-white">
                  How reports are generated
                </h2>
                <p className="text-body text-slate-300">
                  Our processing pipeline follows these steps:
                </p>
              
              <div className="space-y-4 mt-4">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 rounded-full bg-ink-800 border border-line-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-small font-semibold text-white">1</span>
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">Normalisation</div>
                    <div className="text-small text-slate-300">
                      CSV data is parsed and standardized. Merchant names are extracted from descriptions.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 rounded-full bg-ink-800 border border-line-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-small font-semibold text-white">2</span>
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">Exclusion</div>
                    <div className="text-small text-slate-300">
                      Transactions that are clearly not deduction candidates (transfers, ATM withdrawals, 
                      loan repayments) are filtered out.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 rounded-full bg-ink-800 border border-line-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-small font-semibold text-white">3</span>
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">Rule Classification</div>
                    <div className="text-small text-slate-300">
                      Transactions are matched against fitness-specific ATO rules. Confidence scores
                      are assigned based on keyword matching and rule logic.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 rounded-full bg-ink-800 border border-line-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-small font-semibold text-white">4</span>
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">AI Analysis (optional)</div>
                    <div className="text-small text-slate-300">
                      Fitness-related transactions are analysed against the ATO knowledge base using
                      Claude AI. PII is redacted from descriptions before any data leaves the server.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 rounded-full bg-ink-800 border border-line-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-small font-semibold text-white">5</span>
                  </div>
                  <div>
                    <div className="text-small font-semibold text-white">Report Generation</div>
                    <div className="text-small text-slate-300">
                      A report is generated with deduction candidates, confidence scores, ATO citations,
                      and evidence requirements. Data is discarded immediately after.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-ink-800 border border-line-700 rounded-lg">
                <p className="text-small text-slate-300">
                  <span className="font-semibold text-white">Audit trail:</span> Every processing step 
                  is recorded in the JSON audit trail, allowing you to understand exactly how each 
                  transaction was classified.
                </p>
              </div>
              </div>
            </Card>
          </AnimatedSection>

          {/* Redaction Recommendations */}
          <AnimatedSection delay={0.5}>
            <Card className="mb-6">
              <div className="space-y-4">
                <h2 className="text-h2 font-semibold text-white">
                  Redaction recommendations
                </h2>
                <p className="text-body text-slate-300">
                  Before sharing reports with third parties (like your accountant), consider redacting:
                </p>
              
              <div className="space-y-3 mt-4">
                <div className="p-3 bg-ink-800 rounded-lg">
                  <div className="text-small font-semibold text-white mb-1">
                    Account numbers and BSB codes
                  </div>
                  <div className="text-small text-slate-300">
                    If present in transaction descriptions, these should be redacted or masked
                  </div>
                </div>

                <div className="p-3 bg-ink-800 rounded-lg">
                  <div className="text-small font-semibold text-white mb-1">
                    Personal reference numbers
                  </div>
                  <div className="text-small text-slate-300">
                    Transaction IDs and reference numbers that could identify your accounts
                  </div>
                </div>

                <div className="p-3 bg-ink-800 rounded-lg">
                  <div className="text-small font-semibold text-white mb-1">
                    Sensitive merchant names
                  </div>
                  <div className="text-small text-slate-300">
                    Medical providers or other merchants you prefer to keep private
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-accent bg-opacity-10 border border-accent rounded-lg">
                <p className="text-small text-white">
                  <span className="font-semibold">Already implemented:</span> BSB codes, account numbers,
                  and card numbers are automatically redacted from transaction descriptions before any
                  AI analysis. Raw descriptions are never sent to external APIs.
                </p>
              </div>
              </div>
            </Card>
          </AnimatedSection>

          {/* Additional Information */}
          <AnimatedSection delay={0.6}>
            <Card>
            <div className="space-y-4">
              <h2 className="text-h2 font-semibold text-white">
                Additional information
              </h2>
              
              <div className="space-y-3">
                <div>
                  <div className="text-small font-semibold text-white mb-1">
                    No authentication required
                  </div>
                  <div className="text-small text-slate-300">
                    This tool does not require account creation or login. Your data is processed 
                    anonymously.
                  </div>
                </div>

                <div>
                  <div className="text-small font-semibold text-white mb-1">
                    Local processing option
                  </div>
                  <div className="text-small text-slate-300">
                    For maximum privacy, you can run this tool locally on your own machine. 
                    See the GitHub repository for installation instructions.
                  </div>
                </div>

                <div>
                  <div className="text-small font-semibold text-white mb-1">
                    Open source
                  </div>
                  <div className="text-small text-slate-300">
                    This tool is open source. You can review the code to verify our privacy claims 
                    and data handling practices.
                  </div>
                </div>
              </div>
            </div>
          </Card>
          </AnimatedSection>
        </div>
      </div>
    </div>
  )
}