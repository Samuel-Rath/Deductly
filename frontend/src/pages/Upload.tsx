import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageHeader, LogoMark } from '../components'
import { useUploadCSV } from '../api/hooks'

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useUploadCSV({
    onSuccess: (data) => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
      setUploadProgress(100)
      setTimeout(() => {
        if (data.report_data) {
          navigate(`/report/${data.job_id}`, { state: { reportData: data.report_data } })
        } else {
          navigate(`/report/${data.job_id}`)
        }
      }, 300)
    },
    onError: (error) => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
      const msg = error.errorCode === 'network_error'
        ? 'Could not reach the server. Please check your connection and try again.'
        : error.message || 'Upload failed. Please try again.'
      setError(msg)
      setIsUploading(false)
      setUploadProgress(0)
      setIsWakingUp(false)
    },
  })

  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('Uploading your file...')
  const [isWakingUp, setIsWakingUp] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const processingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current)
    }
  }, [])

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
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // dragleave also fires when the pointer crosses into a child element; only
    // clear the highlight when it actually leaves the drop zone.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    // Swapping the file mid-upload would show a name that isn't the one being analysed.
    if (isUploading) return
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
    // Reset so picking the same file again (e.g. after a failed upload) still fires onChange.
    e.target.value = ''
    if (selectedFile) {
      const validationError = validateFile(selectedFile)
      if (validationError) { setError(validationError); return }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    if (processingTimerRef.current) clearInterval(processingTimerRef.current)
    const isPDF = file.name.toLowerCase().endsWith('.pdf')
    setIsUploading(true)
    setIsWakingUp(false)
    setUploadProgress(0)
    setStatusMsg(isPDF ? 'Uploading your PDF...' : 'Uploading your file...')
    setError(null)

    // Progress is split into two phases because the backend processes synchronously
    // and sends no streaming updates between receiving the file and returning results.
    //
    // Phase 1 (0–40 %): real bytes-transferred progress from axios onUploadProgress.
    // Phase 2 (40–95 %): simulated tick-based advance while the backend runs parsing
    //   + classification. PDFs get a slightly slower curve (more work on server).
    //   Capped at 95 % so the bar never reaches 100 % before the response arrives;
    //   the final jump to 100 % happens in onSuccess.
    const startProcessingPhase = () => {
      const pdfStages = [
        { at: 50, msg: 'Extracting transactions from PDF...' },
        { at: 65, msg: 'Normalising merchants and amounts...' },
        { at: 78, msg: 'Classifying deductible items...' },
        { at: 88, msg: 'Building your report...' },
      ]
      const csvStages = [
        { at: 55, msg: 'Parsing transactions...' },
        { at: 72, msg: 'Classifying deductible items...' },
        { at: 88, msg: 'Building your report...' },
      ]
      const stages = isPDF ? pdfStages : csvStages
      setStatusMsg(stages[0].msg)
      let current = 40
      // PDFs typically take longer server-side; use a slower step.
      const stepPerTick = isPDF ? 0.9 : 1.3
      processingTimerRef.current = setInterval(() => {
        current = Math.min(95, current + stepPerTick)
        const rounded = Math.round(current)
        setUploadProgress(rounded)
        const nextStage = stages.find(s => rounded >= s.at && rounded < s.at + 2)
        if (nextStage) setStatusMsg(nextStage.msg)
        if (current >= 95 && processingTimerRef.current) {
          clearInterval(processingTimerRef.current)
          processingTimerRef.current = null
        }
      }, 200)
    }

    let uploadPhaseComplete = false

    try {
      await uploadMutation.mutateAsync({
        file,
        ephemeralMode: true,
        confidenceThreshold,
        onUploadProgress: (pct) => {
          setUploadProgress(Math.round(pct * 0.4))
          if (pct >= 100 && !uploadPhaseComplete) {
            uploadPhaseComplete = true
            startProcessingPhase()
          }
        },
        onRetry: (attempt) => {
          if (processingTimerRef.current) clearInterval(processingTimerRef.current)
          uploadPhaseComplete = false
          setIsWakingUp(true)
          setUploadProgress(0)
          setStatusMsg(`Connecting to server (attempt ${attempt + 1})...`)
        },
      })
    } catch (err) {
      console.error('Upload error:', err)
    }
  }

  const thresholdPct = Math.round(confidenceThreshold * 100)

  return (
    <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] pb-[96px] lg:pb-[140px]">
      <PageHeader
        index="01"
        label="Step 1 of 2 · Upload"
        title="Upload Your Bank Statement"
        lead="We'll analyse your transactions and identify potential tax deductions, checked line by line against ATO rules."
      />

      <div className="grid lg:grid-cols-12 gap-[56px] lg:gap-[32px]">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="flex items-baseline justify-between mb-[12px]">
            <label htmlFor="bank-statement-input" className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">
              Bank Statement
            </label>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">CSV · PDF · 10MB max</span>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => { if (!isUploading) fileInputRef.current?.click() }}
            role="button"
            tabIndex={0}
            aria-disabled={isUploading}
            aria-label="Upload bank statement. Drag and drop or click to browse"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isUploading) fileInputRef.current?.click() }
            }}
            className={[
              'group relative rounded-[4px] border border-dashed min-h-[280px] sm:min-h-[320px] grid place-items-center p-[24px] text-center cursor-pointer',
              'transition-[border-color,background-color] duration-300',
              isDragging
                ? 'border-brass bg-brass/[0.06]'
                : file
                ? 'border-bone/20 bg-transparent'
                : 'border-bone/20 hover:border-bone/45 hover:bg-bone/[0.02]',
            ].join(' ')}
          >
            <input
              id="bank-statement-input"
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              // The chosen file, shown as a paper slip
              <div className="paper w-full max-w-[380px] rounded-[3px] px-[24px] py-[20px] text-left shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] -rotate-[1deg]">
                <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#1A1612]/55">
                  <span>{file.name.toLowerCase().endsWith('.pdf') ? 'PDF statement' : 'CSV statement'}</span>
                  <span className="text-penink">Ready</span>
                </div>
                <div className="mt-[14px] h-px bg-[#1A1612]/15" />
                <div className="mt-[14px] font-mono text-[14px] break-all">{file.name}</div>
                <div className="mt-[6px] font-mono text-[11px] text-[#1A1612]/55">{(file.size / 1024).toFixed(1)} KB</div>
                <div className="mt-[16px] font-display italic text-[15px] text-penink">↳ click or drop to replace</div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg aria-hidden="true" width="56" height="64" viewBox="0 0 56 64" fill="none" className="text-bone/40 group-hover:text-bone/70 transition-colors duration-300">
                  <path d="M6 2h30l14 14v44a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M36 2v14h14" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M12 28h24M12 35h32M12 42h18M12 49h28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" />
                </svg>
                <div className="mt-[24px] font-display text-[30px] sm:text-[36px] leading-none tracking-[-0.02em] text-bone">
                  Drop your file here
                </div>
                <div className="mt-[12px] text-[15px] text-bone-400">
                  or <span className="text-bone underline decoration-bone/30 underline-offset-4 group-hover:decoration-brass">browse your files</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="mt-[16px] border-l-2 border-red-400 bg-red-400/[0.06] px-[16px] py-[12px]">
              <p className="text-[14px] text-red-400">{error}</p>
            </div>
          )}

          {/* Privacy note */}
          <div className="mt-[24px] flex items-start gap-[14px] border-t border-bone/[0.09] pt-[20px]">
            <LogoMark size={16} className="text-bone mt-[3px] shrink-0" />
            <p className="text-[14px] leading-[1.6] text-bone-400">
              Your data is processed in memory and deleted immediately after your report is generated. Nothing is stored.
            </p>
          </div>

          {/* Analysis options */}
          <div className="mt-[20px] border-t border-bone/[0.09] pt-[20px]">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              aria-expanded={showAdvanced}
              className="flex items-center gap-[10px] font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400 hover:text-bone transition-colors"
            >
              <span aria-hidden="true" className={`inline-block transition-transform duration-300 ${showAdvanced ? 'rotate-45' : ''}`}>+</span>
              Analysis options
            </button>

            {showAdvanced && (
              <div className="mt-[20px]">
                <div className="flex items-baseline justify-between mb-[12px]">
                  <label htmlFor="confidence-threshold" className="text-[15px] text-bone">Confidence level</label>
                  <span className="font-display text-[28px] leading-none text-brass tabular-nums">{thresholdPct}%</span>
                </div>
                <input
                  id="confidence-threshold"
                  type="range"
                  min={0.5}
                  max={0.9}
                  step={0.05}
                  value={confidenceThreshold}
                  onChange={e => setConfidenceThreshold(Number(e.target.value))}
                  className="w-full accent-[#D9A441]"
                  aria-label={`Confidence threshold: ${thresholdPct}%`}
                />
                <div className="flex justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-bone-600 mt-[8px]">
                  <span>More deductions (50%)</span>
                  <span>Fewer but certain (90%)</span>
                </div>
                <p className="text-[13px] text-bone-400 mt-[10px]">
                  Transactions below this threshold go to Needs Review instead of Candidates.
                </p>
              </div>
            )}
          </div>

          {/* Progress */}
          {isUploading && (
            <div role="status" aria-live="polite" aria-label="Uploading and processing" className="mt-[24px] border-t border-bone/[0.09] pt-[20px]">
              <div className="flex items-baseline justify-between gap-[16px]">
                <span className="text-[15px] text-bone">{statusMsg}</span>
                {uploadProgress > 0 && (
                  <span className="font-mono text-[12px] text-bone-400 tabular-nums">{uploadProgress}%</span>
                )}
              </div>
              {isWakingUp && (
                <p className="mt-[6px] text-[13px] text-brass">
                  Server is warming up. The first upload can take up to 30 seconds.
                </p>
              )}
              <div
                className="mt-[14px] w-full h-[2px] bg-bone/[0.1] overflow-hidden relative"
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload and processing progress"
              >
                {uploadProgress === 0 ? (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="w-1/3 h-full bg-brass animate-indeterminate" />
                  </div>
                ) : (
                  <div className="h-full bg-brass transition-[width] duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-[32px] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-[12px]">
            <Button variant="tertiary" size="md" onClick={() => navigate('/')} disabled={isUploading}>
              ← Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              withArrow={!isUploading}
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? 'Processing...' : 'Start Analysis'}
            </Button>
          </div>
        </div>

        {/* ── Aside ────────────────────────────────────────────────────── */}
        <aside className="lg:col-span-4 lg:col-start-9 lg:pt-[30px]">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">What happens next</h2>
          <ol className="mt-[16px]">
            {NEXT_STEPS.map(([t, b], i) => (
              <li key={t} className="grid grid-cols-[40px_1fr] gap-[8px] py-[18px] border-t border-bone/[0.09]">
                <span className="font-mono text-[11px] text-brass pt-[6px]">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-[22px] leading-none tracking-[-0.01em] text-bone">{t}</h3>
                  <p className="mt-[8px] text-[14px] leading-[1.6] text-bone-400">{b}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-[8px] border-t border-bone/[0.09] pt-[20px]">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">Supported Formats</h2>
            <p className="mt-[12px] text-[14px] leading-[1.6] text-bone-400">
              CSV and PDF statements from CommBank, NAB, Westpac, ANZ and ING. The income year is detected from your transaction dates.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

const NEXT_STEPS: Array<[string, string]> = [
  ['Parse', 'Your statement is read in memory. Format, bank layout and income year are detected automatically.'],
  ['Classify', 'Personal identifiers are stripped, then each line is matched against ATO deduction rules and scored.'],
  ['Report', 'You get candidates, items to review and an audit trail, with the evidence to keep for each.'],
]
