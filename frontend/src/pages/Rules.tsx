import { useState } from 'react'
import { Card, Chip, AnimatedSection, Icon } from '../components'

const ruleCategories = [
  {
    category: 'Work Software',
    description: 'Software subscriptions and tools used for work purposes',
    keywords: ['adobe', 'microsoft 365', 'github', 'jetbrains', 'slack', 'zoom'],
    merchants: ['Adobe', 'Microsoft', 'GitHub', 'JetBrains', 'Slack', 'Zoom'],
    confidence: 0.95,
    evidence: ['Receipt'],
    examples: [
      { description: 'PAYPAL *ADOBE CREATIVE', matched: 'adobe keyword + PayPal merchant' },
      { description: 'MICROSOFT 365 SUBSCRIPTION', matched: 'microsoft 365 keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Professional Memberships',
    description: 'Professional association fees, licenses, and registrations',
    keywords: ['cpa australia', 'engineers australia', 'ama', 'law society'],
    merchants: ['CPA Australia', 'Engineers Australia', 'AMA'],
    confidence: 0.90,
    evidence: ['Receipt', 'Invoice'],
    examples: [
      { description: 'CPA AUSTRALIA MEMBERSHIP', matched: 'cpa australia keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Training & Education',
    description: 'Job-related courses, conferences, and professional development',
    keywords: ['udemy', 'coursera', 'linkedin learning', 'conference'],
    merchants: ['Udemy', 'Coursera', 'LinkedIn'],
    confidence: 0.85,
    evidence: ['Receipt', 'Invoice'],
    examples: [
      { description: 'UDEMY COURSE PURCHASE', matched: 'udemy keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Work Equipment',
    description: 'Tools, equipment, and supplies used for work',
    keywords: ['officeworks', 'bunnings', 'laptop', 'monitor', 'keyboard'],
    merchants: ['Officeworks', 'Bunnings', 'JB Hi-Fi'],
    confidence: 0.80,
    evidence: ['Receipt'],
    examples: [
      { description: 'EFTPOS OFFICEWORKS SYDNEY', matched: 'officeworks keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Phone & Internet',
    description: 'Phone and internet expenses (percentage required)',
    keywords: ['telstra', 'optus', 'vodafone', 'nbn'],
    merchants: ['Telstra', 'Optus', 'Vodafone'],
    confidence: 0.75,
    evidence: ['Receipt', 'Percentage Record'],
    flags: ['percentage_required'],
    examples: [
      { description: 'DIRECT DEBIT TELSTRA', matched: 'telstra keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Donations',
    description: 'Gifts to deductible gift recipient organisations',
    keywords: ['red cross', 'salvation army', 'cancer council', 'donation'],
    merchants: ['Red Cross', 'Salvation Army', 'Cancer Council'],
    confidence: 0.90,
    evidence: ['Receipt', 'Eligibility Check'],
    flags: ['eligibility_required'],
    examples: [
      { description: 'RED CROSS DONATION', matched: 'red cross keyword' },
    ],
    version: '1.0',
  },
]

const exclusionRules = [
  {
    name: 'Transfer Between Accounts',
    patterns: ['TRANSFER TO', 'TRANSFER FROM', 'OSKO', 'PAYID', 'BPAY'],
    reason: 'Internal transfers are not deduction candidates',
    examples: ['TRANSFER TO SAVINGS', 'OSKO PAYMENT TO JOHN'],
  },
  {
    name: 'Cash Withdrawals',
    patterns: ['ATM WITHDRAWAL', 'CASH OUT', 'EFTPOS CASH'],
    reason: 'Cash withdrawals cannot be substantiated without receipts',
    examples: ['ATM WITHDRAWAL WESTPAC', 'EFTPOS CASH $50'],
  },
  {
    name: 'Loan Repayments',
    patterns: ['LOAN REPAYMENT', 'MORTGAGE', 'HOME LOAN'],
    reason: 'Loan repayments are not deductible expenses',
    examples: ['HOME LOAN REPAYMENT', 'MORTGAGE PAYMENT'],
  },
  {
    name: 'Tax Settlements',
    patterns: ['ATO PAYMENT', 'AUSTRALIAN TAXATION OFFICE'],
    reason: 'Tax payments are not deductible',
    examples: ['ATO PAYMENT ARRANGEMENT', 'AUSTRALIAN TAXATION OFFICE'],
  },
]

export default function Rules() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'classification' | 'exclusion' | 'confidence'>('classification')

  return (
    <div className="pt-16 container mx-auto px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <AnimatedSection className="mb-8">
          <h1 className="text-h1 font-semibold text-white mb-2">
            Classification Rules
          </h1>
          <p className="text-body text-slate-300">
            Understand how transactions are categorised and what patterns we look for
          </p>
        </AnimatedSection>

        <div>
          {/* Section Tabs */}
          <div className="mb-8">
            <div className="flex space-x-6 border-b border-line-700">
              <button
                onClick={() => setActiveSection('classification')}
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeSection === 'classification' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Classification Rules
                {activeSection === 'classification' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveSection('exclusion')}
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeSection === 'exclusion' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Exclusion Rules
                {activeSection === 'exclusion' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveSection('confidence')}
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeSection === 'confidence' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Confidence Scoring
                {activeSection === 'confidence' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            </div>
          </div>

          {/* Classification Rules */}
          {activeSection === 'classification' && (
            <div className="space-y-4">
              {ruleCategories.map((rule) => (
                <Card key={rule.category}>
                  <div>
                    <button
                      onClick={() => setExpandedCategory(
                        expandedCategory === rule.category ? null : rule.category
                      )}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="text-h3 font-semibold text-white text-left">
                            {rule.category}
                          </h3>
                          <p className="text-small text-slate-300 text-left mt-1">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Chip variant="neutral" size="small">
                          v{rule.version}
                        </Chip>
                        <Icon 
                          name="ChevronDown" 
                          size={20} 
                          className={`text-slate-500 transition-transform ${
                            expandedCategory === rule.category ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {expandedCategory === rule.category && (
                      <div className="mt-6 pt-6 border-t border-line-700 space-y-6">
                        {/* Keywords */}
                        <div>
                          <div className="text-micro font-medium text-slate-500 mb-2">
                            KEYWORDS
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.keywords.map((keyword, idx) => (
                              <Chip key={idx} variant="neutral" size="small">
                                {keyword}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        {/* Merchants */}
                        <div>
                          <div className="text-micro font-medium text-slate-500 mb-2">
                            KNOWN MERCHANTS
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.merchants.map((merchant, idx) => (
                              <Chip key={idx} variant="neutral" size="small">
                                {merchant}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        {/* Confidence */}
                        <div>
                          <div className="text-micro font-medium text-slate-500 mb-2">
                            BASE CONFIDENCE
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-small text-white">
                              {(rule.confidence * 100).toFixed(0)}%
                            </span>
                            <div className="flex-1 max-w-xs h-2 bg-ink-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent"
                                style={{ width: `${rule.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Evidence */}
                        <div>
                          <div className="text-micro font-medium text-slate-500 mb-2">
                            REQUIRED EVIDENCE
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.evidence.map((ev, idx) => (
                              <Chip key={idx} variant="neutral" size="small">
                                {ev}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        {/* Flags */}
                        {rule.flags && rule.flags.length > 0 && (
                          <div>
                            <div className="text-micro font-medium text-slate-500 mb-2">
                              SPECIAL REQUIREMENTS
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {rule.flags.map((flag, idx) => (
                                <Chip key={idx} variant="accent" size="small">
                                  {flag}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Examples */}
                        <div>
                          <div className="text-micro font-medium text-slate-500 mb-2">
                            MATCHING EXAMPLES
                          </div>
                          <div className="space-y-2">
                            {rule.examples.map((example, idx) => (
                              <div key={idx} className="p-3 bg-ink-800 rounded-lg">
                                <div className="text-small text-white font-mono">
                                  {example.description}
                                </div>
                                <div className="text-micro text-slate-300 mt-1">
                                  Matched: {example.matched}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Exclusion Rules */}
          {activeSection === 'exclusion' && (
            <div className="space-y-6">
              <Card>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-h3 font-semibold text-white mb-2">
                      About Exclusions
                    </h3>
                    <p className="text-small text-slate-300">
                      Before classification, transactions are checked against exclusion rules. 
                      Excluded transactions are clearly not deduction candidates and are filtered out early.
                    </p>
                  </div>

                  {exclusionRules.map((rule, idx) => (
                    <div key={idx} className="pt-6 border-t border-line-700">
                      <h4 className="text-small font-semibold text-white mb-2">
                        {rule.name}
                      </h4>
                      <p className="text-small text-slate-300 mb-3">
                        {rule.reason}
                      </p>
                      <div>
                        <div className="text-micro font-medium text-slate-500 mb-2">
                          PATTERNS
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {rule.patterns.map((pattern, pidx) => (
                            <Chip key={pidx} variant="neutral" size="small">
                              {pattern}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-micro font-medium text-slate-500 mb-2">
                          EXAMPLES
                        </div>
                        <div className="space-y-1">
                          {rule.examples.map((example, eidx) => (
                            <div key={eidx} className="text-small text-slate-300 font-mono">
                              {example}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Confidence Scoring */}
          {activeSection === 'confidence' && (
            <div className="space-y-6">
              <Card>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-h3 font-semibold text-white mb-2">
                      How Confidence is Computed
                    </h3>
                    <p className="text-small text-slate-300">
                      Each classification rule has a base confidence score. The final confidence 
                      depends on the match quality and merchant recognition.
                    </p>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-white mb-3">
                      Confidence Levels
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-white">High (0.80 - 1.00)</span>
                          <span className="text-micro text-slate-500">Strong match</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: '90%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Clear keyword or merchant match with high base confidence
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-white">Medium (0.60 - 0.79)</span>
                          <span className="text-micro text-slate-500">Moderate match</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-500" style={{ width: '70%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Fuzzy merchant match or lower confidence rule
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-white">Low (&lt; 0.60)</span>
                          <span className="text-micro text-slate-500">Needs review</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700" style={{ width: '45%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Weak match or ambiguous transaction - requires manual review
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-white mb-3">
                      Fuzzy Merchant Matching
                    </h4>
                    <p className="text-small text-slate-300 mb-3">
                      Merchant names often include prefixes, reference numbers, and location codes. 
                      Our fuzzy matcher normalizes these variations:
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small text-white font-mono mb-1">
                          PAYPAL *ADOBE CREATIVE 1234
                        </div>
                        <div className="text-micro text-slate-300">
                          → Normalized to "Adobe" (removes PAYPAL prefix and reference number)
                        </div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small text-white font-mono mb-1">
                          EFTPOS OFFICEWORKS SYDNEY NSW
                        </div>
                        <div className="text-micro text-slate-300">
                          → Normalized to "Officeworks" (removes EFTPOS prefix and location)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-white mb-3">
                      Rule Priority
                    </h4>
                    <p className="text-small text-slate-300">
                      When multiple rules match a transaction, the rule with the highest confidence 
                      is selected. If confidence scores are equal, rule priority determines the winner.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
