import { AnimatedSection, Card, Icon } from '../components'
import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '8 April 2025'

function Section({
  delay,
  title,
  children,
}: {
  delay: number
  title: string
  children: React.ReactNode
}) {
  return (
    <AnimatedSection delay={delay}>
      <Card className="mb-6">
        <div className="space-y-3">
          <h2 className="text-h2 font-semibold text-white">{title}</h2>
          {children}
        </div>
      </Card>
    </AnimatedSection>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-slate-300 leading-relaxed">{children}</p>
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 text-body text-slate-300 list-disc list-inside">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function Note({
  children,
  highlight,
}: {
  children: React.ReactNode
  highlight?: boolean
}) {
  return highlight ? (
    <div className="mt-3 p-4 bg-accent bg-opacity-10 border border-accent rounded-lg">
      <p className="text-small text-white">{children}</p>
    </div>
  ) : (
    <div className="mt-3 p-4 bg-ink-800 border border-line-700 rounded-lg">
      <p className="text-small text-slate-300">{children}</p>
    </div>
  )
}

function CheckItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start space-x-3">
      <div className="w-6 h-6 rounded-full bg-accent bg-opacity-20 flex items-center justify-center mt-0.5 flex-shrink-0">
        <Icon name="Check" size={14} className="text-accent" />
      </div>
      <div>
        <div className="text-small font-semibold text-white">{title}</div>
        <div className="text-small text-slate-300">{body}</div>
      </div>
    </div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex items-start space-x-4">
      <div className="w-8 h-8 rounded-full bg-ink-800 border border-line-700 flex items-center justify-center flex-shrink-0">
        <span className="text-small font-semibold text-white">{n}</span>
      </div>
      <div>
        <div className="text-small font-semibold text-white">{title}</div>
        <div className="text-small text-slate-300">{body}</div>
      </div>
    </div>
  )
}

