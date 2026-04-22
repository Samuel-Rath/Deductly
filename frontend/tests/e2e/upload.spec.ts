import { test, expect } from '@playwright/test'
import { UploadPage } from '../pages/upload.page'

test.describe('Upload Flow', () => {
  test('renders upload page with key elements', async ({ page }) => {
    const upload = new UploadPage(page)
    await upload.goto()

    await expect(upload.heading).toBeVisible()
    await expect(upload.analyseButton).toBeDisabled()
    await expect(upload.privacyNotice).toBeVisible()
    await expect(upload.backButton).toBeVisible()
  })

  test('accepts a CSV file and enables analyse button', async ({ page }) => {
    const upload = new UploadPage(page)
    await upload.goto()

    await upload.uploadCSVContent('bank_statement.csv')
    await upload.expectFileSelected('bank_statement.csv')
  })

  test('accepts a PDF file', async ({ page }) => {
    const upload = new UploadPage(page)
    await upload.goto()

    await upload.uploadPDFContent('statement_jul24.pdf')
    await upload.expectFileSelected('statement_jul24.pdf')
  })

  test('rejects unsupported file types', async ({ page }) => {
    const upload = new UploadPage(page)
    await upload.goto()

    await upload.fileInput.setInputFiles({
      name: 'spreadsheet.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('fake xlsx'),
    })

    await upload.expectError(/only csv and pdf files are accepted/i)
    await upload.expectAnalyseDisabled()
  })

  test('back button returns to landing page', async ({ page }) => {
    const upload = new UploadPage(page)
    await upload.goto()
    await upload.backButton.click()
    await expect(page).toHaveURL('/')
  })

  test('mocks successful upload and navigates to report', async ({ page }) => {
    // Intercept the API call — `**/api/upload` specifically so the pattern
    // doesn't ALSO swallow the SPA page navigation to `/upload`.
    await page.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'test-job-123',
          status: 'completed',
          message: 'File uploaded successfully',
          report_data: {
            income_year: '2023-2024',
            generated_at: new Date().toISOString(),
            summary: {
              total_deductible: 638.95,
              total_needs_review: 312.40,
              total_excluded: 0,
              category_totals: { work_equipment: 89.95, professional_memberships: 549.00 },
              confidence_distribution: { high: 1, medium: 1, low: 1 },
            },
            candidates: [
              { id: '1', merchant: 'Officeworks', amount: 89.95, category: 'work_equipment', confidence: 0.74, date: '2024-07-15', description: 'Officeworks PTY LTD', reason: 'keyword_match: officeworks', evidence: ['receipt'], flags: [] },
              { id: '2', merchant: 'CPA Australia', amount: 549.00, category: 'professional_memberships', confidence: 0.91, date: '2024-07-20', description: 'CPA AUSTRALIA MEMBERSHIP', reason: 'keyword_match: cpa australia', evidence: ['invoice'], flags: [] },
            ],
            needs_review: [],
            excluded: [],
          },
        }),
      })
    })

    const upload = new UploadPage(page)
    await upload.goto()
    await upload.uploadCSVContent()
    await upload.analyseButton.click()

    await expect(page).toHaveURL(/\/report\/test-job-123/)
  })

  test('shows error message on upload failure', async ({ page }) => {
    await page.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'File size exceeds 10MB limit' }),
      })
    })

    const upload = new UploadPage(page)
    await upload.goto()
    await upload.uploadCSVContent()
    await upload.analyseButton.click()

    await expect(upload.errorAlert).toBeVisible()
  })
})
