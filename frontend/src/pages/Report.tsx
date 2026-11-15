import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Card, Button, Chip, Drawer, Icon, PageHeader } from '../components'
import { useJobStatus, useDownloadReportFile } from '../api/hooks'
import { downloadReport } from '../api/client'

// ─── Flag metadata ────────────────────────────────────────────────────────────
const FLAG_INFO: Record<string, { label: string; description: string; action?: string; color: 'amber' | 'green' }> = {
  needs_review:        { label: 'Needs Review',               color: 'amber', description: 'Confidence is below your threshold. Worth checking with a tax agent before claiming.' },
  occupation_dependent:{ label: 'Occupation Dependent',       color: 'amber', description: 'Only deductible for certain occupations. Confirm this expense applies to your specific job.' },
  method_required:     { label: 'Calculation Method Required',color: 'amber', description: 'You must choose between two ATO-approved methods (e.g. fixed rate vs. actual cost for home office).', action: 'Check the ATO guidelines for your preferred method.' },
  percentage_required:        { label: 'Work Percentage Required',    color: 'amber', description: 'Only the work-related portion is deductible. Estimate and record the percentage used for work.', action: 'Keep a logbook or diary to substantiate your claim.' },
  instant_deduction_eligible: { label: 'Instant Deduction Eligible',  color: 'green', description: 'Under $300 — you can claim the full amount this year without depreciation.' },
  depreciation_check:         { label: 'Check Depreciation Rules',    color: 'amber', description: 'Over $300 — this item must be depreciated over its effective life unless a concession applies.', action: 'Check the ATO guide on deducting items over $300.' },
}

// ─── Category labels ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  work_software:            'Work Software',
  professional_memberships: 'Professional Memberships',
  training_education:       'Training & Education',
  work_equipment:           'Work Equipment',
  phone_internet:           'Phone & Internet',
  working_from_home:        'Working From Home',
  travel:                   'Work Travel',
  donations:                'Donations',
  bank_fees:                'Bank Fees',
}

// ─── Generic name detection + smart display resolver ─────────────────────────
const GENERIC_NAMES = new Set([
  'transaction', 'eftpos', 'visa', 'mastercard', 'purchase', 'payment',
  'pos purchase', 'card purchase', 'direct debit', 'bpay', 'transfer',
  'credit', 'debit', 'deposit', 'withdrawal', 'fee', 'charge',
  'miscellaneous', 'misc', 'other', 'unknown',
])

function isGeneric(s: string): boolean {
  return GENERIC_NAMES.has(s.toLowerCase().trim())
}

function extractFromReason(reason: string | undefined): string | null {
  if (!reason) return null
  const m = reason.match(/merchant_match:\s*(.+?)(?:\s*\(similarity:[^)]*\))?(?:;|$)/i)
  if (m) return m[1].trim()
  const k = reason.match(/keyword_match:\s*([^;(]+)/i)
  if (k) return k[1].trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return null
}

