import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input } from '../components'

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [incomeYear, setIncomeYear] = useState(() => {
    // Default to current income year (July 1 - June 30)
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-12
    
    // If before July, use previous year
    if (currentMonth < 7) {
      return `${currentYear - 1}-${currentYear}`
    }
    return `${currentYear}-${currentYear + 1}`
  })
  const [ephemeralMode, setEphemeralMode] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'Only CSV files are accepted'
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
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // TODO: Replace with actual API call
      // const formData = new FormData()
      // formData.append('file', file)
      // formData.append('income_year', incomeYear)
      // formData.append('ephemeral_mode', String(ephemeralMode))
      // const response = await uploadCSV(formData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      clearInterval(progressInterval)
      setUploadProgress(100)

      // Navigate to report page with job_id
      // TODO: Use actual job_id from API response
      setTimeout(() => {
        navigate('/report/demo-job-id')
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const generateIncomeYearOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    
    // Generate options for current year and 4 previous years
    for (let i = 0; i < 5; i++) {
      const startYear = currentYear - i
      const endYear = startYear + 1
      options.push(`${startYear}-${endYear}`)
    }
    
    return options
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-h1 font-semibold text-white mb-2">
            Upload your bank CSV
          </h1>
          <p className="text-body text-slate-300">
            We generate likely deductible candidates. You confirm. Keep records.
          </p>
        </div>

          <Card>
            <div className="space-y-6">
              {/* Drag and Drop Zone */}
              <div>
                <label className="block text-small font-medium text-white mb-2">
                  Bank statement CSV
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                    transition-colors
                    ${isDragging 
                      ? 'border-accent bg-ink-800' 
                      : 'border-line-700 hover:border-slate-500 hover:bg-ink-800'
                    }
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="space-y-2">
                    <div className="text-h3 text-white">
                      {file ? file.name : 'Drop your CSV here'}
                    </div>
                    <div className="text-small text-slate-300">
                      {file 
                        ? `${(file.size / 1024).toFixed(1)} KB` 
                        : 'or click to browse'
                      }
                    </div>
                    {!file && (
                      <div className="text-micro text-slate-500 mt-2">
                        Maximum file size: 10MB
                      </div>
                    )}
                  </div>
                </div>
                {error && (
                  <div className="mt-2 text-small text-red-400">
                    {error}
                  </div>
                )}
              </div>

              {/* Income Year Selector */}
              <div>
                <label htmlFor="income-year" className="block text-small font-medium text-white mb-2">
                  Income year
                </label>
                <select
                  id="income-year"
                  value={incomeYear}
                  onChange={(e) => setIncomeYear(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-800 border border-line-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {generateIncomeYearOptions().map(year => (
                    <option key={year} value={year}>
                      {year} (1 July {year.split('-')[0]} - 30 June {year.split('-')[1]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Privacy Toggle */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="ephemeral-mode"
                  checked={ephemeralMode}
                  onChange={(e) => setEphemeralMode(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-line-700 bg-ink-800 text-accent focus:ring-2 focus:ring-accent"
                />
                <div>
                  <label htmlFor="ephemeral-mode" className="block text-small font-medium text-white cursor-pointer">
                    Ephemeral mode (recommended)
                  </label>
                  <p className="text-micro text-slate-300 mt-1">
                    Your data is processed and deleted immediately after report generation. No transaction data is stored.
                  </p>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div>
                  <div className="flex justify-between text-small text-slate-300 mb-2">
                    <span>Uploading and processing...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="tertiary"
                  onClick={() => navigate('/')}
                  disabled={isUploading}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                >
                  {isUploading ? 'Processing...' : 'Start Analysis'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Info Section */}
          <div className="mt-8 p-6 bg-ink-900 border border-line-700 rounded-xl">
            <h3 className="text-small font-medium text-white mb-2">
              Supported formats
            </h3>
            <p className="text-small text-slate-300">
              We support CSV files from major Australian banks including CommBank, NAB, Westpac, ANZ, and ING. 
              The file should contain transaction date, description, and amount columns.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
