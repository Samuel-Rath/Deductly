import { AnimatedSection, Card } from '../components'
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

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-body text-slate-300 list-disc list-inside">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-4 bg-ink-800 border border-line-700 rounded-lg">
      <p className="text-small text-slate-300">{children}</p>
    </div>
  )
}

export default function Terms() {
  return (
    <div className="pt-20 sm:pt-24 container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <AnimatedSection className="mb-8">
          <h1 className="font-display text-h1 font-semibold text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-body text-slate-400">
            Effective {EFFECTIVE_DATE} &nbsp;&mdash;&nbsp; Please read these terms carefully before using Deductly.
          </p>
        </AnimatedSection>

        {/* 1. Acceptance */}
        <Section delay={0.05} title="1. Acceptance of Terms">
          <P>
            By accessing or using Deductly (the &ldquo;Service&rdquo;), you agree to be bound by
            these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to all of these Terms,
            do not use the Service.
          </P>
          <P>
            These Terms constitute a legally binding agreement between you and the operators of
            Deductly (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). We reserve the
            right to modify these Terms at any time. Continued use of the Service after any changes
            constitutes your acceptance of the updated Terms.
          </P>
        </Section>

        {/* 2. Not Tax Advice */}
        <Section delay={0.1} title="2. Not Tax or Financial Advice">
          <div className="p-4 bg-amber-950/40 border border-amber-700/50 rounded-lg">
            <p className="text-small font-semibold text-amber-300 mb-1">Important disclaimer</p>
            <p className="text-small text-amber-200/80 leading-relaxed">
              Deductly is a transaction classification tool, not a tax agent, financial adviser,
              or accountant. Nothing produced by the Service constitutes tax advice, legal advice,
              or financial advice of any kind.
            </p>
          </div>
          <P>
            The Service uses automated pattern matching and keyword analysis to identify
            <em> potentially</em> deductible transactions under Australian Taxation Office (ATO)
            guidelines. Classifications are indicative only. We make no representation that any
            item identified by the Service is deductible in your specific circumstances.
          </P>
          <P>
            You are solely responsible for verifying the deductibility of any expense and for
            lodging an accurate tax return. We strongly recommend consulting a registered tax agent
            before making any claim.
          </P>
        </Section>

        {/* 3. Description of Service */}
        <Section delay={0.15} title="3. Description of Service">
          <P>
            Deductly allows you to upload Australian bank transaction files (CSV or PDF format)
            and receive an automated analysis identifying transactions that may be deductible
            work-related expenses under Australian tax law. The Service produces reports in PDF,
            CSV, and JSON formats for your personal use.
          </P>
          <Ul items={[
            'The Service is intended for Australian tax residents only.',
            'The Service is designed for individual (personal) tax return preparation assistance.',
            'The Service does not lodge tax returns or interact with the ATO on your behalf.',
            'The Service does not provide accounting, bookkeeping, or business tax services.',
          ]} />
        </Section>

        {/* 4. Acceptable Use */}
        <Section delay={0.2} title="4. Acceptable Use">
          <P>You agree to use the Service only for lawful purposes and in a way that does not infringe the rights of others. You must not:</P>
          <Ul items={[
            'Upload files containing data belonging to another person without their explicit consent.',
            'Attempt to reverse-engineer, decompile, or tamper with the Service.',
            'Use automated tools (bots, scrapers) to access the Service at scale.',
            'Attempt to circumvent any security or rate-limiting measures.',
            'Use the Service for any fraudulent, unlawful, or misleading purpose.',
            'Upload files containing malicious code or content designed to disrupt the Service.',
          ]} />
          <Note>
            Violation of these terms may result in suspension of access and, where appropriate,
            referral to relevant authorities.
          </Note>
        </Section>

        {/* 5. Data and Privacy */}
        <Section delay={0.25} title="5. Data and Privacy">
          <P>
            Your use of the Service is also governed by our{' '}
            <Link to="/privacy" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference.
          </P>
          <P>
            By uploading a file you represent and warrant that:
          </P>
          <Ul items={[
            'You are the account holder or have explicit authorisation to share the transaction data.',
            'The data does not contain sensitive information belonging to third parties (e.g. joint account holders) without their consent.',
            'You understand that the Service processes your data in memory and does not retain it after your session ends.',
          ]} />
        </Section>

        {/* 6. Accuracy and Limitations */}
        <Section delay={0.3} title="6. Accuracy and Limitations">
          <P>
            The Service relies on pattern matching against known merchant names, keywords, and
            ATO category rules. Classification accuracy depends on the quality and completeness
            of your bank export file. We cannot guarantee:
          </P>
          <Ul items={[
            'That all deductible transactions will be identified (false negatives).',
            'That all identified transactions are in fact deductible (false positives).',
            'That the Service accounts for your specific employment circumstances or income type.',
            'That the ATO rules encoded in the Service reflect the most current ATO guidance.',
          ]} />
          <P>
            Always review every item in the report with your tax agent before lodgement.
          </P>
        </Section>

        {/* 7. Intellectual Property */}
        <Section delay={0.35} title="7. Intellectual Property">
          <P>
            The Service, including its underlying classification rules, software, and user
            interface, is the intellectual property of the operators of Deductly. These Terms
            do not transfer any intellectual property rights to you.
          </P>
          <P>
            Reports generated by the Service from your data are yours to use for your personal
            tax preparation. You may share them with your registered tax agent.
          </P>
        </Section>

        {/* 8. Disclaimer of Warranties */}
        <Section delay={0.4} title="8. Disclaimer of Warranties">
          <P>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
            warranties of any kind, whether express or implied, including but not limited to
            implied warranties of merchantability, fitness for a particular purpose, or
            non-infringement.
          </P>
          <P>
            We do not warrant that the Service will be uninterrupted, error-free, or free of
            viruses or other harmful components. We do not warrant that any results obtained from
            the Service will be accurate or reliable.
          </P>
        </Section>

        {/* 9. Limitation of Liability */}
        <Section delay={0.45} title="9. Limitation of Liability">
          <P>
            To the maximum extent permitted by applicable law, in no event shall Deductly or its
            operators be liable for any indirect, incidental, special, consequential, or punitive
            damages, including but not limited to:
          </P>
          <Ul items={[
            'Tax penalties, interest, or amendments arising from reliance on the Service output.',
            'Loss of data or inability to access your report.',
            'Any costs of engaging a tax professional to review or correct a return.',
            'Any other losses resulting from use of or inability to use the Service.',
          ]} />
          <Note>
            <span className="font-semibold text-white">Australian Consumer Law:</span> Nothing in
            these Terms excludes, restricts, or modifies any right or remedy, or any guarantee,
            warranty, or other term or condition, implied or imposed by the Australian Consumer
            Law that cannot be lawfully excluded or limited.
          </Note>
        </Section>

        {/* 10. Governing Law */}
        <Section delay={0.5} title="10. Governing Law">
          <P>
            These Terms are governed by the laws of Australia. Any dispute arising in connection
            with these Terms or the Service shall be subject to the exclusive jurisdiction of the
            courts of Australia.
          </P>
        </Section>

        {/* 11. Changes to Service */}
        <Section delay={0.55} title="11. Changes to the Service">
          <P>
            We reserve the right to modify, suspend, or discontinue any aspect of the Service at
            any time without notice. We are not liable to you or any third party for any
            modification, suspension, or discontinuation of the Service.
          </P>
        </Section>

        {/* 12. Contact */}
        <Section delay={0.6} title="12. Contact">
          <P>
            If you have questions about these Terms, please raise an issue on our{' '}
            <span className="text-slate-300 font-medium">GitHub repository</span> or contact us
            through the support channels listed there.
          </P>
          <div className="pt-2 border-t border-line-700">
            <p className="text-small text-slate-500">
              Last updated: {EFFECTIVE_DATE}. Previous versions are available in the
              repository commit history.
            </p>
          </div>
        </Section>

      </div>
    </div>
  )
}
