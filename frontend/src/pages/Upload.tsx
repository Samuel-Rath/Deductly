import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Icon } from '../components'
import { useUploadCSV } from '../api/hooks'

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useUploadCSV({
    onSuccess: (data) => {
      if (data.report_data) {
        navigate(`/report/${data.job_id}`, { state: { reportData: data.report_data } })
      } else {
        navigate(`/report/${data.job_id}`)
      }
    },
    onError: (error) => {
      setError(error.message || 'Upload failed. Please try again.')
      setIsUploading(false)
      setUploadProgress(0)
    },
  })

  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isPDF = fileName.endsWith('.pdf')
    if (!isCSV && !isPDF) return 'Only CSV and PDF files are accepted'
    if (file.size > MAX_FILE_SIZE) return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    return null
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false) }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const validationError = validateFile(droppedFile)
      if (validationError) { setError(validationError); return }
      setFile(droppedFile)
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validationError = validateFile(selectedFile)
      if (validationError) { setError(validationError); return }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setError(null)
    try {
      await uploadMutation.mutateAsync({ file, ephemeralMode: true, confidenceThreshold })
    } catch (err) {
      console.error('Upload error:', err)
    }
  }

  const thresholdPct = Math.round(confidenceThreshold * 100)

  return (
    <div className="pt-20 sm:pt-24 container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-h1 font-semibold text-white mb-2">
            Upload Your Bank Statement
          </h1>
          <p className="text-body text-slate-300">
            We'll analyse your transactions and identify potential tax deductions
          </p>
        </div>

        <Card>
          <div className="space-y-6">
            {/* Drag and Drop Zone */}
            <div>
              <label htmlFor="bank-statement-input" className="block text-base font-medium text-white mb-3">
                Bank Statement
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload bank statement. Drag and drop or click to browse"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() }
                }}
                className={`
                  border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${isDragging
                    ? 'border-violet-500 bg-violet-500/5 scale-[1.02] shadow-glow-violet'
                    : file
                    ? 'border-accent/50 bg-accent/5'
                    : 'border-line-700 hover:border-line-600 hover:bg-ink-700/40'
                  }
                `}
              >
                <input
                  id="bank-statement-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="space-y-3">
                  {file ? (
                    <>
                      <Icon name="FileText" size={40} className="text-accent mx-auto" />
                      <div className="text-lg font-medium text-white">{file.name}</div>
                      <div className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                    </>
                  ) : (
                    <>
                      <Icon name="Upload" size={40} className="text-slate-500 mx-auto" />
                      <div className="text-lg font-medium text-white">Drop your file here</div>
                      <div className="text-sm text-slate-400">CSV or PDF • or click to browse</div>
                    </>
                  )}
                </div>
              </div>
              {!file && (
                <p className="mt-2 text-sm text-slate-400">Accepts CSV and PDF files • Maximum 10MB</p>
              )}
              {error && (
                <div role="alert" aria-live="polite" className="mt-3 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Icon name="AlertCircle" size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="flex items-start gap-3 p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl">
              <Icon name="ShieldCheck" size={20} className="text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300 leading-relaxed">
                Your data is processed in memory and deleted immediately after your report is generated. Nothing is stored.
              </p>
            </div>

            {/* Analysis Options (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Icon name={showAdvanced ? 'ChevronDown' : 'ChevronRight'} size={15} />
                Analysis options
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-5 pl-1">
                  {/* Confidence threshold */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-white">Confidence level</label>
                      <span className="text-sm font-mono font-semibold" style={{ color: '#F5C842' }}>{thresholdPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={0.9}
                      step={0.05}
                      value={confidenceThreshold}
                      onChange={e => setConfidenceThreshold(Number(e.target.value))}
                      className="w-full accent-amber-400"
                      aria-label={`Confidence threshold: ${thresholdPct}%`}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>More deductions (50%)</span>
                      <span>Fewer but certain (90%)</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Transactions below this threshold go to Needs Review instead of Candidates.
                    </p>
                  </div>

</div>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div role="status" aria-live="polite" aria-label="Uploading and processing" className="p-4 bg-ink-800 border border-line-700 rounded-xl">
                <div className="flex items-center justify-between text-sm text-slate-300 mb-3">
                  <span className="font-medium">Uploading and processing...</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-accent-light"
                        style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </span>
                </div>
                <div
                  className="w-full h-2 bg-ink-900 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-busy="true"
                  aria-label="Processing your file"
                >
                  <div className="h-full bg-gradient-brand rounded-full progress-indeterminate" />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <Button variant="secondary" size="md" onClick={() => navigate('/')} disabled={isUploading}>
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full sm:w-auto sm:min-w-[160px]"
              >
                {isUploading ? 'Processing...' : 'Start Analysis'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-ink-900/50 border border-line-700 rounded-xl">
          <h3 className="text-sm font-medium text-white mb-2">Supported Formats</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            We support CSV and PDF bank statements from CommBank, NAB, Westpac, ANZ, and ING. The income year will be automatically detected from your transaction dates.
          </p>
        </div>
      </div>
    </div>
  )
}
