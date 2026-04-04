import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Card, Button, Chip, Drawer, Icon } from '../components'
import { useJobStatus, useDownloadReportFile } from '../api/hooks'
import { downloadReport } from '../api/client'

export default function Report() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'candidates' | 'needs-review' | 'excluded' | 'audit'>('candidates')
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  
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
    const date = new Date(dateString)
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

  const totalTransactions = (summary?.confidenceDistribution?.high ?? 0) + 
                           (summary?.confidenceDistribution?.medium ?? 0) + 
                           (summary?.confidenceDistribution?.low ?? 0)
  
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
    <div className="pt-20 sm:pt-24 container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Loading State */}
      {isLoadingReport && (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <div className="text-center">
            <Icon name="Loader2" size={48} className="text-accent mx-auto mb-4 animate-spin" />
            <p className="text-body text-slate-300">Loading report...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {(jobError || reportError) && (
        <div className="max-w-2xl mx-auto" role="alert" aria-live="assertive">
          <Card>
            <div className="text-center py-8">
              <Icon name="AlertCircle" size={64} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-h2 font-semibold text-white mb-2">
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
        <div className="max-w-2xl mx-auto" role="status" aria-live="polite">
          <Card>
            <div className="text-center py-8">
              <Icon name="Loader2" size={48} className="text-accent mx-auto mb-4 animate-spin" />
              <h2 className="text-h2 font-semibold text-white mb-2">
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
        <div className="max-w-2xl mx-auto" role="alert" aria-live="assertive">
          <Card>
            <div className="text-center py-8">
              <Icon name="AlertCircle" size={64} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-h2 font-semibold text-white mb-2">
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-h1 font-semibold text-white mb-2">
              Deduction Report
            </h1>
            <p className="text-body text-slate-300">
              Income Year: {reportData.income_year} (1 July {reportData.income_year.split('-')[0]} to 30 June {reportData.income_year.split('-')[1]})
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="tertiary"
              onClick={() => navigate('/upload')}
            >
              New Analysis
            </Button>
          </div>
        </div>

          {/* Export Buttons - Only show if files exist (not in ephemeral mode) */}
          {!stateReportData && jobId && (
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={() => handleDownload('pdf')}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending && downloadMutation.variables?.format === 'pdf' ? (
                <span className="flex items-center space-x-2">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  <span>Downloading...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <Icon name="Download" size={16} />
                  <span>Download PDF</span>
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload('csv')}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending && downloadMutation.variables?.format === 'csv' ? (
                <span className="flex items-center space-x-2">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  <span>Downloading...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <Icon name="Download" size={16} />
                  <span>Download CSV</span>
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload('json')}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending && downloadMutation.variables?.format === 'json' ? (
                <span className="flex items-center space-x-2">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  <span>Downloading...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <Icon name="Download" size={16} />
                  <span>Download JSON</span>
                </span>
              )}
            </Button>
          </div>
          )}
          
          {/* Ephemeral Mode Notice */}
          {stateReportData && (
            <div className="mt-3 p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <div className="flex items-start space-x-2">
                <Icon name="Info" size={20} className="text-accent mt-0.5" />
                <div className="text-small text-slate-300">
                  Report generated in ephemeral mode - data is not stored and downloads are not available. You can view and analyze the report on this page.
                </div>
              </div>
            </div>
          )}

          {/* Download Error */}
          {downloadError && (
            <div className="mt-3 p-3 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg">
              <div className="flex items-start space-x-2">
                <Icon name="AlertCircle" size={20} className="text-red-400 mt-0.5" />
                <div className="text-small text-red-300">
                  {downloadError}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <div className="space-y-2">
              <div className="font-mono text-micro font-medium text-slate-500">
                LIKELY DEDUCTIBLE
              </div>
              <div className="font-mono text-h1 font-semibold text-white">
                {formatCurrency(summary.totalDeductible)}
              </div>
              <div className="text-small text-slate-300">
                {summary.confidenceDistribution.high + summary.confidenceDistribution.medium} transactions
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="font-mono text-micro font-medium text-slate-500">
                NEEDS REVIEW
              </div>
              <div className="font-mono text-h1 font-semibold text-slate-300">
                {formatCurrency(summary.totalNeedsReview)}
              </div>
              <div className="text-small text-slate-300">
                {summary.confidenceDistribution.low} transactions
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="font-mono text-micro font-medium text-slate-500">
                EXCLUDED
              </div>
              <div className="font-mono text-h1 font-semibold text-slate-500">
                {formatCurrency(summary.totalExcluded)}
              </div>
              <div className="text-small text-slate-300">
                Not deduction candidates
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="font-mono text-micro font-medium text-slate-500">
                TOTAL ANALYSED
              </div>
              <div className="font-mono text-h1 font-semibold text-white">
                {totalTransactions}
              </div>
              <div className="text-small text-slate-300">
                Transactions processed
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Confidence Distribution Chart */}
          <Card>
            <h3 className="text-h3 font-semibold text-white mb-6">
              Confidence Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>High (0.80–1.00)</span>
                  <span>{summary.confidenceDistribution.high} transactions</span>
                </div>
                <div className="w-full h-8 bg-ink-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{ 
                      width: `${safePercentage(summary.confidenceDistribution.high, totalTransactions)}%` 
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>Medium (0.60–0.79)</span>
                  <span>{summary.confidenceDistribution.medium} transactions</span>
                </div>
                <div className="w-full h-8 bg-ink-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-slate-500"
                    style={{ 
                      width: `${safePercentage(summary.confidenceDistribution.medium, totalTransactions)}%` 
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>Low (&lt; 0.60)</span>
                  <span>{summary.confidenceDistribution.low} transactions</span>
                </div>
                <div className="w-full h-8 bg-ink-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-slate-700"
                    style={{ 
                      width: `${safePercentage(summary.confidenceDistribution.low, totalTransactions)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Category Totals Chart */}
          <Card>
            <h3 className="text-h3 font-semibold text-white mb-6">
              Category Totals
            </h3>
            <div className="space-y-3">
              {summary.categoryTotals && Object.entries(summary.categoryTotals)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([category, amount]) => (
                  <div key={category}>
                    <div className="flex justify-between text-small text-slate-300 mb-1">
                      <span>{category}</span>
                      <span className="font-medium">{formatCurrency(amount as number)}</span>
                    </div>
                    <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white"
                        style={{ 
                          width: `${safePercentage(amount as number, summary.totalDeductible)}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        {/* Placeholder for tabs and table - will be implemented in next subtask */}
        <Card>
          {/* Tabs */}
          <div className="border-b border-line-700 mb-6" role="tablist" aria-label="Report sections">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('candidates')}
                role="tab"
                aria-selected={activeTab === 'candidates'}
                aria-controls="candidates-panel"
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeTab === 'candidates' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Candidates ({candidates.length})
                {activeTab === 'candidates' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('needs-review')}
                role="tab"
                aria-selected={activeTab === 'needs-review'}
                aria-controls="needs-review-panel"
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeTab === 'needs-review' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Needs Review ({needsReview.length})
                {activeTab === 'needs-review' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('excluded')}
                role="tab"
                aria-selected={activeTab === 'excluded'}
                aria-controls="excluded-panel"
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeTab === 'excluded' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Excluded ({excluded.length})
                {activeTab === 'excluded' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                role="tab"
                aria-selected={activeTab === 'audit'}
                aria-controls="audit-panel"
                className={`
                  pb-4 text-small font-medium transition-colors relative
                  ${activeTab === 'audit' 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                Audit Trail
                {activeTab === 'audit' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            </div>
          </div>

          {/* Candidates Table */}
          {activeTab === 'candidates' && (
            <div 
              role="tabpanel" 
              id="candidates-panel" 
              aria-labelledby="candidates-tab"
              className="overflow-x-auto"
            >
              <table className="w-full min-w-[640px]" aria-label="Deduction candidates">
                <thead>
                  <tr className="text-left text-micro font-medium text-slate-500 border-b border-line-700">
                    <th className="pb-3 pr-4">DATE</th>
                    <th className="pb-3 pr-4">MERCHANT</th>
                    <th className="pb-3 pr-4">DESCRIPTION</th>
                    <th className="pb-3 pr-4 text-right">AMOUNT</th>
                    <th className="pb-3 pr-4">CATEGORY</th>
                    <th className="pb-3 pr-4">CONFIDENCE</th>
                    <th className="pb-3">EVIDENCE</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((transaction) => {
                    const confidenceInfo = getConfidenceLabel(transaction.confidence)
                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction.id)}
                        className={`
                          border-b border-line-700 cursor-pointer transition-colors
                          ${selectedTransaction === transaction.id 
                            ? 'bg-ink-800' 
                            : 'hover:bg-ink-800'
                          }
                        `}
                      >
                        <td className="py-4 pr-4 text-small text-slate-300">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="py-4 pr-4 text-small text-white">
                          {transaction.merchant}
                        </td>
                        <td className="py-4 pr-4 text-small text-slate-300 max-w-xs truncate">
                          {transaction.description}
                        </td>
                        <td className="py-4 pr-4 text-small text-white text-right">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="py-4 pr-4">
                          <Chip label={transaction.category} variant="category" size="sm" />
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-micro text-slate-300">
                              {confidenceInfo.label}
                            </span>
                            <div className="w-16 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${confidenceInfo.color}`}
                                style={{ width: `${transaction.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {transaction.evidence && transaction.evidence.map((ev, idx) => (
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
          )}

          {/* Needs Review Table */}
          {activeTab === 'needs-review' && (
            <div 
              role="tabpanel" 
              id="needs-review-panel" 
              aria-labelledby="needs-review-tab"
              className="overflow-x-auto"
            >
              <table className="w-full" aria-label="Transactions needing review">
                <thead>
                  <tr className="text-left text-micro font-medium text-slate-500 border-b border-line-700">
                    <th className="pb-3 pr-4">DATE</th>
                    <th className="pb-3 pr-4">MERCHANT</th>
                    <th className="pb-3 pr-4">DESCRIPTION</th>
                    <th className="pb-3 pr-4 text-right">AMOUNT</th>
                    <th className="pb-3 pr-4">CONFIDENCE</th>
                    <th className="pb-3">REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {needsReview.map((transaction) => {
                    const confidenceInfo = getConfidenceLabel(transaction.confidence)
                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction.id)}
                        className={`
                          border-b border-line-700 cursor-pointer transition-colors
                          ${selectedTransaction === transaction.id 
                            ? 'bg-ink-800' 
                            : 'hover:bg-ink-800'
                          }
                        `}
                      >
                        <td className="py-4 pr-4 text-small text-slate-300">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="py-4 pr-4 text-small text-white max-w-[180px] truncate" title={transaction.merchant}>
                          {transaction.merchant}
                        </td>
                        <td className="py-4 pr-4 text-small text-slate-300 max-w-xs truncate">
                          {transaction.description}
                        </td>
                        <td className="py-4 pr-4 text-small text-white text-right">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-micro text-slate-300">
                              {confidenceInfo.label}
                            </span>
                            <div className="w-16 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${confidenceInfo.color}`}
                                style={{ width: `${transaction.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-small text-slate-300">
                          {transaction.reason}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

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
                  <tr className="text-left text-micro font-medium text-slate-500 border-b border-line-700">
                    <th className="pb-3 pr-4">DATE</th>
                    <th className="pb-3 pr-4">MERCHANT</th>
                    <th className="pb-3 pr-4">DESCRIPTION</th>
                    <th className="pb-3 pr-4 text-right">AMOUNT</th>
                    <th className="pb-3">REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {excluded.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-line-700"
                    >
                      <td className="py-4 pr-4 text-small text-slate-500">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="py-4 pr-4 text-small text-slate-500 max-w-[180px] truncate" title={transaction.merchant}>
                        {transaction.merchant}
                      </td>
                      <td className="py-4 pr-4 text-small text-slate-500 max-w-xs truncate">
                        {transaction.description}
                      </td>
                      <td className="py-4 pr-4 text-small text-slate-500 text-right">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="py-4 text-small text-slate-300">
                        {transaction.explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit Trail */}
          {activeTab === 'audit' && (
            <div 
              role="tabpanel" 
              id="audit-panel" 
              aria-labelledby="audit-tab"
              className="text-center py-12 text-slate-300"
            >
              <p className="mb-4">Audit trail view will show detailed processing steps for each transaction.</p>
              <p className="text-small text-slate-500">
                This includes normalisation, exclusion checks, classification attempts, and final results.
              </p>
            </div>
          )}
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

  return (
    <div className="space-y-6">
      {/* Transaction Summary */}
      <div className="space-y-3">
        <div>
          <div className="text-micro font-medium text-slate-500 mb-1">
            MERCHANT
          </div>
          <div className="text-h3 font-semibold text-white">
            {transaction.merchant}
          </div>
        </div>
        <div>
          <div className="text-micro font-medium text-slate-500 mb-1">
            DESCRIPTION
          </div>
          <div className="text-small text-slate-300">
            {transaction.description}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-micro font-medium text-slate-500 mb-1">
              DATE
            </div>
            <div className="text-small text-white">
              {formatDate(transaction.date)}
            </div>
          </div>
          <div>
            <div className="text-micro font-medium text-slate-500 mb-1">
              AMOUNT
            </div>
            <div className="text-small text-white">
              {formatCurrency(transaction.amount)}
            </div>
          </div>
        </div>
      </div>

      {/* Category and Confidence */}
      <div className="border-t border-line-700 pt-6 space-y-4">
        {transaction.category && (
          <div>
            <div className="text-micro font-medium text-slate-500 mb-2">
              CATEGORY
            </div>
            <Chip label={transaction.category} variant="category" size="md" />
          </div>
        )}

        <div>
          <div className="text-micro font-medium text-slate-500 mb-2">
            CONFIDENCE
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-small text-white">
              {confidenceInfo.label} ({(transaction.confidence * 100).toFixed(0)}%)
            </span>
            <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
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
          <div className="text-micro font-medium text-slate-500 mb-2">
            CLASSIFICATION REASON
          </div>
          <div className="text-small text-slate-300">
            {transaction.reason}
          </div>
        </div>
      </div>

      {/* Evidence Checklist */}
      {transaction.evidence && transaction.evidence.length > 0 && (
        <div className="border-t border-line-700 pt-6">
          <div className="text-micro font-medium text-slate-500 mb-3">
            EVIDENCE REQUIRED
          </div>
          <div className="space-y-2">
            {transaction.evidence.map((evidence: string, idx: number) => (
              <div key={idx} className="flex items-start space-x-2">
                <div className="w-5 h-5 rounded border border-line-700 bg-ink-800 flex items-center justify-center mt-0.5">
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
      {transaction.flags && transaction.flags.length > 0 && (
        <div className="border-t border-line-700 pt-6">
          <div className="text-micro font-medium text-slate-500 mb-3">
            SPECIAL REQUIREMENTS
          </div>
          <div className="space-y-2">
            {transaction.flags.map((flag: string, idx: number) => (
              <div key={idx} className="flex items-start space-x-2">
                <div className="w-5 h-5 rounded-full bg-accent bg-opacity-20 flex items-center justify-center mt-0.5">
                  <Icon name="AlertTriangle" size={12} className="text-accent" />
                </div>
                <div>
                  <div className="text-small text-white font-medium">
                    {flag === 'percentage_required' && 'Percentage Required'}
                    {flag === 'method_required' && 'Method Required'}
                    {flag === 'needs_review' && 'Needs Review'}
                    {flag === 'occupation_dependent' && 'Occupation Dependent'}
                  </div>
                  <div className="text-micro text-slate-300 mt-1">
                    {flag === 'percentage_required' && 'Calculate and document the work-related percentage of this expense.'}
                    {flag === 'method_required' && 'Choose an appropriate method and maintain required records.'}
                    {flag === 'needs_review' && 'Low confidence — please review and confirm this classification.'}
                    {flag === 'occupation_dependent' && 'Deductibility depends on your occupation. Confirm with a registered tax agent.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* More Detail Expansion */}
      <div className="border-t border-line-700 pt-6">
        <button
          onClick={() => setShowMoreDetail(!showMoreDetail)}
          className="flex items-center justify-between w-full text-small font-medium text-white hover:text-accent transition-colors"
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
              <div className="font-medium text-white mb-1">About this classification</div>
              <p>
                This transaction was classified using keyword matching and ATO-grounded rules
                for Australian fitness-related tax deductions.
              </p>
            </div>

            <div>
              <div className="font-medium text-white mb-1">What you need to do</div>
              <p>
                Review this classification and confirm it applies to your situation. Keep the
                evidence listed above. Deductibility may depend on your occupation — consult a
                registered tax agent if unsure.
              </p>
            </div>

            <div>
              <div className="font-medium text-white mb-1">Record retention</div>
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
