# API Module

This module provides a complete API client and state management solution for the Tax Deduction Analyzer frontend.

## Structure

```
api/
├── client.ts          # Core API client with axios
├── client.test.ts     # Tests for API client
├── hooks.ts           # React Query hooks
├── hooks.test.tsx     # Tests for React Query hooks
├── queryClient.ts     # React Query configuration
├── index.ts           # Module exports
└── README.md          # This file
```

## Features

### API Client (`client.ts`)

- **uploadCSV**: Upload CSV files with income year and configuration
- **getJobStatus**: Poll job status with automatic retries
- **downloadReport**: Download report files (PDF, CSV, JSON)
- **downloadReportFile**: Download and trigger browser download
- **Error Handling**: Custom APIError class with status codes and details
- **Retry Logic**: Automatic retries with exponential backoff for network errors

### React Query Hooks (`hooks.ts`)

- **useUploadCSV**: Mutation hook for file uploads
- **useJobStatus**: Query hook with automatic polling until completion
- **useDownloadReport**: Mutation hook for downloading reports
- **useDownloadReportFile**: Mutation hook for browser downloads
- **Automatic Caching**: Query results are cached and invalidated appropriately
- **Loading States**: Built-in loading, error, and success states

### Configuration (`queryClient.ts`)

- **Default Options**: Configured retry logic, stale time, and cache time
- **Utility Functions**: clearCache() and invalidateJobs() helpers
- **Optimized Settings**: 5-minute stale time, 10-minute cache time

## Usage Examples

### Upload a CSV File

```tsx
import { useUploadCSV } from '@/api';

function UploadPage() {
  const uploadMutation = useUploadCSV({
    onSuccess: (data) => {
      navigate(`/report/${data.job_id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpload = (file: File) => {
    uploadMutation.mutate({
      file,
      incomeYear: '2023-2024',
      ephemeralMode: true,
    });
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploadMutation.isPending && <p>Uploading...</p>}
    </div>
  );
}
```

### Poll Job Status

```tsx
import { useJobStatus } from '@/api';

function ReportPage({ jobId }: { jobId: string }) {
  const { data: jobStatus, isLoading } = useJobStatus(jobId);

  if (isLoading) return <p>Loading...</p>;
  if (jobStatus?.status === 'failed') return <p>Error: {jobStatus.error}</p>;
  if (jobStatus?.status === 'completed') {
    return <ReportViewer urls={jobStatus.report_urls} />;
  }

  return <p>Processing... {jobStatus?.progress}%</p>;
}
```

### Download a Report

```tsx
import { useDownloadReportFile } from '@/api';

function DownloadButton({ jobId }: { jobId: string }) {
  const downloadMutation = useDownloadReportFile({
    onSuccess: () => {
      toast.success('Report downloaded');
    },
  });

  return (
    <button
      onClick={() =>
        downloadMutation.mutate({
          jobId,
          format: 'pdf',
          filename: 'deduction-report.pdf',
        })
      }
      disabled={downloadMutation.isPending}
    >
      {downloadMutation.isPending ? 'Downloading...' : 'Download PDF'}
    </button>
  );
}
```

## Environment Configuration

Create a `.env` file in the frontend root:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Testing

All API functions and hooks are fully tested:

```bash
npm test -- src/api/
```

- **client.test.ts**: Tests for API client functions, error handling, and retries
- **hooks.test.tsx**: Tests for React Query hooks, mutations, and queries

## Error Handling

The API client throws `APIError` instances with:

- `message`: Human-readable error message
- `statusCode`: HTTP status code (0 for network errors)
- `errorCode`: Machine-readable error code
- `details`: Additional error details

Example:

```tsx
try {
  await uploadCSV(request);
} catch (error) {
  if (error instanceof APIError) {
    console.log(error.message);      // "Only CSV files are allowed"
    console.log(error.statusCode);   // 400
    console.log(error.errorCode);    // "invalid_file_type"
    console.log(error.details);      // { allowed_types: [...] }
  }
}
```

## Requirements Validation

This implementation validates:

- **Requirement 11.1**: POST endpoint for CSV upload
- **Requirement 11.2**: Job identifier returned immediately
- **Requirement 11.3**: GET endpoint for job status
- **Requirement 11.4**: Download endpoints for reports
- **Requirement 11.5**: Error handling with appropriate HTTP status codes
