import { useState } from 'react'
import { Chip, PageHeader } from '../components'

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
      <div className="grid lg:grid-cols-12 gap-[56px] lg:gap-[32px]">
      {/* min-w-0: lets the tab strip scroll instead of widening the grid column */}
      <div className="lg:col-span-8 min-w-0">

        <div>
          {/* Section Tabs */}
          <div className="mb-[8px]">
            <div className="overflow-x-auto">
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
            <div className="border-b border-bone/[0.1]">
              {ruleCategories.map((rule, i) => (
                <div key={rule.category} className="border-t border-bone/[0.1]">
                  <div>
                    <button
                      onClick={() => setExpandedCategory(
                        expandedCategory === rule.category ? null : rule.category
                      )}
                      aria-expanded={expandedCategory === rule.category}
                      className="group w-full flex items-start justify-between gap-[16px] py-[24px] sm:py-[28px] text-left"
                    >
                      <div className="grid grid-cols-[32px_1fr] sm:grid-cols-[56px_1fr] gap-x-[8px]">
                        <span aria-hidden="true" className="font-mono text-[11px] text-brass pt-[9px]">{String(i + 1).padStart(2, '0')}</span>
                        <div>
                          <h3 className="font-display text-[24px] sm:text-[30px] leading-[1.1] tracking-[-0.02em] text-bone text-left transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:translate-x-[6px]">
                            {rule.category}
                          </h3>
                          <p className="mt-[10px] max-w-[62ch] text-[14.5px] leading-[1.6] text-bone-400 text-left">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-[14px] pt-[6px] shrink-0">
                        <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">{`v${rule.version}`}</span>
                        <span
                          aria-hidden="true"
                          className={`grid place-items-center w-[32px] h-[32px] rounded-full border border-bone/15 text-bone-400 font-mono text-[14px] leading-none transition-[transform,border-color,color] duration-300 group-hover:border-bone/40 group-hover:text-bone ${
                            expandedCategory === rule.category ? 'rotate-45' : ''
                          }`}
                        >
                          +
                        </span>
                      </div>
                    </button>

                    {expandedCategory === rule.category && (
                      <div className="pb-[36px] pl-[40px] sm:pl-[64px] space-y-[28px]">
                        {/* Keywords */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">
                            KEYWORDS
                          </div>
                          <div className="flex flex-wrap gap-[6px]">
                            {rule.keywords.map((keyword, idx) => (
                              <Chip key={idx} variant="neutral" size="small" label={keyword} />
                            ))}
                          </div>
                        </div>

                        {/* Merchants */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">
                            KNOWN MERCHANTS
                          </div>
                          <div className="flex flex-wrap gap-[6px]">
                            {rule.merchants.map((merchant, idx) => (
                              <Chip key={idx} variant="neutral" size="small" label={merchant} />
                            ))}
                          </div>
                        </div>

                        {/* Confidence */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">
                            BASE CONFIDENCE
                          </div>
                          <div className="flex items-center gap-[16px]">
                            <span className="font-display text-[26px] leading-none text-brass tabular-nums">
                              {(rule.confidence * 100).toFixed(0)}%
                            </span>
                            <div className="flex-1 max-w-[280px] h-[4px] bg-bone/[0.08] overflow-hidden">
                              <div
                                className="h-full bg-brass"
                                style={{ width: `${rule.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Evidence */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">
                            REQUIRED EVIDENCE
                          </div>
                          <div className="flex flex-wrap gap-[6px]">
                            {rule.evidence.map((ev, idx) => (
                              <Chip key={idx} variant="neutral" size="small" label={ev} />
                            ))}
                          </div>
                        </div>

                        {/* Flags */}
                        {rule.flags && rule.flags.length > 0 && (
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">
                              SPECIAL REQUIREMENTS
                            </div>
                            <div className="flex flex-wrap gap-[6px]">
                              {rule.flags.map((flag, idx) => (
                                <Chip key={idx} variant="accent" size="small" label={flagLabel(flag)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Examples */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">
                            MATCHING EXAMPLES
                          </div>
                          <div className="space-y-[12px]">
                            {rule.examples.map((example, idx) => (
                              <div key={idx} className="border-l-2 border-brass/50 pl-[14px] py-[4px]">
                                <div className="font-mono text-[12.5px] text-bone">
                                  {example.description}
                                </div>
                                <div className="mt-[4px] text-[13px] text-bone-400">
                                  Matched: {example.matched}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Exclusion Rules */}
          {activeSection === 'exclusion' && (
            <div>
              <div className="pb-[32px]">
                <h3 className="font-display text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] text-bone">About Exclusions</h3>
                <p className="mt-[14px] max-w-[62ch] text-[15px] leading-[1.65] text-bone-400">
                  Before classification, transactions are checked against exclusion rules.
                  Excluded transactions are clearly not deduction candidates and are filtered out early.
                </p>
              </div>
              <div className="border-b border-bone/[0.1]">
                {exclusionRules.map((rule, idx) => (
                  <div key={idx} className="grid grid-cols-[32px_1fr] sm:grid-cols-[56px_1fr] gap-x-[8px] py-[28px] border-t border-bone/[0.1]">
                    <span aria-hidden="true" className="font-mono text-[11px] text-brass pt-[6px]">{String(idx + 1).padStart(2, '0')}</span>
                    <div>
                      <h4 className="font-display text-[22px] sm:text-[24px] leading-[1.15] tracking-[-0.01em] text-bone">{rule.name}</h4>
                      <p className="mt-[8px] max-w-[62ch] text-[14.5px] leading-[1.6] text-bone-400">{rule.reason}</p>
                      <div className="mt-[18px] grid sm:grid-cols-2 gap-[20px]">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">PATTERNS</div>
                          <div className="flex flex-wrap gap-[6px]">
                            {rule.patterns.map((pattern, pidx) => (
                              <Chip key={pidx} variant="neutral" size="small" label={pattern} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-[10px]">EXAMPLES</div>
                          <div className="space-y-[4px]">
                            {rule.examples.map((example, eidx) => (
                              <div key={eidx} className="font-mono text-[12.5px] text-bone-200">{example}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Scoring: describes what classification_engine.py actually does */}
          {activeSection === 'confidence' && (
            <div className="space-y-[56px]">
              <section>
                <h3 className="font-display text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] text-bone">How Confidence is Computed</h3>
                <p className="mt-[14px] max-w-[62ch] text-[15px] leading-[1.65] text-bone-400">
                  Confidence comes from the rules engine alone. No language model or external service is involved.
                  A matched transaction starts at its rule&apos;s base score, then two signals adjust it.
                </p>
                <ol className="mt-[24px] border-b border-bone/[0.1]">
                  {CONFIDENCE_SIGNALS.map(([title, effect, body], i) => (
                    <li key={title} className="grid grid-cols-[32px_1fr_auto] sm:grid-cols-[56px_1fr_auto] gap-x-[8px] sm:gap-x-[16px] py-[20px] border-t border-bone/[0.1]">
                      <span aria-hidden="true" className="font-mono text-[11px] text-brass pt-[5px]">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <h4 className="text-[16px] font-medium text-bone">{title}</h4>
                        <p className="mt-[6px] max-w-[54ch] text-[14px] leading-[1.6] text-bone-400">{body}</p>
                      </div>
                      <span className="font-mono text-[12px] text-bone-200 whitespace-nowrap pt-[3px]">{effect}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-[16px] text-[13px] text-bone-600">
                  The result is kept between 0 and 100%. Anything under your chosen threshold (60% by default) goes to Needs Review.
                </p>
              </section>

              <section>
                <h3 className="font-display text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] text-bone">Confidence Levels</h3>
                <div className="mt-[24px] border-b border-bone/[0.1]">
                  {CONFIDENCE_LEVELS.map(([label, tag, width, tone, body]) => (
                    <div key={label} className="py-[20px] border-t border-bone/[0.1]">
                      <div className="flex items-baseline justify-between gap-[16px]">
                        <span className="text-[16px] text-bone">{label}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">{tag}</span>
                      </div>
                      <div className="mt-[12px] h-[4px] bg-bone/[0.08] overflow-hidden">
                        <div className={`h-full ${tone}`} style={{ width }} />
                      </div>
                      <p className="mt-[10px] max-w-[62ch] text-[14px] leading-[1.6] text-bone-400">{body}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-display text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.02em] text-bone">Merchant Normalisation</h3>
                <p className="mt-[14px] max-w-[62ch] text-[15px] leading-[1.65] text-bone-400">
                  Bank descriptions often include prefixes, reference numbers, and location codes.
                  These are stripped before matching:
                </p>
                <div className="mt-[20px] space-y-[14px]">
                  {NORMALISATION_EXAMPLES.map(([raw, result]) => (
                    <div key={raw} className="border-l-2 border-brass/50 pl-[14px] py-[4px]">
                      <div className="font-mono text-[12.5px] text-bone">{raw}</div>
                      <div className="mt-[4px] text-[13px] text-bone-400">{result}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-l-2 border-bone/20 pl-[16px]">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">Important Disclaimer</h3>
                <p className="mt-[10px] max-w-[66ch] text-[14px] leading-[1.65] text-bone-400">
                  Deductibility depends on the direct nexus between the expense and your income-earning activity under Australian tax law.
                  This tool provides indicative analysis only. Always confirm with a registered tax agent before claiming deductions.
                  The ATO may disallow claims that lack sufficient substantiation or a clear connection to your specific role.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>

        <aside className="lg:col-span-3 lg:col-start-10">
          <div className="lg:sticky lg:top-[112px]">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">How to read a rule</h2>
            <dl className="mt-[16px]">
              {LEGEND.map(([term, meaning]) => (
                <div key={term} className="py-[16px] border-t border-bone/[0.09]">
                  <dt className="font-display text-[20px] leading-none tracking-[-0.01em] text-bone">{term}</dt>
                  <dd className="mt-[8px] text-[14px] leading-[1.6] text-bone-400">{meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}

const LEGEND: Array<[string, string]> = [
  ['Keywords', 'Words looked for in the transaction description.'],
  ['Known merchants', 'Merchant names the engine recognises for this category.'],
  ['Base confidence', 'The starting score for a match, before other signals raise or lower it.'],
  ['Required evidence', 'What to keep so the claim can be substantiated.'],
]

const FLAG_LABELS: Record<string, string> = {
  needs_review: 'Needs review',
  occupation_dependent: 'Occupation dependent',
  method_required: 'Calculation method required',
  percentage_required: 'Work percentage required',
  instant_deduction_eligible: 'Instant deduction eligible',
  depreciation_check: 'Check depreciation rules',
}

function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

// Mirrors classification_engine.py: base score from the rule, then two adjustments.
const CONFIDENCE_SIGNALS: Array<[string, string, string]> = [
  ['Rule base score', 'Starting point', 'Each rule has its own base confidence, shown on the rule under Classification Rules. It reflects how reliably that rule\'s keywords and merchants point to a work expense.'],
  ['Recurring subscription', '+8 points', 'Software, phone and internet, and membership charges that recur across the statement are more likely to be ongoing work costs.'],
  ['Merchant match quality', '+5 / \u22125 points', 'A near-exact merchant name match (95% similarity or more) adds 5 points. A loose match (under 88%) takes 5 away.'],
]

const CONFIDENCE_LEVELS: Array<[string, string, string, string, string]> = [
  ['High (80\u2013100%)', 'Strong match', '90%', 'bg-brass', 'Clear occupational requirement, e.g. a professional body membership or a course directly tied to your current role.'],
  ['Medium (60\u201379%)', 'Likely but verify', '70%', 'bg-brass/50', 'Probable work expense. Confirm the work-use proportion or occupational nexus with your tax agent.'],
  ['Low (< 60%)', 'Needs review', '45%', 'bg-bone/25', 'Ambiguous, likely mixed personal and work use. Needs substantiation and advice from a registered tax agent.'],
]

const NORMALISATION_EXAMPLES: Array<[string, string]> = [
  ['EFTPOS OFFICEWORKS SYDNEY NSW', '\u2192 Normalised to "Officeworks" (removes EFTPOS prefix and location)'],
  ['DD MICROSOFT CORPORATION 98765', '\u2192 Normalised to "Microsoft" (removes DD prefix and reference number)'],
]
