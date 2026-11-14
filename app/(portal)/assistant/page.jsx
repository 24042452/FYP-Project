import Link from 'next/link'

export const metadata = { title: 'Ask NETS Assistant · Merchant Portal' }

// Placeholder: Task 12 builds the real assistant.
export default function AssistantPage() {
  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-xl border border-line bg-white p-6 shadow-panel">
      <h1 className="text-[28px] leading-tight font-bold">Ask NETS Assistant</h1>
      <p className="text-lg text-ink-2">The NETS Assistant is coming in the next step.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center rounded-lg bg-nets-red px-4 font-semibold text-white no-underline hover:bg-nets-red-hover"
      >
        Back to Home
      </Link>
    </div>
  )
}
