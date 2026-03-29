import { type Page, type Locator, expect } from '@playwright/test'
import path from 'path'

export class UploadPage {
  readonly page: Page
  readonly heading: Locator
  readonly dropZone: Locator
  readonly fileInput: Locator
  readonly analyseButton: Locator
  readonly backButton: Locator
  readonly errorAlert: Locator
  readonly privacyNotice: Locator
  readonly progressBar: Locator

  constructor(page: Page) {
    this.page         = page
    this.heading      = page.getByRole('heading', { name: /upload your bank statement/i })
    this.dropZone     = page.getByRole('button', { name: /upload bank statement/i })
    this.fileInput    = page.getByLabel('Bank Statement')
    this.analyseButton = page.getByRole('button', { name: /start analysis/i })
    this.backButton   = page.getByRole('button', { name: /back/i })
    this.errorAlert   = page.getByRole('alert')
    this.privacyNotice = page.getByText(/processed in memory/i)
    this.progressBar  = page.getByRole('progressbar')
  }

  async goto() {
    await this.page.goto('/upload')
  }

  async uploadFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath)
  }

  async uploadCSVContent(filename = 'statement.csv') {
    await this.fileInput.setInputFiles({
      name: filename,
      mimeType: 'text/csv',
      buffer: Buffer.from('date,description,amount\n2024-07-15,Officeworks,89.95\n2024-07-20,CPA Australia,549.00'),
    })
  }

  async uploadPDFContent(filename = 'statement.pdf') {
    await this.fileInput.setInputFiles({
      name: filename,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fake pdf content'),
    })
  }

  async expectFileSelected(filename: string) {
    await expect(this.page.getByText(filename)).toBeVisible()
    await expect(this.analyseButton).toBeEnabled()
  }

  async expectError(message: string | RegExp) {
    await expect(this.errorAlert).toContainText(message)
  }

  async expectAnalyseDisabled() {
    await expect(this.analyseButton).toBeDisabled()
  }
}
