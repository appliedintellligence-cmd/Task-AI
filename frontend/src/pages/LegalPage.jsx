import { Link } from 'react-router-dom'

const updated = '15 August 2026'

const content = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What Task AI collects', 'We collect your email address, selected Australian jurisdiction, repair photos you choose to upload, chat messages, diagnoses, and saved repair history. We do not request your precise location or access your microphone.'],
      ['How we use it', 'We use this information to authenticate your account, analyse visible repair damage, provide safety-aware guidance, save your history, operate the service, prevent abuse, and respond to support requests.'],
      ['AI and service providers', 'Repair photos and related prompts are processed on our behalf by infrastructure and AI providers, which may include Supabase, Render, Google AI, Groq, OpenRouter, and Replicate. We disclose this before the first photo analysis and only process a photo after you choose Continue. Providers are used to operate Task AI, not to advertise to you.'],
      ['Storage and security', 'Account data is stored with Supabase. New repair photos are kept in private storage and accessed through short-lived signed links. Network requests use encrypted HTTPS connections. No online service can guarantee absolute security.'],
      ['Retention and deletion', 'We retain account data while your account is active. You can permanently delete your account and associated saved photos, diagnoses, profile, and chat history from Settings in the Task AI app. Some limited records may be retained where law requires it.'],
      ['Your choices', 'You can decline camera or photo access and choose not to submit a repair photo. You can revoke device permissions in iOS Settings. You can request support or exercise applicable privacy rights by contacting us.'],
      ['Contact', 'Privacy questions can be sent to nithila.nagu@gmail.com.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    sections: [
      ['Safety first', 'Task AI provides general, AI-assisted information and is not a substitute for a qualified tradesperson, engineer, emergency service, legal advice, or an on-site inspection. Stop and contact an appropriate professional whenever conditions are unsafe, unclear, regulated, structural, electrical, gas-related, or otherwise beyond your competence.'],
      ['No guarantee', 'AI output can be incomplete or incorrect. You are responsible for checking instructions, product directions, local laws, permits, and site conditions before acting. Do not rely on Task AI where delay or error could cause injury or property damage.'],
      ['Your content', 'You must have the right to upload submitted photos and content. Do not upload personal, confidential, unlawful, or third-party material that is unnecessary for a repair assessment.'],
      ['Acceptable use', 'Do not misuse the service, attempt unauthorized access, interfere with operation, or use Task AI to facilitate unsafe or unlawful work.'],
      ['Accounts and availability', 'Keep your credentials secure. You may delete your account in the app. Features may change or be unavailable, and we may restrict abusive use.'],
      ['Contact', 'Questions about these terms can be sent to nithila.nagu@gmail.com.'],
    ],
  },
  support: {
    title: 'Task AI Support',
    sections: [
      ['Get help', 'For account, login, privacy, or product support, email nithila.nagu@gmail.com. Include the device model, iOS version, and a description of the problem, but do not email passwords, access tokens, or sensitive repair photos.'],
      ['Account deletion', 'Open Task AI, sign in, and choose Settings → Delete account. This permanently removes the account and its associated saved content.'],
      ['Safety emergencies', 'Task AI support is not an emergency or trade service. If there is immediate danger, leave the area and contact Australian emergency services on 000 or the relevant licensed professional.'],
    ],
  },
}

export default function LegalPage({ type }) {
  const page = content[type]
  return (
    <main className="min-h-screen bg-[#f7f3e9] px-5 py-12 text-[#102f36]">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm sm:p-12">
        <Link className="font-bold text-[#b95320]" to="/">← Task AI</Link>
        <h1 className="mt-8 text-4xl font-black">{page.title}</h1>
        <p className="mt-2 text-sm text-[#607176]">Effective and last updated: {updated}</p>
        <div className="mt-10 space-y-8">
          {page.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-xl font-black">{heading}</h2>
              <p className="mt-2 leading-7 text-[#52676a]">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}
