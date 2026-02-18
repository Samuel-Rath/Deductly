import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Landing from './Landing'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Landing Page', () => {
  it('renders hero section with headline', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText(/Turn your bank CSV into an evidence-ready deduction report/i)).toBeInTheDocument()
  })

  it('renders trust strip with privacy, explainability, and income year', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByText('Explainability')).toBeInTheDocument()
    expect(screen.getByText('Australian Income Year')).toBeInTheDocument()
  })

  it('renders how it works section with three steps', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Classify')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('renders example report preview', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    expect(screen.getByText('Example report preview')).toBeInTheDocument()
    expect(screen.getByText('LIKELY DEDUCTIBLE')).toBeInTheDocument()
    expect(screen.getByText('NEEDS REVIEW')).toBeInTheDocument()
    expect(screen.getByText('EXCLUDED')).toBeInTheDocument()
  })

  it('navigates to upload page when CTA button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )

    const uploadButton = screen.getAllByText('Upload CSV')[0]
    await user.click(uploadButton)

    expect(mockNavigate).toHaveBeenCalledWith('/upload')
  })
})
