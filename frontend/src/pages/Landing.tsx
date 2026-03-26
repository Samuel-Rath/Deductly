import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Card, AnimatedSection } from '../components'
import { Shield, Zap, FileText, Check, ArrowRight, Upload, Brain } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="pt-16">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-mesh min-h-[92vh] flex items-center">

        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(165,180,252,1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Animated glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/20 blur-[120px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/15 blur-[100px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

        <div className="container mx-auto px-6 py-24 md:py-32 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Left: copy */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-accent/10 border border-accent/25 text-accent-light mb-8">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    Australian Fitness Tax Deductions
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.1 }}
                  className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
                >
                  <span className="text-white">Turn Bank Statements Into </span>
                  <span className="text-gradient-bright">Tax-Ready</span>
                  <span className="text-white"> Reports</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.2 }}
                  className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg"
                >
                  Upload your CSV or PDF bank statement and get instant AI-powered analysis of fitness-related deductions — with ATO citations, confidence scores, and evidence checklists.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.3 }}
                  className="flex flex-col sm:flex-row items-start gap-3 mb-10"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/upload')}
                    className="w-full sm:w-auto group"
                  >
                    Analyse My Statement
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate('/rules')}
                    className="w-full sm:w-auto"
                  >
                    View ATO Rules
                  </Button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.45 }}
                  className="flex flex-wrap gap-5 text-sm text-slate-500"
                >
                  {['No account needed', 'Data never stored', 'ATO-cited analysis'].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <Check size={14} className="text-violet-400" strokeWidth={2.5} />
                      {t}
                    </span>
                  ))}
                </motion.div>
              </div>

              {/* Right: mock UI card */}
              <motion.div
                initial={{ opacity: 0, x: 32, scale: 0.97 }}
                animate={{ opacity: 1, x: 0,  scale: 1 }}
                transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
                className="hidden lg:block"
              >
                <div className="relative">
                  {/* Main card */}
                  <div className="glass border border-line-600 rounded-2xl p-8 shadow-glow-violet">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center shadow-glow-violet">
                        <Upload size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">bank_statement_jul24.pdf</div>
                        <div className="text-xs text-slate-500">Analysing 247 transactions…</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-8">
                      <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-violet-500 via-accent to-blue-500 animate-shimmer bg-[length:200%_auto]" />
                    </div>
                    {/* Mock transaction rows */}
                    {[
                      { name: 'Anytime Fitness', cat: 'Gym Membership',    conf: 62, amount: '$79.99'  },
                      { name: 'St John Ambulance', cat: 'First Aid Cert',  conf: 88, amount: '$149.00' },
                      { name: 'Rebel Sport',       cat: 'Fitness Equipment', conf: 51, amount: '$212.50' },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between py-3 border-b border-line-700 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-white">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.cat}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-ink-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
                                style={{ width: `${row.conf}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{row.conf}%</span>
                          </div>
                          <span className="text-sm font-semibold text-white tabular-nums">{row.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Floating badge — total found */}
                  <div className="absolute -bottom-5 -left-5 glass border border-line-600 rounded-xl px-4 py-3 shadow-glow">
                    <div className="text-xs text-slate-500 mb-0.5">Potential deductions</div>
                    <div className="text-xl font-bold text-gradient">$1,840.50</div>
                  </div>

                  {/* Floating badge — AI */}
                  <div className="absolute -top-5 -right-5 glass border border-accent/30 rounded-xl px-4 py-3 shadow-glow flex items-center gap-2">
                    <Brain size={16} className="text-accent-light" />
                    <span className="text-sm font-semibold text-white">AI-Powered</span>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="py-24 bg-ink-900 relative overflow-hidden">
        {/* Section glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/5 via-transparent to-transparent pointer-events-none" />

        <div className="container mx-auto px-6 relative">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need for Tax Time
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Powered by ATO-grounded AI and built for Australian fitness professionals
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {[
              {
                icon: <Shield size={24} />,
                title: 'Privacy First',
                body: 'Data is processed in memory and discarded the moment your report is generated. Nothing is ever stored.',
                delay: 0.1,
              },
              {
                icon: <Brain size={24} />,
                title: 'AI-Grounded',
                body: 'Claude AI cross-references every transaction against an ATO fitness knowledge base with occupation-specific rules.',
                delay: 0.2,
              },
              {
                icon: <Zap size={24} />,
                title: 'Confidence Scores',
                body: 'Composite scoring — keyword matching, RAG grounding, and AI reasoning — gives you a transparent 0–100% score.',
                delay: 0.3,
              },
              {
                icon: <FileText size={24} />,
                title: 'ATO Citations',
                body: 'Every deduction candidate comes with the specific ATO ruling or tax determination that supports the claim.',
                delay: 0.4,
              },
            ].map((f) => (
              <AnimatedSection key={f.title} delay={f.delay}>
                <Card className="h-full group hover:border-accent/40 hover:shadow-glow transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-blue-500/10 border border-line-600 flex items-center justify-center mb-5 text-accent-light group-hover:scale-110 transition-transform">
                    {f.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="py-24 bg-ink-950 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-900/5 to-transparent pointer-events-none" />

        <div className="container mx-auto px-6 relative">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Three steps from statement to deduction report
            </p>
          </AnimatedSection>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                n: '01',
                title: 'Upload Your Statement',
                body: 'Drop in a CSV or PDF from any major Australian bank. We auto-detect the format, income year, and bank layout.',
                delay: 0.1,
              },
              {
                n: '02',
                title: 'AI Analyses Your Transactions',
                body: 'Fitness-related transactions are matched against 17 ATO knowledge chunks and scored by AI. PII is redacted before any external call.',
                delay: 0.2,
              },
              {
                n: '03',
                title: 'Download Your Report',
                body: 'Get a full deduction report with ATO citations, evidence checklists, and occupation-dependent flags — ready for your tax agent.',
                delay: 0.3,
              },
            ].map((step) => (
              <AnimatedSection key={step.n} delay={step.delay}>
                <div className="glass border border-line-700 hover:border-line-600 rounded-2xl p-7 flex items-start gap-6 transition-all duration-200 group">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-glow group-hover:shadow-glow-violet transition-shadow">
                    {step.n}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-24 bg-ink-900 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] rounded-full bg-violet-600/15 blur-[100px]" />
        </div>

        <div className="container mx-auto px-6 relative">
          <AnimatedSection>
            <div className="max-w-4xl mx-auto border-gradient rounded-3xl p-14 text-center">
              {/* Inner gradient sheen */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-600/8 via-transparent to-blue-500/5 pointer-events-none" />

              <div className="relative">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
                  Ready to Find Your Deductions?
                </h2>
                <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Upload your bank statement and get an ATO-grounded fitness deduction report in under a minute
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/upload')}
                  className="group mx-auto"
                >
                  Start Analysing Now
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Button>
                <p className="mt-6 text-sm text-slate-500">
                  No account · No storage · No surprises
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

    </div>
  )
}
