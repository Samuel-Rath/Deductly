import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Card, AnimatedSection } from '../components'
import { Shield, Zap, FileText, Check, ArrowRight, Upload } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ink-950 via-ink-900 to-ink-900">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5 opacity-50" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(6 182 212 / 0.05) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        
        <div className="container mx-auto px-6 py-20 md:py-28 relative">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Content */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-block mb-6">
                    <span className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-full text-accent text-sm font-medium">
                      Australian Tax Deductions Made Simple
                    </span>
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1]"
                >
                  Turn Bank Statements Into{' '}
                  <span className="text-accent">
                    Tax-Ready Reports
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-xl text-slate-300 mb-8 leading-relaxed"
                >
                  Upload your bank statement (CSV or PDF), get instant analysis of deductible transactions with confidence scores, evidence requirements, and ATO-ready documentation.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex flex-col sm:flex-row items-start gap-4 mb-8"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/upload')}
                    className="group w-full sm:w-auto"
                  >
                    <span className="flex items-center gap-2">
                      Get Started Free
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate('/rules')}
                    className="w-full sm:w-auto"
                  >
                    View Classification Rules
                  </Button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="flex flex-wrap items-center gap-6 text-sm text-slate-400"
                >
                  <div className="flex items-center gap-2">
                    <Check size={18} className="text-accent" strokeWidth={2.5} />
                    No signup required
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={18} className="text-accent" strokeWidth={2.5} />
                    Privacy-first
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={18} className="text-accent" strokeWidth={2.5} />
                    Instant results
                  </div>
                </motion.div>
              </div>

              {/* Right: Visual */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block"
              >
                <div className="relative">
                  {/* Mock Upload Card */}
                  <div className="bg-ink-800 border-2 border-accent/30 rounded-2xl p-8 shadow-soft-lg">
                    <div className="flex items-center justify-center mb-6">
                      <div className="w-16 h-16 bg-accent/10 rounded-xl flex items-center justify-center">
                        <Upload size={32} className="text-accent" />
                      </div>
                    </div>
                    <div className="text-center mb-6">
                      <div className="text-lg font-semibold text-white mb-2">Drop your file here</div>
                      <div className="text-sm text-slate-400">CSV or PDF • or click to browse</div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-2 bg-ink-700 rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-3/4 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Processing transactions...</span>
                        <span>75%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating Stats */}
                  <div className="absolute -bottom-4 -left-4 bg-ink-900 border border-line-700 rounded-lg p-4 shadow-soft-lg">
                    <div className="text-xs text-slate-400 mb-1">Deductible Found</div>
                    <div className="text-2xl font-bold text-accent">$12,450</div>
                  </div>
                  
                  <div className="absolute -top-4 -right-4 bg-ink-900 border border-line-700 rounded-lg p-4 shadow-soft-lg">
                    <div className="text-xs text-slate-400 mb-1">Confidence</div>
                    <div className="text-2xl font-bold text-white">95%</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-ink-900">
        <div className="container mx-auto px-6">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need for Tax Time
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Powered by intelligent classification rules and designed for Australian tax requirements
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            <AnimatedSection delay={0.1}>
              <Card className="h-full hover:border-accent/50 transition-all group bg-ink-800 border-line-700">
                <div className="p-8">
                  <div className="w-14 h-14 bg-accent/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Shield size={28} className="text-accent" strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">Privacy First</h3>
                  <p className="text-base text-slate-300 leading-relaxed">
                    Ephemeral mode by default. Your data is processed in memory and deleted immediately after generating your report.
                  </p>
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <Card className="h-full hover:border-accent/50 transition-all group bg-ink-800 border-line-700">
                <div className="p-8">
                  <div className="w-14 h-14 bg-accent/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Zap size={28} className="text-accent" strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">Smart Classification</h3>
                  <p className="text-base text-slate-300 leading-relaxed">
                    Intelligent rules engine matches transactions to deduction categories with confidence scores and evidence requirements.
                  </p>
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.3}>
              <Card className="h-full hover:border-accent/50 transition-all group bg-ink-800 border-line-700">
                <div className="p-8">
                  <div className="w-14 h-14 bg-accent/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <FileText size={28} className="text-accent" strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-4">Multiple Formats</h3>
                  <p className="text-base text-slate-300 leading-relaxed">
                    Export as PDF for your accountant, CSV for spreadsheets, or JSON for further analysis. All with complete audit trails.
                  </p>
                </div>
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-ink-950">
        <div className="container mx-auto px-6">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How Deductly Works
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Three simple steps to tax-ready deduction reports
            </p>
          </AnimatedSection>

          <div className="max-w-5xl mx-auto space-y-8">
            <AnimatedSection delay={0.1}>
              <div className="flex items-start gap-6 p-8 bg-ink-900 border border-line-700 rounded-2xl hover:border-accent/30 transition-all">
                <div className="flex-shrink-0 w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-soft">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-white mb-3">Upload Your Statement</h3>
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Upload your bank statement as CSV or PDF. We support all major Australian banks and automatically detect the format and income year.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="flex items-start gap-6 p-8 bg-ink-900 border border-line-700 rounded-2xl hover:border-accent/30 transition-all">
                <div className="flex-shrink-0 w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-soft">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-white mb-3">Instant Analysis</h3>
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Our engine processes your transactions, filters out non-deductible items, and classifies potential deductions with confidence scores.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.3}>
              <div className="flex items-start gap-6 p-8 bg-ink-900 border border-line-700 rounded-2xl hover:border-accent/30 transition-all">
                <div className="flex-shrink-0 w-14 h-14 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-soft">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-white mb-3">Download Your Report</h3>
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Get a comprehensive report with categorised deductions, evidence requirements, and complete audit trail. Ready for your accountant or ATO.
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-ink-900 to-ink-950">
        <div className="container mx-auto px-6">
          <AnimatedSection>
            <div className="max-w-5xl mx-auto bg-gradient-to-br from-accent/10 to-accent/5 border-2 border-accent/30 rounded-3xl p-12 md:p-16 text-center shadow-soft-lg">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Simplify Your Tax Deductions?
              </h2>
              <p className="text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                Join thousands of Australians who trust Deductly for their tax preparation
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/upload')}
                className="group"
              >
                <span className="flex items-center gap-2">
                  Start Analysing Now
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <p className="mt-6 text-sm text-slate-400">
                No credit card required • Process unlimited transactions • Export in any format
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  )
}