function resolveDisplay(txn: any): { merchant: string; description: string } {
  const rawMerchant = (txn.merchant ?? '').trim()
  const rawDesc    = (txn.description ?? '').trim()
  const catLabel   = CATEGORY_LABELS[txn.category] ?? null
  const hint       = extractFromReason(txn.reason)

  const merchant   = isGeneric(rawMerchant) ? (hint ?? catLabel ?? rawMerchant) : rawMerchant
  const description = isGeneric(rawDesc)
    ? catLabel ? `${catLabel} expense` : (hint ? `${hint} expense` : rawDesc)
    : rawDesc

  return { merchant, description }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ─── Reason formatter ─────────────────────────────────────────────────────────
function formatReason(reason: string | undefined): string {
  if (!reason) return ''
  const parts = reason.split(';').map(s => s.trim()).filter(Boolean)
  const mapped = parts.map(part => {
    const merchantMatch = part.match(/^merchant_match:\s*(.+?)(?:\s*\(similarity:.*?\))?$/i)
    if (merchantMatch) return `Matched merchant: ${merchantMatch[1].trim()}`
    const keywordMatch = part.match(/^keyword_match:\s*(.+)$/i)
    if (keywordMatch) return `Keywords: ${keywordMatch[1].trim()}`
    const ruleMatch = part.match(/^rule:\s*(.+)$/i)
    if (ruleMatch) return `Rule: ${ruleMatch[1].trim()}`
    const hintMatch = part.match(/^no_match\s*\|\s*hints:\s*(.+)$/i)
    if (hintMatch) return `No match found — possible: ${hintMatch[1].replace(/possible_/gi, '').replace(/_/g, ' ').trim()}`
    if (part === 'no_match' || part === 'no_rule_matched') return 'No matching rule found'
    return part
  })
  const result = mapped.join(' · ')
  return result || reason
}

export default function Report() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'candidates' | 'needs-review' | 'excluded' | 'audit'>('candidates')
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  
  // Check if report data was passed via navigation state (ephemeral mode)
  const stateReportData = location.state?.reportData
  
  // Normalize report data to handle both snake_case (backend) and camelCase (old format)
  const normalizeReportData = (data: any) => {
    if (!data) return null
    
    return {
      income_year: data.income_year,
      generated_at: data.generated_at,
      summary: {
        totalDeductible: data.summary?.total_deductible ?? data.summary?.totalDeductible ?? 0,
        totalNeedsReview: data.summary?.total_needs_review ?? data.summary?.totalNeedsReview ?? 0,
        totalExcluded: data.summary?.total_excluded ?? data.summary?.totalExcluded ?? 0,
        categoryTotals: data.summary?.category_totals ?? data.summary?.categoryTotals ?? {},
        confidenceDistribution: {
          high: data.summary?.confidence_distribution?.high ?? data.summary?.confidenceDistribution?.high ?? 0,
          medium: data.summary?.confidence_distribution?.medium ?? data.summary?.confidenceDistribution?.medium ?? 0,
          low: data.summary?.confidence_distribution?.low ?? data.summary?.confidenceDistribution?.low ?? 0,
        }
      },
      candidates: data.candidates ?? [],
      needs_review: data.needs_review ?? [],
      excluded: data.excluded ?? []
    }
  }
  
  const [reportData, setReportData] = useState<any>(normalizeReportData(stateReportData))
  
  // Fetch job status with polling - only if we don't already have report data
  const { data: jobStatus, isLoading, error: jobError } = useJobStatus(jobId || '', {
    enabled: !!jobId && !stateReportData,
    refetchInterval: (data) => {
      // Stop polling when job is complete or failed
      if (!data) return 5000 // Poll every 5 seconds initially
      return data.status === 'completed' || data.status === 'failed' ? false : 5000 // Poll every 5 seconds
    },
  })

  // Fetch report data when job is completed - only if we don't already have it from state
  useEffect(() => {
    async function fetchReportData() {
      if (jobStatus?.status === 'completed' && jobId && !reportData) {
        try {
          const blob = await downloadReport(jobId, 'json')
          const text = await blob.text()
          const data = JSON.parse(text)
          setReportData(normalizeReportData(data))
          setReportError(null)
        } catch (error) {
          console.error('Failed to fetch report data:', error)
          setReportError('Failed to load report data')
        }
      }
    }
    fetchReportData()
  }, [jobStatus, jobId, reportData])

  // Download mutation
  const downloadMutation = useDownloadReportFile({
    onSuccess: () => {
      setDownloadError(null)
    },
    onError: (error) => {
      setDownloadError(error.message || 'Failed to download report')
    },
  })

  // Use report data from API
  const summary = reportData?.summary
  const candidates = reportData?.candidates || []
  const needsReview = reportData?.needs_review || []
  const excluded = reportData?.excluded || []

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    // `new Date('2024-07-01')` is parsed as UTC midnight, which renders as the
    // previous day anywhere west of Greenwich. Parse date-only strings as local.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString ?? '')
    const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString ?? ''
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.80) return { label: 'High',   color: 'bg-gradient-brand' }
    if (confidence >= 0.60) return { label: 'Medium', color: 'bg-accent/70' }
    return { label: 'Low', color: 'bg-slate-600' }
  }

  // Confidence buckets only cover candidates + needs-review, so they are the
  // right denominator for the distribution chart but not for "total analysed".
  const classifiedTransactions = (summary?.confidenceDistribution?.high ?? 0) +
                                 (summary?.confidenceDistribution?.medium ?? 0) +
                                 (summary?.confidenceDistribution?.low ?? 0)
  const totalTransactions = candidates.length + needsReview.length + excluded.length
  // Category totals include needs-review items too, so compare bars against their own sum.
  const categoryGrandTotal = Object.values((summary?.categoryTotals ?? {}) as Record<string, number>)
    .reduce((acc, v) => acc + (Number(v) || 0), 0)
  
  // Helper to safely calculate percentage for charts
  const safePercentage = (value: number, total: number) => {
    if (!total || total === 0) return 0
    return Math.min(100, Math.max(0, (value / total) * 100))
  }

  const handleDownload = async (format: 'pdf' | 'csv' | 'json') => {
    if (!jobId) return
    
    setDownloadError(null)

    try {
      await downloadMutation.mutateAsync({
        jobId,
        format,
        filename: `deduction_report_${reportData?.income_year || 'report'}.${format}`,
      })
    } catch (err) {
      // Error handled by onError callback
      console.error('Download error:', err)
    }
  }

  // Show loading while fetching job status or report data (skip if we have data from state)
  const isLoadingReport = !stateReportData && (isLoading || (jobStatus?.status === 'completed' && !reportData && !reportError))

  return (
    <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] pb-[96px] lg:pb-[140px]">
      {/* Loading State */}
      {isLoadingReport && (
        <div className="flex items-center justify-center pt-[200px] pb-[120px]" role="status" aria-live="polite">
          <div className="text-center">
            <Icon name="Loader2" size={48} className="text-accent mx-auto mb-4 animate-spin" />
            <p className="text-body text-slate-300">Loading report...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {(jobError || reportError) && (
        <div className="max-w-2xl mx-auto pt-[160px]" role="alert" aria-live="assertive">
          <Card>
            <div className="text-center py-8">
              <Icon name="AlertCircle" size={64} className="text-red-400 mx-auto mb-4" />
              <h2 className="font-display text-[36px] leading-[1.05] tracking-[-0.02em] text-bone mb-[12px]">
                Failed to load report
              </h2>
              <p className="text-body text-slate-300 mb-6">
                {jobError?.message || reportError || 'An error occurred while loading the report.'}
              </p>
              <Button variant="primary" onClick={() => navigate('/upload')}>
                Upload New File
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Processing State - only show if we don't have report data from state */}
      {!stateReportData && jobStatus && (jobStatus.status === 'queued' || jobStatus.status === 'processing') && (
        <div className="max-w-2xl mx-auto pt-[160px]" role="status" aria-live="polite">
          <Card>
            <div className="text-center py-8">
              <Icon name="Loader2" size={48} className="text-accent mx-auto mb-4 animate-spin" />
              <h2 className="font-display text-[36px] leading-[1.05] tracking-[-0.02em] text-bone mb-[12px]">
                Processing your file
              </h2>
              <p className="text-body text-slate-300 mb-4">
                Analysing transactions and generating report...
              </p>
              {jobStatus.progress !== undefined && (
                <div className="max-w-md mx-auto">
                  <div className="flex justify-between text-small text-slate-300 mb-2">
                    <span>Progress</span>
                    <span>{jobStatus.progress}%</span>
                  </div>
                  <div 
                    className="w-full h-2 bg-ink-800 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={jobStatus.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Processing progress: ${jobStatus.progress}%`}
                  >
                    <div
                      className="h-full bg-gradient-brand transition-all duration-300"
                      style={{ width: `${jobStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Failed State - only show if we don't have report data from state */}
      {!stateReportData && jobStatus && jobStatus.status === 'failed' && (
        <div className="max-w-2xl mx-auto pt-[160px]" role="alert" aria-live="assertive">
          <Card>
            <div className="text-center py-8">
              <Icon name="AlertCircle" size={64} className="text-red-400 mx-auto mb-4" />
              <h2 className="font-display text-[36px] leading-[1.05] tracking-[-0.02em] text-bone mb-[12px]">
                Processing failed
              </h2>
              <p className="text-body text-slate-300 mb-6">
                {jobStatus.error || 'An error occurred while processing your file.'}
              </p>
              <Button variant="primary" onClick={() => navigate('/upload')}>
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Report Content - Show when we have report data (from state or fetched) */}
      {reportData && summary && (
      <div>
      {/* Header */}
      <div>
        <PageHeader
          index="02"
          label="Step 2 of 2 · Report"
          title="Deduction Report"
          lead={
            <>
              Income year {reportData.income_year}
              {reportData.generated_at && (
                <span className="text-bone-600"> · Generated {new Date(reportData.generated_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              )}
            </>
          }
          aside={
            <Button variant="secondary" onClick={() => navigate('/upload')}>
              New Analysis
            </Button>
          }
        />

          {/* Export buttons: only when files exist on the server (not in ephemeral mode) */}
          {!stateReportData && jobId && (
          <div className="mt-[-16px] mb-[32px] flex flex-wrap items-center gap-[10px]">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400 mr-[6px]">Download</span>
            {(['pdf', 'csv', 'json'] as const).map((fmt) => (
              <Button
                key={fmt}
                variant="secondary"
                size="sm"
                onClick={() => handleDownload(fmt)}
                disabled={downloadMutation.isPending}
              >
                {downloadMutation.isPending && downloadMutation.variables?.format === fmt
                  ? 'Downloading...'
                  : `Download ${fmt.toUpperCase()}`}
              </Button>
            ))}
          </div>
          )}

          {/* Ephemeral mode: no stored copy, so offer print-to-PDF */}
          {stateReportData && (
            <div className="mt-[-16px] mb-[32px] flex flex-col sm:flex-row sm:items-center justify-between gap-[12px] border-b border-bone/[0.09] pb-[20px] no-print">
              <p className="flex flex-col sm:flex-row sm:items-center gap-[6px] sm:gap-[12px] text-[14px] text-bone-400">
                <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-brass">Not stored</span>
                No copy is kept on our side. Save this report before leaving.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="shrink-0 print-keep"
              >
                Save as PDF
              </Button>
            </div>
          )}

          {/* Download Error */}
          {downloadError && (
            <div role="alert" className="mb-[32px] border-l-2 border-red-400 bg-red-400/[0.06] px-[16px] py-[12px]">
              <p className="text-[14px] text-red-400">{downloadError}</p>
            </div>
          )}
        </div>

        {/* Summary: one ledger strip instead of four boxes */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 border-y border-bone/[0.12] mb-[48px]">
          {[
            { label: 'LIKELY DEDUCTIBLE', value: formatCurrency(summary.totalDeductible), note: plural(candidates.length, 'transaction'), tone: 'text-brass' },
            { label: 'NEEDS REVIEW', value: formatCurrency(summary.totalNeedsReview), note: plural(needsReview.length, 'transaction'), tone: 'text-bone' },
            { label: 'EXCLUDED', value: formatCurrency(summary.totalExcluded), note: 'Not deduction candidates', tone: 'text-bone-400' },
            { label: 'TOTAL ANALYSED', value: String(totalTransactions), note: 'Transactions processed', tone: 'text-bone' },
          ].map((cell, i) => (
            <div
              key={cell.label}
              className={[
                'py-[24px] sm:py-[28px] pr-[12px] border-bone/[0.12]',
                i % 2 === 1 ? 'pl-[16px] sm:pl-[24px] border-l' : '',
                i >= 2 ? 'border-t lg:border-t-0' : '',
                i === 2 ? 'lg:pl-[24px] lg:border-l' : '',
              ].join(' ')}
            >
              <dt className="font-mono text-[10px] sm:text-[10.5px] uppercase tracking-[0.16em] text-bone-400">{cell.label}</dt>
              <dd className={`mt-[14px] font-display text-[30px] sm:text-[44px] leading-none tracking-[-0.03em] tabular-nums ${cell.tone}`}>
                {cell.value}
              </dd>
              <dd className="mt-[10px] text-[13px] text-bone-400">{cell.note}</dd>
            </div>
          ))}
        </dl>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Confidence Distribution Chart */}
          <Card padding="none" className="p-[20px] sm:p-[36px]">
            <h3 className="font-display text-[26px] leading-none tracking-[-0.02em] text-bone mb-[28px]">
              Confidence Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>High (80–100%)</span>
                  <span>{plural(summary.confidenceDistribution.high, 'transaction')}</span>
                </div>
                <div className="w-full h-[10px] bg-bone/[0.06] rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-gradient-brand"
                    style={{
                      width: `${safePercentage(summary.confidenceDistribution.high, classifiedTransactions)}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>Medium (60–79%)</span>
                  <span>{plural(summary.confidenceDistribution.medium, 'transaction')}</span>
                </div>
                <div className="w-full h-[10px] bg-bone/[0.06] rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-brass/50"
                    style={{
                      width: `${safePercentage(summary.confidenceDistribution.medium, classifiedTransactions)}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>Low (below 60%)</span>
                  <span>{plural(summary.confidenceDistribution.low, 'transaction')}</span>
                </div>
                <div className="w-full h-[10px] bg-bone/[0.06] rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-slate-600"
                    style={{
                      width: `${safePercentage(summary.confidenceDistribution.low, classifiedTransactions)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Category Totals Chart */}
          <Card padding="none" className="p-[20px] sm:p-[36px]">
            <h3 className="font-display text-[26px] leading-none tracking-[-0.02em] text-bone mb-[28px]">
              Category Totals
            </h3>
            <p className="-mt-[16px] mb-[24px] text-[13px] text-bone-600">Candidates and needs-review items</p>
            <div className="space-y-3">
              {summary.categoryTotals && Object.entries(summary.categoryTotals)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([category, amount]) => (
                  <div key={category}>
                    <div className="flex justify-between text-small text-slate-300 mb-1">
                      <span>{CATEGORY_LABELS[category] ?? category}</span>
                      <span className="font-medium">{formatCurrency(amount as number)}</span>
                    </div>
                    <div className="w-full h-[4px] bg-bone/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-gradient-brand"
                        style={{
                          width: `${safePercentage(amount as number, categoryGrandTotal)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        {/* Placeholder for tabs and table - will be implemented in next subtask */}
        <Card padding="none" className="p-[20px] sm:p-[36px]">
          {/* Tabs */}
          <div className="border-b border-bone/[0.12] mb-[28px]" role="tablist" aria-label="Report sections">
            <div className="flex gap-[28px] overflow-x-auto">
              <button
                onClick={() => { setActiveTab('candidates'); setCategoryFilter(null) }}
                role="tab"
                id="candidates-tab"
                aria-selected={activeTab === 'candidates'}
                aria-controls="candidates-panel"
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeTab === 'candidates' 
                    ? 'text-bone' 
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Candidates ({candidates.length})
                {activeTab === 'candidates' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('needs-review'); setCategoryFilter(null) }}
                role="tab"
                id="needs-review-tab"
                aria-selected={activeTab === 'needs-review'}
                aria-controls="needs-review-panel"
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeTab === 'needs-review' 
                    ? 'text-bone' 
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Needs Review ({needsReview.length})
                {activeTab === 'needs-review' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('excluded'); setCategoryFilter(null) }}
                role="tab"
                id="excluded-tab"
                aria-selected={activeTab === 'excluded'}
                aria-controls="excluded-panel"
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeTab === 'excluded' 
                    ? 'text-bone' 
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Excluded ({excluded.length})
                {activeTab === 'excluded' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('audit'); setCategoryFilter(null) }}
                role="tab"
                id="audit-tab"
                aria-selected={activeTab === 'audit'}
                aria-controls="audit-panel"
                className={`
                  pb-[14px] font-mono text-[11px] uppercase tracking-[0.14em] transition-colors relative whitespace-nowrap
                  ${activeTab === 'audit' 
                    ? 'text-bone' 
                    : 'text-bone-600 hover:text-bone-200'
                  }
                `}
              >
                Audit Trail
                {activeTab === 'audit' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brass" />
                )}
              </button>
            </div>
          </div>

          {/* Candidates Table */}
          {activeTab === 'candidates' && (() => {
            const candidateCategories = [...new Set(candidates.map((t: any) => t.category).filter(Boolean))] as string[]
            const filtered = categoryFilter ? candidates.filter((t: any) => t.category === categoryFilter) : candidates
            return (
              <div role="tabpanel" id="candidates-panel" aria-labelledby="candidates-tab">
                {/* Category filter chips */}
                {candidateCategories.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1">
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className={`px-[12px] h-[30px] inline-flex items-center rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors whitespace-nowrap ${!categoryFilter ? 'bg-bone text-ink-950' : 'text-bone-400 hover:text-bone border border-bone/[0.14]'}`}
                    >
                      All ({candidates.length})
                    </button>
                    {candidateCategories.map((cat: string) => {
                      const count = candidates.filter((t: any) => t.category === cat).length
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                          className={`px-[12px] h-[30px] inline-flex items-center rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors whitespace-nowrap ${categoryFilter === cat ? 'bg-bone text-ink-950' : 'text-bone-400 hover:text-bone border border-bone/[0.14]'}`}
                        >
                          {CATEGORY_LABELS[cat] ?? cat} ({count})
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full" aria-label="Deduction candidates">
                    <thead>
                      <tr className="text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-bone-600 border-b border-bone/[0.12]">
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px]">DATE</th>
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px]">MERCHANT</th>
                        <th className="hidden sm:table-cell pb-[12px] pr-[12px] sm:pr-[24px]">DESCRIPTION</th>
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px] text-right">AMOUNT</th>
                        <th className="hidden md:table-cell pb-[12px] pr-[12px] sm:pr-[24px]">CATEGORY</th>
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px]">CONFIDENCE</th>
                        <th className="hidden lg:table-cell pb-[12px]">EVIDENCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((transaction: any) => {
                        const confidenceInfo = getConfidenceLabel(transaction.confidence)
                        const display = resolveDisplay(transaction)
                        return (
                          <tr
                            key={transaction.id}
                            onClick={() => setSelectedTransaction(transaction.id)}
                            className={`border-b border-line-700 cursor-pointer transition-colors ${selectedTransaction === transaction.id ? 'bg-ink-800' : 'hover:bg-ink-800'}`}
                          >
                            <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[12px] tabular-nums whitespace-nowrap text-slate-300">{formatDate(transaction.date)}</td>
                            <td className="py-[14px] pr-[12px] sm:pr-[24px] text-small text-bone max-w-[180px] truncate" title={transaction.merchant}>{display.merchant}</td>
                            <td className="hidden sm:table-cell py-[14px] pr-[12px] sm:pr-[24px] text-small text-slate-300 max-w-xs truncate">{display.description}</td>
                            <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[13px] tabular-nums whitespace-nowrap text-bone text-right">{formatCurrency(transaction.amount)}</td>
                            <td className="hidden md:table-cell py-[14px] pr-[12px] sm:pr-[24px]">
                              <Chip label={CATEGORY_LABELS[transaction.category] ?? transaction.category} variant="category" size="sm" className="whitespace-nowrap" />
                            </td>
                            <td className="py-[14px] pr-[12px] sm:pr-[24px]">
                              <div className="flex items-center space-x-2">
                                <span className="text-micro text-slate-300">{confidenceInfo.label}</span>
                                <div className="hidden sm:block w-[64px] h-[3px] bg-bone/[0.08] overflow-hidden">
                                  <div className={`h-full ${confidenceInfo.color}`} style={{ width: `${transaction.confidence * 100}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="hidden lg:table-cell py-[14px]">
                              <div className="flex flex-wrap gap-1">
                                {transaction.evidence && transaction.evidence.map((ev: string, idx: number) => (
                                  <Chip key={idx} label={ev} variant="category" size="sm" />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Needs Review Table */}
          {activeTab === 'needs-review' && (() => {
            const reviewCategories = [...new Set(needsReview.map((t: any) => t.category).filter(Boolean))] as string[]
            const filtered = categoryFilter ? needsReview.filter((t: any) => t.category === categoryFilter) : needsReview
            return (
              <div role="tabpanel" id="needs-review-panel" aria-labelledby="needs-review-tab">
                {reviewCategories.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1">
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className={`px-[12px] h-[30px] inline-flex items-center rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors whitespace-nowrap ${!categoryFilter ? 'bg-bone text-ink-950' : 'text-bone-400 hover:text-bone border border-bone/[0.14]'}`}
                    >
                      All ({needsReview.length})
                    </button>
                    {reviewCategories.map((cat: string) => {
                      const count = needsReview.filter((t: any) => t.category === cat).length
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                          className={`px-[12px] h-[30px] inline-flex items-center rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors whitespace-nowrap ${categoryFilter === cat ? 'bg-bone text-ink-950' : 'text-bone-400 hover:text-bone border border-bone/[0.14]'}`}
                        >
                          {CATEGORY_LABELS[cat] ?? cat} ({count})
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full" aria-label="Transactions needing review">
                    <thead>
                      <tr className="text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-bone-600 border-b border-bone/[0.12]">
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px]">DATE</th>
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px]">MERCHANT</th>
                        <th className="hidden sm:table-cell pb-[12px] pr-[12px] sm:pr-[24px]">DESCRIPTION</th>
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px] text-right">AMOUNT</th>
                        <th className="pb-[12px] pr-[12px] sm:pr-[24px]">CONFIDENCE</th>
                        <th className="hidden md:table-cell pb-[12px]">WHY FLAGGED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((transaction: any) => {
                        const confidenceInfo = getConfidenceLabel(transaction.confidence)
                        const display = resolveDisplay(transaction)
                        return (
                          <tr
                            key={transaction.id}
                            onClick={() => setSelectedTransaction(transaction.id)}
                            className={`border-b border-line-700 cursor-pointer transition-colors ${selectedTransaction === transaction.id ? 'bg-ink-800' : 'hover:bg-ink-800'}`}
                          >
                            <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[12px] tabular-nums whitespace-nowrap text-slate-300">{formatDate(transaction.date)}</td>
                            <td className="py-[14px] pr-[12px] sm:pr-[24px] text-small text-bone max-w-[180px] truncate" title={transaction.merchant}>{display.merchant}</td>
                            <td className="hidden sm:table-cell py-[14px] pr-[12px] sm:pr-[24px] text-small text-slate-300 max-w-xs truncate">{display.description}</td>
                            <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[13px] tabular-nums whitespace-nowrap text-bone text-right">{formatCurrency(transaction.amount)}</td>
                            <td className="py-[14px] pr-[12px] sm:pr-[24px]">
                              <div className="flex items-center space-x-2">
                                <span className="text-micro text-slate-300">{confidenceInfo.label}</span>
                                <div className="hidden sm:block w-[64px] h-[3px] bg-bone/[0.08] overflow-hidden">
                                  <div className={`h-full ${confidenceInfo.color}`} style={{ width: `${transaction.confidence * 100}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="hidden md:table-cell py-[14px] text-small text-slate-300">{formatReason(transaction.reason)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Excluded Table */}
          {activeTab === 'excluded' && (
            <div 
              role="tabpanel" 
              id="excluded-panel" 
              aria-labelledby="excluded-tab"
              className="overflow-x-auto"
            >
              <table className="w-full" aria-label="Excluded transactions">
                <thead>
                  <tr className="text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-bone-600 border-b border-bone/[0.12]">
                    <th className="pb-[12px] pr-[12px] sm:pr-[24px]">DATE</th>
                    <th className="pb-[12px] pr-[12px] sm:pr-[24px]">MERCHANT</th>
                    <th className="hidden sm:table-cell pb-[12px] pr-[12px] sm:pr-[24px]">DESCRIPTION</th>
                    <th className="pb-[12px] pr-[12px] sm:pr-[24px] text-right">AMOUNT</th>
                    <th className="pb-[12px]">REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {excluded.map((transaction: any) => {
                    const display = resolveDisplay(transaction)
                    return (
                    <tr
                      key={transaction.id}
                      className="border-b border-line-700"
                    >
                      <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[12px] tabular-nums whitespace-nowrap text-slate-500">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="py-[14px] pr-[12px] sm:pr-[24px] text-small text-slate-500 max-w-[180px] truncate" title={transaction.merchant}>
                        {display.merchant}
                      </td>
                      <td className="hidden sm:table-cell py-[14px] pr-[12px] sm:pr-[24px] text-small text-slate-500 max-w-xs truncate">
                        {display.description}
                      </td>
                      <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[13px] tabular-nums whitespace-nowrap text-slate-500 text-right">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="py-[14px] text-small text-slate-300">
                        {transaction.explanation}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit Trail — full transaction log */}
          {activeTab === 'audit' && (() => {
            const allRows = [
              ...candidates.map((t: any) => ({ ...t, _decision: 'candidate' })),
              ...needsReview.map((t: any) => ({ ...t, _decision: 'needs_review' })),
              ...excluded.map((t: any) => ({ ...t, _decision: 'excluded' })),
            ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            return (
              <div role="tabpanel" id="audit-panel" aria-labelledby="audit-tab" className="overflow-x-auto">
                <p className="text-small text-slate-500 mb-4">
                  Every transaction analysed — showing the final decision and reason for each.
                </p>
                <table className="w-full" aria-label="Full audit trail">
                  <thead>
                    <tr className="text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-bone-600 border-b border-bone/[0.12]">
                      <th className="pb-[12px] pr-[12px] sm:pr-[24px]">DATE</th>
                      <th className="pb-[12px] pr-[12px] sm:pr-[24px]">MERCHANT</th>
                      <th className="pb-[12px] pr-[12px] sm:pr-[24px] text-right">AMOUNT</th>
                      <th className="pb-[12px] pr-[12px] sm:pr-[24px]">DECISION</th>
                      <th className="hidden md:table-cell pb-[12px] pr-[12px] sm:pr-[24px]">CATEGORY / REASON</th>
                      <th className="pb-[12px]">CONFIDENCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((t: any) => (
                      <tr key={t.id} className="border-b border-line-700">
                        <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[12px] tabular-nums whitespace-nowrap text-slate-300">{formatDate(t.date)}</td>
                        <td className="py-[14px] pr-[12px] sm:pr-[24px] text-small text-bone max-w-[160px] truncate" title={t.merchant}>{t.merchant}</td>
                        <td className="py-[14px] pr-[12px] sm:pr-[24px] font-mono text-[13px] tabular-nums whitespace-nowrap text-bone text-right">{formatCurrency(t.amount)}</td>
                        <td className="py-[14px] pr-[12px] sm:pr-[24px]">
                          {t._decision === 'candidate' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-400 border border-green-800/40">Candidate</span>
                          )}
                          {t._decision === 'needs_review' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400 border border-amber-800/40">Needs Review</span>
                          )}
                          {t._decision === 'excluded' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ink-800 text-slate-500 border border-line-700">Excluded</span>
                          )}
                        </td>
                        <td className="hidden md:table-cell py-[14px] pr-[12px] sm:pr-[24px] text-small text-slate-400 max-w-xs truncate">
                          {t._decision === 'excluded'
                            ? (t.explanation ?? t.reason ?? '')
                            : (t.category ? `${CATEGORY_LABELS[t.category] ?? t.category} · ${formatReason(t.reason)}` : formatReason(t.reason))}
                        </td>
                        <td className="py-[14px] text-small text-slate-400">
                          {t.confidence != null ? `${Math.round(t.confidence * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </Card>

        {/* Transaction Detail Drawer */}
        <Drawer
          isOpen={selectedTransaction !== null}
          onClose={() => setSelectedTransaction(null)}
          title="Transaction Details"
        >
          {selectedTransaction && (
            <TransactionDetail
              transaction={[...candidates, ...needsReview].find(t => t.id === selectedTransaction) ?? null}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              getConfidenceLabel={getConfidenceLabel}
            />
          )}
        </Drawer>
      </div>
      )}
    </div>
  )
}

// Sub-component so useState is always called at component level (not inside an IIFE)
function TransactionDetail({ transaction, formatDate, formatCurrency, getConfidenceLabel }: {
  transaction: any
  formatDate: (d: string) => string
  formatCurrency: (n: number) => string
  getConfidenceLabel: (c: number) => { label: string; color: string }
}) {
  const [showMoreDetail, setShowMoreDetail] = useState(false)

  if (!transaction) return null

  const confidenceInfo = getConfidenceLabel(transaction.confidence)
  const display = resolveDisplay(transaction)

  return (
    <div className="space-y-6">
      {/* Transaction Summary */}
      <div className="space-y-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-1">
            MERCHANT
          </div>
          <div className="font-display text-[30px] leading-[1.05] tracking-[-0.02em] text-bone">
            {display.merchant}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-1">
            DESCRIPTION
          </div>
          <div className="text-small text-slate-300">
            {display.description}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-1">
              DATE
            </div>
            <div className="text-small text-bone">
              {formatDate(transaction.date)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-1">
              AMOUNT
            </div>
            <div className="text-small text-bone">
              {formatCurrency(transaction.amount)}
            </div>
          </div>
        </div>
      </div>

      {/* Category and Confidence */}
      <div className="border-t border-line-700 pt-6 space-y-4">
        {transaction.category && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
              CATEGORY
            </div>
            <Chip label={CATEGORY_LABELS[transaction.category] ?? transaction.category} variant="category" size="md" />
          </div>
        )}

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
            CONFIDENCE
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-small text-bone">
              {confidenceInfo.label} ({(transaction.confidence * 100).toFixed(0)}%)
            </span>
            <div className="flex-1 h-[4px] bg-bone/[0.08] overflow-hidden">
              <div
                className={`h-full ${confidenceInfo.color}`}
                style={{ width: `${transaction.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Matched Rule and Reason */}
      <div className="border-t border-line-700 pt-6 space-y-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-2">
            CLASSIFICATION REASON
          </div>
          <div className="text-small text-slate-300">
            {formatReason(transaction.reason)}
          </div>
        </div>
      </div>

      {/* Evidence Checklist */}
      {transaction.evidence && transaction.evidence.length > 0 && (
        <div className="border-t border-line-700 pt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-3">
            EVIDENCE REQUIRED
          </div>
          <div className="space-y-2">
            {transaction.evidence.map((evidence: string, idx: number) => (
              <div key={idx} className="flex items-start space-x-2">
                <div className="w-[18px] h-[18px] rounded-[3px] border border-bone/25 flex items-center justify-center mt-[2px] shrink-0">
                  <Icon name="Check" size={12} className="text-slate-500" />
                </div>
                <div className="text-small text-slate-300">
                  {evidence}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {transaction.flags && transaction.flags.filter((f: string) => FLAG_INFO[f]).length > 0 && (
        <div className="border-t border-line-700 pt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 mb-3">
            WHAT YOU NEED TO DO
          </div>
          <div className="space-y-3">
            {transaction.flags.filter((f: string) => FLAG_INFO[f]).map((flag: string, idx: number) => {
              const info = FLAG_INFO[flag]
              return (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-[20px] h-[20px] rounded-full flex items-center justify-center mt-[1px] shrink-0 ${info.color === 'green' ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                    <Icon name={info.color === 'green' ? 'Check' : 'AlertTriangle'} size={11} className={info.color === 'green' ? 'text-green-400' : 'text-amber-400'} />
                  </div>
                  <div>
                    <div className="text-small text-bone font-medium">{info.label}</div>
                    <div className="text-micro text-slate-400 mt-0.5 leading-relaxed">{info.description}</div>
                    {info.action && (
                      <div className="text-micro text-amber-400 mt-1">{info.action}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* More Detail Expansion */}
      <div className="border-t border-line-700 pt-6">
        <button
          onClick={() => setShowMoreDetail(!showMoreDetail)}
          className="flex items-center justify-between w-full text-small font-medium text-bone hover:text-accent transition-colors"
        >
          <span>More detail</span>
          <Icon
            name="ChevronDown"
            size={20}
            className={`transition-transform ${showMoreDetail ? 'rotate-180' : ''}`}
          />
        </button>

        {showMoreDetail && (
          <div className="mt-4 space-y-4 text-small text-slate-300">
            <div>
              <div className="font-medium text-bone mb-1">About this classification</div>
              <p>
                This transaction was classified using keyword matching, merchant recognition,
                and ATO-grounded deduction rules for Australian taxpayers.
              </p>
            </div>

            <div>
              <div className="font-medium text-bone mb-1">What you need to do</div>
              <p>
                Review this classification and confirm it applies to your situation. Keep the
                evidence listed above. Deductibility may depend on your occupation — consult a
                registered tax agent if unsure.
              </p>
            </div>

            <div>
              <div className="font-medium text-bone mb-1">Record retention</div>
              <p>
                Keep records for 5 years from the date you lodge your tax return. The ATO may
                request evidence at any time during that period.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
