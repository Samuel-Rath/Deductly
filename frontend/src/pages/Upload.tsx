import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Icon } from '../components'
import { useUploadCSV } from '../api/hooks'

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const uploadMutation = useUploadCSV({
    onSuccess: (data) => {
      // If report data is included in response (ephemeral mode), navigate with state
      if (data.report_data) {
        navigate(`/report/${data.job_id}`, { state: { reportData: data.report_data } })
      } else {
        // Otherwise navigate normally and let Report component fetch data
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
  const [uploadProgress, setUploadProgress] = useState(0)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isPDF = fileName.endsWith('.pdf')
    
    if (!isCSV && !isPDF) {
      return 'Only CSV and PDF files are accepted'
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }
    return null
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const validationError = validateFile(droppedFile)
      if (validationError) {
        setError(validationError)
        return
      }
      setFile(droppedFile)
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validationError = validateFile(selectedFile)
      if (validationError) {
        setError(validationError)
        return
      }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
      if (!file) return

      setIsUploading(true)
      setUploadProgress(0)
      setError(null)

      try {
        // Simulate progress for UI feedback
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return 90
            }
            return prev + 10
          })
        }, 200)

        // Upload file using API (income year will be auto-detected from transaction dates)
        await uploadMutation.mutateAsync({
          file,
          ephemeralMode: true,
        })

        clearInterval(progressInterval)
        setUploadProgress(100)

        // Navigation handled by onSuccess callback
      } catch (err) {
        // Error handled by onError callback
        console.error('Upload error:', err)
      }
    }

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
                  aria-label="Upload bank statement - drag and drop or click to browse"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
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
                        <div className="text-sm text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
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
                  <p className="mt-2 text-sm text-slate-400">
                    Accepts CSV and PDF files • Maximum 10MB
                  </p>
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

              {/* Upload Progress */}
              {isUploading && (
                <div role="status" aria-live="polite" aria-label="Upload progress" className="p-4 bg-ink-800 border border-line-700 rounded-xl">
                  <div className="flex justify-between text-sm text-slate-300 mb-3">
                    <span className="font-medium">Uploading and processing...</span>
                    <span className="font-mono font-semibold text-accent-light">{uploadProgress}%</span>
                  </div>
                  <div 
                    className="w-full h-2 bg-ink-900 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Upload progress: ${uploadProgress}%`}
                  >
                    <div
                      className="h-full bg-gradient-brand transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate('/')}
                  disabled={isUploading}
                >
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
            <h3 className="text-sm font-medium text-white mb-2">
              Supported Formats
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              We support CSV and PDF bank statements from CommBank, NAB, Westpac, ANZ, and ING. The income year will be automatically detected from your transaction dates.
            </p>
          </div>
      </div>
    </div>
  )
}
