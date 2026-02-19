import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Chip, Drawer } from '../components'
import { useJobStatus, useDownloadReportFile } from '../api/hooks'

// Mock data - will be replaced with API data
const mockReportData = {
  incomeYear: '2023-2024',
  generatedAt: '2024-01-15T10:30:00Z',
  summary: {
    totalDeductible: 12450.00,
    totalNeedsReview: 2340.00,
    totalExcluded: 45210.00,
    categoryTotals: {
      'Work Software': 1200.00,
      'Professional Memberships': 450.00,
      'Training & Education': 2800.00,
      'Work Equipment': 3500.00,
      'Phone & Internet': 890.00,
      'Working from Home': 1200.00,
      'Travel': 1800.00,
      'Donations': 610.00,
    },
    confidenceDistribution: {
      high: 45,
      medium: 23,
      low: 12,
    },
  },
  candidates: [
    {
      id: '1',
      date: '2024-01-15',
      merchant: 'Adobe',
      description: 'PAYPAL *ADOBE CREATIVE',
      amount: 79.99,
      category: 'Work Software',
      confidence: 0.95,
      reason: 'Keyword match: adobe',
      evidence: ['Receipt'],
      flags: [],
    },
    {
      id: '2',
      date: '2024-01-22',
      merchant: 'Officeworks',
      description: 'EFTPOS OFFICEWORKS SYDNEY',
      amount: 145.50,
      category: 'Work Equipment',
      confidence: 0.88,
      reason: 'Merchant match: Officeworks',
      evidence: ['Receipt'],
      flags: [],
    },
    {
      id: '3',
      date: '2024-01-28',
      merchant: 'Telstra',
      description: 'DIRECT DEBIT TELSTRA',
      amount: 89.00,
      category: 'Phone & Internet',
      confidence: 0.75,
      reason: 'Keyword match: telstra',
      evidence: ['Receipt', 'Percentage Record'],
      flags: ['percentage_required'],
    },
  ],
  needsReview: [
    {
      id: '4',
      date: '2024-02-05',
      merchant: 'Unknown Merchant',
      description: 'CARD PURCHASE 1234',
      amount: 250.00,
      category: null,
      confidence: 0.45,
      reason: 'No rule match',
      evidence: [],
      flags: ['needs_review'],
    },
  ],
  excluded: [
    {
      id: '5',
      date: '2024-01-10',
      merchant: 'Transfer',
      description: 'TRANSFER TO SAVINGS',
      amount: 1000.00,
      reason: 'Transfer between accounts',
      explanation: 'Internal transfer - not a deduction candidate',
    },
  ],
}

