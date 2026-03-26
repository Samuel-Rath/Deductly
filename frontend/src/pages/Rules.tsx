import { useState } from 'react'
import { Card, Chip, AnimatedSection, Icon } from '../components'

const ruleCategories = [
  {
    category: 'Gym & Fitness Memberships',
    description: 'Gym, fitness centre, and pool memberships — deductible if fitness is required for your job (e.g. personal trainer, police, military)',
    keywords: ['gym', 'fitness', 'anytime fitness', 'goodlife', 'snap fitness', 'planet fitness', 'f45', 'crossfit', 'aquatic centre'],
    merchants: ['Anytime Fitness', 'Goodlife Health Clubs', 'Snap Fitness', 'F45 Training', 'Genesis Gym'],
    confidence: 0.20,
    evidence: ['Receipt or bank statement', 'Employment contract showing fitness requirement'],
    flags: ['occupation_dependent', 'needs_review'],
    examples: [
      { description: 'ANYTIME FITNESS MEMBERSHIP', matched: 'anytime fitness keyword' },
      { description: 'F45 TRAINING MONTHLY FEE', matched: 'f45 keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Personal Training',
    description: 'Personal trainer fees — deductible when directly required for maintaining fitness standards in your occupation',
    keywords: ['personal trainer', 'personal training', 'pt session', 'fitness coach', 'strength coach'],
    merchants: ['Local PT studios', 'Online coaching platforms'],
    confidence: 0.25,
    evidence: ['Invoice from trainer', 'Proof of occupation fitness requirement'],
    flags: ['occupation_dependent', 'needs_review'],
    examples: [
      { description: 'PT SESSION JOHN SMITH FITNESS', matched: 'personal trainer keyword' },
      { description: 'PERSONAL TRAINING MONTHLY', matched: 'personal training keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Sports & Fitness Equipment',
    description: 'Equipment purchased for fitness training — may be deductible for professional athletes or where fitness is a job condition',
    keywords: ['rebel sport', 'amart sports', 'rogue fitness', 'power rack', 'barbell', 'dumbbells', 'resistance bands', 'foam roller'],
    merchants: ['Rebel Sport', 'Amart Sports', 'Rogue Fitness', 'Decathlon'],
    confidence: 0.18,
    evidence: ['Receipt', 'Evidence equipment is used for income-earning activity'],
    flags: ['occupation_dependent', 'needs_review'],
    examples: [
      { description: 'REBEL SPORT PTY LTD', matched: 'rebel sport keyword' },
      { description: 'PURCHASE RESISTANCE BANDS', matched: 'resistance bands keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Activewear & Fitness Clothing',
    description: 'Fitness clothing (e.g. Lululemon, Nike) — generally not deductible unless it is protective or a compulsory uniform',
    keywords: ['lululemon', 'lorna jane', '2xu', 'under armour', 'activewear', 'compression'],
    merchants: ['Lululemon', 'Lorna Jane', '2XU', 'Under Armour'],
    confidence: 0.10,
    evidence: ['Receipt', 'Evidence of compulsory uniform or protective clothing requirement'],
    flags: ['occupation_dependent', 'needs_review'],
    examples: [
      { description: 'LULULEMON AUSTRALIA', matched: 'lululemon keyword' },
      { description: 'LORNA JANE PTY LTD', matched: 'lorna jane keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Fitness Certifications & First Aid',
    description: 'Fitness industry certifications, CPR/First Aid — deductible if required for your current fitness-related role',
    keywords: ['first aid', 'cpr', 'fitness australia', 'cert iii', 'cert iv', 'hltaid', 'reps accreditation'],
    merchants: ['Fitness Australia', 'St John Ambulance', 'Australian Red Cross', 'TAFE'],
    confidence: 0.80,
    evidence: ['Receipt or invoice', 'Course completion certificate'],
    examples: [
      { description: 'ST JOHN AMBULANCE FIRST AID', matched: 'first aid keyword' },
      { description: 'FITNESS AUSTRALIA MEMBERSHIP', matched: 'fitness australia keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Supplements & Sports Nutrition',
    description: 'Protein, vitamins, and sports supplements — generally not deductible; narrow exception for professional athletes on specialist medical advice',
    keywords: ['protein', 'supplements', 'creatine', 'bcaa', 'nutrition warehouse', 'musashi', 'optimum nutrition'],
    merchants: ['Nutrition Warehouse', 'Bulk Nutrients', 'Chemist Warehouse', 'GNC'],
    confidence: 0.15,
    evidence: ['Receipt', 'Medical/dietary advice from registered professional'],
    flags: ['occupation_dependent', 'needs_review'],
    examples: [
      { description: 'NUTRITION WAREHOUSE ONLINE', matched: 'nutrition warehouse keyword' },
      { description: 'BULK NUTRIENTS PTY LTD', matched: 'protein/supplements keyword' },
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
    name: 'Loan & Mortgage Repayments',
    patterns: ['LOAN REPAYMENT', 'MORTGAGE', 'HOME LOAN'],
    reason: 'Loan repayments are not deductible expenses',
    examples: ['HOME LOAN REPAYMENT', 'MORTGAGE PAYMENT'],
  },
  {
    name: 'Tax Payments',
    patterns: ['ATO PAYMENT', 'AUSTRALIAN TAXATION OFFICE'],
    reason: 'Tax payments to the ATO are not deductible',
    examples: ['ATO PAYMENT ARRANGEMENT', 'AUSTRALIAN TAXATION OFFICE'],
  },
  {
    name: 'Superannuation Contributions',
    patterns: ['SUPERANNUATION', 'SUPER CONTRIBUTION', 'HOSTPLUS', 'AUSTRALIAN SUPER'],
    reason: 'Standard employer super contributions are not deductible as work expenses (voluntary concessional contributions are handled separately)',
    examples: ['HOSTPLUS SUPERANNUATION', 'AUSTRALIAN SUPER CONTRIBUTION'],
  },
  {
    name: 'General Food & Groceries',
    patterns: ['WOOLWORTHS', 'COLES', 'ALDI', 'IGA', 'GROCERY'],
    reason: 'General food and groceries are private expenses even if you follow a fitness diet',
    examples: ['WOOLWORTHS SUPERMARKET', 'COLES ONLINE'],
  },
]

export default function Rules() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'classification' | 'exclusion' | 'confidence'>('classification')

  return (
    <div className="pt-24 container mx-auto px-6 py-12">
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
                      How Confidence is Computed
                    </h4>
                    <p className="text-small text-slate-300 mb-4">
                      Confidence is a composite score (0–100%) built from three signals:
                    </p>
                    <div className="space-y-3 mb-4">
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small font-semibold text-white mb-1">Keyword Score (up to 30%)</div>
                        <div className="text-micro text-slate-300">How strongly the transaction description and merchant match fitness-related keywords across 10 groups (gym, personal training, supplements, equipment, activewear, etc.)</div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small font-semibold text-white mb-1">RAG Grounding Score (up to 40%)</div>
                        <div className="text-micro text-slate-300">How well the transaction aligns with retrieved ATO knowledge base chunks — including specific rulings on who can claim each category</div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small font-semibold text-white mb-1">Claude AI Score (up to 30%)</div>
                        <div className="text-micro text-slate-300">Claude's assessment of deductibility given the ATO context, with PII redacted before any external API call</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-white mb-3">
                      Confidence Levels
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-white">High (80–100%)</span>
                          <span className="text-micro text-slate-500">Strong match</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: '90%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Clear occupational requirement — e.g. first aid certification for a fitness instructor
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-white">Medium (60–79%)</span>
                          <span className="text-micro text-slate-500">Likely but verify</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-500" style={{ width: '70%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Probable fitness expense — confirm your occupation qualifies
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-white">Low (&lt; 60%)</span>
                          <span className="text-micro text-slate-500">Needs review</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700" style={{ width: '45%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Ambiguous — most fitness expenses are occupation-dependent and require professional advice
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-white mb-3">
                      Merchant Normalisation
                    </h4>
                    <p className="text-small text-slate-300 mb-3">
                      Bank descriptions often include prefixes, reference numbers, and location codes.
                      These are stripped before matching:
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small text-white font-mono mb-1">
                          EFTPOS ANYTIME FITNESS SYDNEY NSW
                        </div>
                        <div className="text-micro text-slate-300">
                          → Normalised to "Anytime Fitness" (removes EFTPOS prefix and location)
                        </div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small text-white font-mono mb-1">
                          DD REBEL SPORT PTY LTD 12345
                        </div>
                        <div className="text-micro text-slate-300">
                          → Normalised to "Rebel Sport" (removes DD prefix and reference number)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-white mb-3">
                      Important Disclaimer
                    </h4>
                    <p className="text-small text-slate-300">
                      Fitness expense deductibility is highly occupation-dependent under Australian tax law.
                      This tool provides indicative analysis only — always confirm with a registered tax agent
                      before claiming deductions. The ATO may disallow claims that don't meet the nexus
                      requirement between the expense and your income-earning activity.
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
