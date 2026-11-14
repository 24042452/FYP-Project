import Link from 'next/link'
import { notFound } from 'next/navigation'
import { COMING_SOON, allNavItems } from '@/lib/nav'

// Pages that have their own folder (for example /transactions) win over this one.
// This handles the planned-but-unbuilt pages, plus built pages whose task is still to come.

export async function generateMetadata({ params }) {
  const { module } = await params
  const entry = COMING_SOON[module]
  return { title: `${entry?.title ?? 'Page'} · Merchant Portal` }
}

export default async function ModulePage({ params }) {
  const { module } = await params
  const entry = COMING_SOON[module]
  const navItem = allNavItems().find((i) => i.href === `/${module}`)

  if (!entry && !navItem) notFound()

  if (!entry) {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-line bg-white p-6 shadow-panel">
        <h1 className="text-[28px] leading-tight font-bold">{navItem.label}</h1>
        <p className="text-ink-2">This page is being built right now. Please check back soon.</p>
        <Link href="/" className="w-fit font-semibold text-nets-blue-hover">Back to Home</Link>
      </div>
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-xl border border-line bg-white p-6 shadow-panel">
      <span className="w-fit rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">
        Planned for Phase {entry.phase}
      </span>
      <h1 className="text-[28px] leading-tight font-bold">{entry.title}</h1>
      <p className="text-lg text-ink-2">{entry.pitch}</p>
      <p className="text-sm text-ink-3">This part of the portal is not ready yet.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center rounded-lg bg-nets-red px-4 font-semibold text-white no-underline hover:bg-nets-red-hover"
      >
        Back to Home
      </Link>
    </div>
  )
}
