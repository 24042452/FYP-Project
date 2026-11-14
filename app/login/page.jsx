import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Log in · Merchant Portal' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Already logged in? Go straight to the portal.
  if (await getSessionUser()) redirect('/')

  // Read on the server so the demo buttons only exist when the demo is switched on.
  const demoMode = process.env.DEMO_MODE === 'true'

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex flex-col gap-4 bg-nets-blue px-5 pt-6 pb-7 text-white lg:gap-8 lg:px-14 lg:py-10">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-white text-[15px] font-extrabold text-nets-red">M</span>
          <span className="text-base font-bold">Merchant Portal</span>
        </div>
        <h1 className="max-w-[16ch] text-[26px] leading-tight font-bold tracking-tight lg:text-[42px]">
          Know where your money is, every day.
        </h1>
        <p className="hidden max-w-[42ch] text-[17px] text-[#D6E2F8] lg:block">
          See your sales from every NETS payment type, check what reaches your bank, and get plain answers to your money questions.
        </p>
      </section>

      <section className="flex items-start justify-center px-5 pt-7 pb-10 lg:items-center lg:px-6 lg:py-10">
        <LoginForm demoMode={demoMode} />
      </section>
    </div>
  )
}