export default function Privacy() {
  return (
    <div className="pt-20 sm:pt-24 container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <AnimatedSection className="mb-8">
          <h1 className="font-display text-h1 font-semibold text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-body text-slate-400">
            Effective {EFFECTIVE_DATE} &nbsp;&mdash;&nbsp; How Deductly collects, uses, and
            protects your information.
          </p>
        </AnimatedSection>

        {/* 1. Overview */}
        <Section delay={0.05} title="1. Overview">
          <P>
            Deductly is a privacy-first tax deduction analysis tool. We are committed to handling
            your financial data with the highest degree of care. This Privacy Policy explains what
            data we process, how we process it, and the protections we have in place.
          </P>
          <P>
            This policy applies to all users of the Deductly web application. By using the
            Service you agree to the practices described here. Our use of data is also subject
            to our{' '}
            <Link to="/terms" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors">
              Terms of Service
            </Link>
            .
          </P>
          <Note highlight>
            <span className="font-semibold">Core commitment:</span> Your raw financial data is
            never written to disk, never stored in a database, and is discarded as soon as your
            report is generated. We do not sell, share, or monetise your data in any form.
          </Note>
        </Section>

        {/* 2. What data we process */}
        <Section delay={0.1} title="2. What Data We Process">
          <P>
            When you upload a bank export file, the following transaction fields are processed
            in memory:
          </P>
          <Ul items={[
            'Transaction dates',
            'Transaction descriptions (as exported by your bank)',
            'Transaction amounts (debits and credits)',
            'Merchant names derived from descriptions',
          ]} />
          <Note>
            <span className="font-semibold text-white">What we do not process:</span> We do not
            process or store your name, address, email address, account numbers, BSB codes, or
            any tax file number (TFN). If any of these appear in a transaction description, they
            are automatically redacted before any further processing.
          </Note>
        </Section>

        {/* 3. Ephemeral mode */}
        <Section delay={0.15} title="3. Ephemeral Mode — No Data Retention">
          <P>
            The Service operates exclusively in <strong className="text-white">ephemeral mode</strong>.
            This is not an option you toggle — it is the only mode of operation.
          </P>
          <div className="space-y-3 mt-2">
            <CheckItem
              title="No persistent storage"
              body="Your transaction data is never saved to a database or any file system."
            />
            <CheckItem
              title="Memory-only processing"
              body="All classification and analysis runs in RAM and is discarded when complete."
            />
            <CheckItem
              title="Report generated then deleted"
              body="Your PDF/CSV/JSON report is assembled for immediate download, then removed from the server."
            />
            <CheckItem
              title="No session linking"
              body="We do not use cookies or session identifiers to link separate uploads together."
            />
          </div>
          <Note highlight>
            <span className="font-semibold">Ephemeral mode cannot be disabled.</span> Your
            financial data should never leave your session, and ours doesn&rsquo;t.
          </Note>
        </Section>

        {/* 4. How we process your data */}
        <Section delay={0.2} title="4. How We Process Your Data">
          <P>Your file passes through the following steps, all in memory:</P>
          <div className="space-y-4 mt-2">
            <Step n={1} title="Normalisation"
              body="The CSV or PDF is parsed and transaction fields are standardised. Merchant names are extracted from raw descriptions." />
            <Step n={2} title="Redaction"
              body="Account numbers, BSB codes, card numbers, and other patterns matching personally identifiable information are masked before any further processing." />
            <Step n={3} title="Exclusion"
              body="Transfers between accounts, ATM withdrawals, loan repayments, and salary credits are filtered out — they are not deductible." />
            <Step n={4} title="Classification"
              body="Remaining transactions are matched against ATO deduction categories using keyword rules and confidence scoring. No external AI API is called." />
            <Step n={5} title="Report generation"
              body="A report is assembled with deduction candidates, confidence ratings, evidence requirements, and ATO guidance. The report is made available for download." />
            <Step n={6} title="Deletion"
              body="All in-memory data, including the generated report files, is discarded after your download window closes." />
          </div>
          <Note>
            <span className="font-semibold text-white">Audit trail:</span> The JSON audit trail
            download documents every classification decision so you can verify how each
            transaction was handled.
          </Note>
        </Section>

        {/* 5. Automatic redaction */}
        <Section delay={0.25} title="5. Automatic Redaction">
          <P>
            Before any analysis, the following patterns are automatically detected and masked
            in transaction descriptions:
          </P>
          <div className="space-y-2 mt-2">
            {[
              { title: 'Account numbers & BSB codes', body: 'Six-digit BSB codes and linked account numbers are replaced with [REDACTED].' },
              { title: 'Card numbers', body: 'Partial or full card number patterns (e.g. **** 1234) are masked.' },
              { title: 'Reference numbers', body: 'Long numeric reference strings that may identify your account are truncated.' },
            ].map(({ title, body }) => (
              <div key={title} className="p-3 bg-ink-800 rounded-lg">
                <div className="text-small font-semibold text-white mb-0.5">{title}</div>
                <div className="text-small text-slate-300">{body}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. Third-party services */}
        <Section delay={0.3} title="6. Third-Party Services">
          <P>
            Deductly does not integrate with any third-party analytics, advertising, or tracking
            services. We do not use Google Analytics, Facebook Pixel, or similar tools.
          </P>
          <P>
            The Service may be hosted on a cloud infrastructure provider (such as Render or
            Railway). Your data passes through their servers in transit but is not persisted.
            These providers are bound by their own privacy and security policies.
          </P>
          <Note>
            For maximum privacy, you can run Deductly entirely on your own machine. See the
            GitHub repository for self-hosting instructions.
          </Note>
        </Section>

        {/* 7. Cookies and tracking */}
        <Section delay={0.35} title="7. Cookies and Tracking">
          <P>
            Deductly does not use cookies, local storage, or any tracking technology to identify
            individual users or link sessions together. No persistent identifiers are stored in
            your browser.
          </P>
          <P>
            Standard web server access logs (IP address, request path, timestamp) may be retained
            for up to 30 days for security and diagnostic purposes, then deleted. These logs
            cannot be linked to your uploaded data.
          </P>
        </Section>

        {/* 8. Your rights */}
        <Section delay={0.4} title="8. Your Rights">
          <P>
            Because we do not retain personal data after your session, most data subject rights
            (access, correction, erasure) are satisfied automatically — there is simply no data
            to retrieve, correct, or delete.
          </P>
          <P>
            If you believe we have inadvertently retained personal data about you, please contact
            us via the GitHub repository and we will investigate promptly.
          </P>
          <P>
            Australian users have rights under the <em>Privacy Act 1988</em> (Cth) and the
            Australian Privacy Principles (APPs). If you have a privacy concern that is not
            resolved to your satisfaction, you may contact the Office of the Australian
            Information Commissioner (OAIC) at{' '}
            <span className="text-slate-300 font-medium">oaic.gov.au</span>.
          </P>
        </Section>

        {/* 9. Security */}
        <Section delay={0.45} title="9. Security">
          <P>
            We implement the following measures to protect your data in transit and during
            processing:
          </P>
          <Ul items={[
            'All data is transmitted over HTTPS/TLS.',
            'Uploaded files are processed in an isolated request context.',
            'No data is written to disk at any point during processing.',
            'Server access is restricted and monitored.',
          ]} />
          <Note>
            No system is completely secure. We encourage you to use the self-hosted version for
            sensitive data and to review the open-source code to verify our claims.
          </Note>
        </Section>

        {/* 10. Children */}
        <Section delay={0.5} title="10. Children's Privacy">
          <P>
            The Service is not directed at children under the age of 18. We do not knowingly
            process data from children. If you believe a child has used the Service, please
            contact us.
          </P>
        </Section>

        {/* 11. Changes */}
        <Section delay={0.55} title="11. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. When we do, we will update the
            effective date at the top of this page. Continued use of the Service after changes
            are posted constitutes your acceptance of the revised policy.
          </P>
          <P>
            Previous versions of this policy are available in the GitHub repository commit history.
          </P>
        </Section>

        {/* 12. Contact */}
        <Section delay={0.6} title="12. Contact">
          <P>
            For privacy-related questions or concerns, please open an issue on our GitHub
            repository. We aim to respond within 5 business days.
          </P>
          <div className="pt-2 border-t border-line-700">
            <p className="text-small text-slate-500">
              Last updated: {EFFECTIVE_DATE}
            </p>
          </div>
        </Section>

      </div>
    </div>
  )
}