export default function Report() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'candidates' | 'needs-review' | 'excluded' | 'audit'>('candidates')
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Fetch job status with polling
  const { data: jobStatus, isLoading, error: jobError } = useJobStatus(jobId || '', {
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Stop polling when job is complete or failed
      if (!data) return 2000
      return data.status === 'completed' || data.status === 'failed' ? false : 2000
    },
  })

  // Download mutation
  const downloadMutation = useDownloadReportFile({
    onSuccess: () => {
      setDownloadError(null)
    },
    onError: (error) => {
      setDownloadError(error.message || 'Failed to download report')
    },
  })

  // Use mock data for now - will be replaced with actual report data from API
  const { summary, candidates, needsReview, excluded } = mockReportData

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
    if (confidence >= 0.80) return { label: 'High', color: 'bg-accent' }
    if (confidence >= 0.60) return { label: 'Medium', color: 'bg-slate-500' }
    return { label: 'Low', color: 'bg-slate-700' }
  }

  const totalTransactions = summary.confidenceDistribution.high + 
                           summary.confidenceDistribution.medium + 
                           summary.confidenceDistribution.low

  const handleDownload = async (format: 'pdf' | 'csv' | 'json') => {
    if (!jobId) return
    
    setDownloadError(null)

    try {
      await downloadMutation.mutateAsync({
        jobId,
        format,
        filename: `deduction_report_${mockReportData.incomeYear}.${format}`,
      })
    } catch (err) {
      // Error handled by onError callback
      console.error('Download error:', err)
    }
  }

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-accent mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-body text-slate-300">Loading report...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {jobError && (
        <div className="max-w-2xl mx-auto" role="alert" aria-live="assertive">
          <Card>
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-h2 font-semibold text-white mb-2">
                Failed to load report
              </h2>
              <p className="text-body text-slate-300 mb-6">
                {jobError.message || 'An error occurred while loading the report.'}
              </p>
              <Button variant="primary" onClick={() => navigate('/upload')}>
                Upload New File
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Processing State */}
      {jobStatus && (jobStatus.status === 'queued' || jobStatus.status === 'processing') && (
        <div className="max-w-2xl mx-auto" role="status" aria-live="polite">
          <Card>
            <div className="text-center py-8">
              <svg className="animate-spin h-12 w-12 text-accent mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <h2 className="text-h2 font-semibold text-white mb-2">
                Processing your file
              </h2>
              <p className="text-body text-slate-300 mb-4">
                Analyzing transactions and generating report...
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
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${jobStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Failed State */}
      {jobStatus && jobStatus.status === 'failed' && (
        <div className="max-w-2xl mx-auto" role="alert" aria-live="assertive">
          <Card>
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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

      {/* Report Content - Only show when completed */}
      {jobStatus && jobStatus.status === 'completed' && (
      <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-h1 font-semibold text-white mb-2">
              Deduction Report
            </h1>
            <p className="text-body text-slate-300">
              Income Year: {mockReportData.incomeYear} (1 July 2023 - 30 June 2024)
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

          {/* Export Buttons */}
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={() => handleDownload('pdf')}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending && downloadMutation.variables?.format === 'pdf' ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Downloading...</span>
                </span>
              ) : (
                'Download PDF'
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload('csv')}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending && downloadMutation.variables?.format === 'csv' ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Downloading...</span>
                </span>
              ) : (
                'Download CSV'
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload('json')}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending && downloadMutation.variables?.format === 'json' ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Downloading...</span>
                </span>
              ) : (
                'Download JSON'
              )}
            </Button>
          </div>

          {/* Download Error */}
          {downloadError && (
            <div className="mt-3 p-3 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-small text-red-300">
                  {downloadError}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <div className="space-y-2">
              <div className="text-micro font-medium text-slate-500">
                LIKELY DEDUCTIBLE
              </div>
              <div className="text-h1 font-semibold text-white">
                {formatCurrency(summary.totalDeductible)}
              </div>
              <div className="text-small text-slate-300">
                {summary.confidenceDistribution.high + summary.confidenceDistribution.medium} transactions
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="text-micro font-medium text-slate-500">
                NEEDS REVIEW
              </div>
              <div className="text-h1 font-semibold text-slate-300">
                {formatCurrency(summary.totalNeedsReview)}
              </div>
              <div className="text-small text-slate-300">
                {summary.confidenceDistribution.low} transactions
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="text-micro font-medium text-slate-500">
                EXCLUDED
              </div>
              <div className="text-h1 font-semibold text-slate-500">
                {formatCurrency(summary.totalExcluded)}
              </div>
              <div className="text-small text-slate-300">
                Not deduction candidates
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <div className="text-micro font-medium text-slate-500">
                TOTAL ANALYZED
              </div>
              <div className="text-h1 font-semibold text-white">
                {totalTransactions}
              </div>
              <div className="text-small text-slate-300">
                Transactions processed
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Confidence Distribution Chart */}
          <Card>
            <h3 className="text-h3 font-semibold text-white mb-6">
              Confidence Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>High (0.80 - 1.00)</span>
                  <span>{summary.confidenceDistribution.high} transactions</span>
                </div>
                <div className="w-full h-8 bg-ink-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{ 
                      width: `${(summary.confidenceDistribution.high / totalTransactions) * 100}%` 
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-small text-slate-300 mb-2">
                  <span>Medium (0.60 - 0.79)</span>
                  <span>{summary.confidenceDistribution.medium} transactions</span>
                </div>
                <div className="w-full h-8 bg-ink-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-slate-500"
                    style={{ 
                      width: `${(summary.confidenceDistribution.medium / totalTransactions) * 100}%` 
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
                      width: `${(summary.confidenceDistribution.low / totalTransactions) * 100}%` 
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
              {Object.entries(summary.categoryTotals)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <div key={category}>
                    <div className="flex justify-between text-small text-slate-300 mb-1">
                      <span>{category}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                    <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white"
                        style={{ 
                          width: `${(amount / summary.totalDeductible) * 100}%` 
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
              <table className="w-full" aria-label="Deduction candidates">
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
                            {transaction.evidence.map((ev, idx) => (
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
                      <td className="py-4 pr-4 text-small text-slate-500">
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
          {selectedTransaction && (() => {
            const transaction = [...candidates, ...needsReview].find(t => t.id === selectedTransaction)
            if (!transaction) return null

            const confidenceInfo = getConfidenceLabel(transaction.confidence)
            const [showMoreDetail, setShowMoreDetail] = useState(false)

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
                      {transaction.evidence.map((evidence, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <div className="w-5 h-5 rounded border border-line-700 bg-ink-800 flex items-center justify-center mt-0.5">
                            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
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
                      {transaction.flags.map((flag, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <div className="w-5 h-5 rounded-full bg-accent bg-opacity-20 flex items-center justify-center mt-0.5">
                            <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-small text-white font-medium">
                              {flag === 'percentage_required' && 'Percentage Required'}
                              {flag === 'method_required' && 'Method Required'}
                              {flag === 'needs_review' && 'Needs Review'}
                            </div>
                            <div className="text-micro text-slate-300 mt-1">
                              {flag === 'percentage_required' && 'You must calculate and document the work-related percentage of this expense.'}
                              {flag === 'method_required' && 'Choose an appropriate method and maintain required records.'}
                              {flag === 'needs_review' && 'Low confidence classification - please review and confirm.'}
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
                    <svg
                      className={`w-5 h-5 transition-transform ${showMoreDetail ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showMoreDetail && (
                    <div className="mt-4 space-y-4 text-small text-slate-300">
                      <div>
                        <div className="font-medium text-white mb-1">
                          About this classification
                        </div>
                        <p>
                          This transaction was classified using our rules engine, which matches transaction descriptions 
                          and merchant names against known patterns for Australian tax deductions.
                        </p>
                      </div>
                      
                      <div>
                        <div className="font-medium text-white mb-1">
                          What you need to do
                        </div>
                        <p>
                          Review this classification and confirm it's accurate for your situation. Keep the required 
                          evidence listed above. This is a likely deductible candidate - final confirmation is your responsibility.
                        </p>
                      </div>
                      
                      <div>
                        <div className="font-medium text-white mb-1">
                          Record retention
                        </div>
                        <p>
                          Generally, keep records for 5 years from the date you lodge your tax return. Some records 
                          may need to be kept longer depending on your circumstances.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </Drawer>
      </div>
      )}
    </div>
  )
}
