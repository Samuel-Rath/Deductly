import { useState } from 'react'
import { Card, Chip, Icon, PageHeader } from '../components'

const ruleCategories = [
  {
    category: 'Work Related Travel and Vehicles',
    description: 'Car expenses, public transport, flights, and accommodation for travel required for work — commuting to a regular workplace is not deductible',
    keywords: ['uber', 'didi', 'ola', 'taxi', 'transurban', 'citylink', 'eastlink', 'linkt', 'myki', 'opal', 'go card', 'qantas', 'jetstar', 'virgin australia', 'rex'],
    merchants: ['Uber', 'DiDi', 'Transurban / LinktT', 'Qantas', 'Jetstar', 'Virgin Australia'],
    confidence: 0.55,
    evidence: ['Logbook or km records for car', 'Receipts for fares, flights, accommodation', 'Work travel itinerary or employer confirmation'],
    flags: ['needs_review'],
    examples: [
      { description: 'UBER TRIP SYD123456', matched: 'uber keyword' },
      { description: 'QANTAS AIRWAYS BOOKING', matched: 'qantas keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Home Office Expenses',
    description: 'Internet, phone, electricity, and stationery used while working from home — only the work use proportion is deductible',
    keywords: ['telstra', 'optus', 'tpg', 'aussie broadband', 'superloop', 'tangerine', 'vodafone', 'internode', 'officeworks', 'ikea', 'harvey norman'],
    merchants: ['Telstra', 'Optus', 'TPG Telecom', 'Aussie Broadband', 'Officeworks'],
    confidence: 0.60,
    evidence: ['Internet/phone invoices', 'Hours worked from home record', 'Floor plan if claiming occupancy costs (actual cost method)'],
    flags: ['needs_review'],
    examples: [
      { description: 'TELSTRA MONTHLY ACCOUNT', matched: 'telstra keyword' },
      { description: 'OFFICEWORKS PTY LTD', matched: 'officeworks keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Tools, Equipment & Technology',
    description: 'Laptops, phones, subscriptions, and software used primarily for work — items used more than 50% for income earning purposes',
    keywords: ['microsoft', 'apple', 'adobe', 'jb hi-fi', 'harvey norman', 'officeworks', 'canva', 'atlassian', 'slack', 'zoom', 'dropbox', 'aws', 'google workspace', 'xero', 'myob'],
    merchants: ['Apple', 'JB Hi-Fi', 'Officeworks', 'Microsoft', 'Adobe', 'Harvey Norman'],
    confidence: 0.55,
    evidence: ['Receipt or invoice', 'Estimate of work use percentage', 'Description of how the item is used in your role'],
    flags: ['needs_review'],
    examples: [
      { description: 'MICROSOFT 365 SUBSCRIPTION', matched: 'microsoft keyword' },
      { description: 'JB HI-FI SOLUTIONS PTY LTD', matched: 'jb hi-fi keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Self Education and Professional Development',
    description: 'Courses, conferences, workshops, and textbooks directly related to your current role — must maintain or improve skills in your existing job',
    keywords: ['udemy', 'coursera', 'tafe', 'university', 'linkedin learning', 'pluralsight', 'conference', 'workshop', 'seminar', 'eventbrite', 'humanitix', 'trybooking'],
    merchants: ['TAFE', 'Udemy', 'Coursera', 'LinkedIn Learning', 'Eventbrite', 'University bookshops'],
    confidence: 0.70,
    evidence: ['Invoice or receipt', 'Course description and completion certificate', 'Statement of relevance to your current role'],
    examples: [
      { description: 'UDEMY IE COURSE PURCHASE', matched: 'udemy keyword' },
      { description: 'EVENTBRITE CONFERENCE REG', matched: 'eventbrite keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Professional Memberships & Subscriptions',
    description: 'Union fees, professional body memberships, industry association fees, and trade publications directly related to your occupation',
    keywords: ['cpa australia', 'chartered accountants', 'law society', 'ama', 'aicd', 'hia', 'master builders', 'aia australia', 'sia', 'membership fee', 'annual subscription'],
    merchants: ['CPA Australia', 'Chartered Accountants ANZ', 'Law Society', 'AMA', 'HIA', 'AICD'],
    confidence: 0.80,
    evidence: ['Membership invoice or receipt', 'Confirmation that the body is directly related to your current occupation'],
    examples: [
      { description: 'CPA AUSTRALIA MEMBERSHIP FEE', matched: 'cpa australia keyword' },
      { description: 'LAW SOCIETY ANNUAL SUBSCRIPTION', matched: 'law society keyword' },
    ],
    version: '1.0',
  },
  {
    category: 'Work Clothing & Protective Equipment',
    description: 'Compulsory uniforms, occupation specific protective clothing, and safety gear — conventional clothing worn at work is not deductible',
    keywords: ['workwear', 'hi-vis', 'safety boots', 'hard hat', 'ppe', 'bunnings', 'total tools', 'blackwoods', 'wurth', 'hard yakka', 'king gee'],
    merchants: ['Bunnings Warehouse', 'Total Tools', 'Blackwoods', 'Hard Yakka', 'King Gee'],
    confidence: 0.45,
    evidence: ['Receipt', 'Evidence of compulsory uniform policy or occupational safety/hygiene requirement'],
    flags: ['occupation_dependent', 'needs_review'],
    examples: [
      { description: 'BUNNINGS WAREHOUSE PTY LTD', matched: 'bunnings keyword' },
      { description: 'HARD YAKKA ONLINE STORE', matched: 'hard yakka keyword' },
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
    name: 'Loan and Mortgage Repayments',
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
    reason: 'General food and groceries are private expenses, even when consumed during work hours',
    examples: ['WOOLWORTHS SUPERMARKET', 'COLES ONLINE'],
  },
]

export default function Rules() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'classification' | 'exclusion' | 'confidence'>('classification')

  return (
    <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] pb-[96px] lg:pb-[140px]">
      <PageHeader
        index="03"
        label="Reference"
        title="Classification Rules"
        lead="Understand how transactions are categorised and what patterns we look for. This is the exact rule set the engine runs."
      />
      <div className="max-w-[980px]">

        <div>
          {/* Section Tabs */}
          <div className="mb-8">
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="flex gap-[24px] sm:gap-[32px] border-b border-bone/[0.12] min-w-max sm:min-w-0">
              <button
                onClick={() => setActiveSection('classification')}
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeSection === 'classification'
                    ? 'text-bone'
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Classification Rules
                {activeSection === 'classification' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
              <button
                onClick={() => setActiveSection('exclusion')}
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeSection === 'exclusion'
                    ? 'text-bone'
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Exclusion Rules
                {activeSection === 'exclusion' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
              <button
                onClick={() => setActiveSection('confidence')}
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeSection === 'confidence'
                    ? 'text-bone'
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Confidence Scoring
                {activeSection === 'confidence' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
            </div>
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
                          <h3 className="font-display text-[24px] sm:text-[28px] leading-[1.1] tracking-[-0.02em] text-bone text-left">
                            {rule.category}
                          </h3>
                          <p className="text-small text-slate-300 text-left mt-1">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Chip variant="neutral" size="small" label={`v${rule.version}`} />
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
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                            KEYWORDS
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.keywords.map((keyword, idx) => (
                              <Chip key={idx} variant="neutral" size="small" label={keyword} />
                            ))}
                          </div>
                        </div>

                        {/* Merchants */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                            KNOWN MERCHANTS
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.merchants.map((merchant, idx) => (
                              <Chip key={idx} variant="neutral" size="small" label={merchant} />
                            ))}
                          </div>
                        </div>

                        {/* Confidence */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                            BASE CONFIDENCE
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-small text-bone">
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
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                            REQUIRED EVIDENCE
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.evidence.map((ev, idx) => (
                              <Chip key={idx} variant="neutral" size="small" label={ev} />
                            ))}
                          </div>
                        </div>

                        {/* Flags */}
                        {rule.flags && rule.flags.length > 0 && (
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                              SPECIAL REQUIREMENTS
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {rule.flags.map((flag, idx) => (
                                <Chip key={idx} variant="accent" size="small" label={flag} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Examples */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                            MATCHING EXAMPLES
                          </div>
                          <div className="space-y-2">
                            {rule.examples.map((example, idx) => (
                              <div key={idx} className="p-3 bg-ink-800 rounded-lg">
                                <div className="text-small text-bone font-mono">
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
                    <h3 className="font-display text-[28px] leading-[1.1] tracking-[-0.02em] text-bone mb-[12px]">
                      About Exclusions
                    </h3>
                    <p className="text-small text-slate-300">
                      Before classification, transactions are checked against exclusion rules. 
                      Excluded transactions are clearly not deduction candidates and are filtered out early.
                    </p>
                  </div>

                  {exclusionRules.map((rule, idx) => (
                    <div key={idx} className="pt-6 border-t border-line-700">
                      <h4 className="text-small font-semibold text-bone mb-2">
                        {rule.name}
                      </h4>
                      <p className="text-small text-slate-300 mb-3">
                        {rule.reason}
                      </p>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
                          PATTERNS
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {rule.patterns.map((pattern, pidx) => (
                            <Chip key={pidx} variant="neutral" size="small" label={pattern} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
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
                    <h3 className="font-display text-[28px] leading-[1.1] tracking-[-0.02em] text-bone mb-[12px]">
                      How Confidence is Computed
                    </h3>
                    <p className="text-small text-slate-300">
                      Each classification rule has a base confidence score. The final confidence 
                      depends on the match quality and merchant recognition.
                    </p>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-bone mb-3">
                      How Confidence is Computed
                    </h4>
                    <p className="text-small text-slate-300 mb-4">
                      Confidence is a composite score (0–100%) built from three signals:
                    </p>
                    <div className="space-y-3 mb-4">
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small font-semibold text-bone mb-1">Keyword Score (up to 30%)</div>
                        <div className="text-micro text-slate-300">How strongly the transaction description and merchant match work related keywords across deduction categories (travel, home office, equipment, education, memberships, clothing, etc.)</div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small font-semibold text-bone mb-1">RAG Grounding Score (up to 40%)</div>
                        <div className="text-micro text-slate-300">How well the transaction aligns with retrieved ATO knowledge base chunks — including specific rulings on who can claim each category</div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small font-semibold text-bone mb-1">Claude AI Score (up to 30%)</div>
                        <div className="text-micro text-slate-300">Claude's assessment of deductibility given the ATO context, with PII redacted before any external API call</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-bone mb-3">
                      Confidence Levels
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-bone">High (80–100%)</span>
                          <span className="text-micro text-slate-500">Strong match</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: '90%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Clear occupational requirement — e.g. professional body membership, a self education course directly tied to your current role
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-bone">Medium (60–79%)</span>
                          <span className="text-micro text-slate-500">Likely but verify</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-500" style={{ width: '70%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Probable work expense — confirm the work use proportion or occupational nexus with your tax agent
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-small text-bone">Low (&lt; 60%)</span>
                          <span className="text-micro text-slate-500">Needs review</span>
                        </div>
                        <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700" style={{ width: '45%' }} />
                        </div>
                        <p className="text-micro text-slate-300 mt-2">
                          Ambiguous — likely mixed personal and work use; requires substantiation and advice from a registered tax agent
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-bone mb-3">
                      Merchant Normalisation
                    </h4>
                    <p className="text-small text-slate-300 mb-3">
                      Bank descriptions often include prefixes, reference numbers, and location codes.
                      These are stripped before matching:
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small text-bone font-mono mb-1">
                          EFTPOS OFFICEWORKS SYDNEY NSW
                        </div>
                        <div className="text-micro text-slate-300">
                          → Normalised to "Officeworks" (removes EFTPOS prefix and location)
                        </div>
                      </div>
                      <div className="p-3 bg-ink-800 rounded-lg">
                        <div className="text-small text-bone font-mono mb-1">
                          DD MICROSOFT CORPORATION 98765
                        </div>
                        <div className="text-micro text-slate-300">
                          → Normalised to "Microsoft" (removes DD prefix and reference number)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-line-700">
                    <h4 className="text-small font-semibold text-bone mb-3">
                      Important Disclaimer
                    </h4>
                    <p className="text-small text-slate-300">
                      Deductibility depends on the direct nexus between the expense and your income-earning activity under Australian tax law.
                      This tool provides indicative analysis only — always confirm with a registered tax agent
                      before claiming deductions. The ATO may disallow claims that lack sufficient substantiation
                      or a clear connection to your specific role.
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
