// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// The real actions are server actions; the form only needs something to call.
vi.mock('@/app/login/actions', () => ({ signIn: vi.fn(), signInAsDemo: vi.fn() }))

import { LoginForm } from '@/app/login/LoginForm'

afterEach(cleanup)

describe('LoginForm demo buttons (TC-AUTH-03)', () => {
  it('shows the "Try as" buttons when demo mode is on', () => {
    render(<LoginForm demoMode={true} />)
    expect(screen.getByRole('button', { name: /Try as Ah Hock Chicken Rice/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Try as Tan & Sons Retail/ })).toBeTruthy()
  })

  it('shows no demo buttons when demo mode is off, only the normal form', () => {
    render(<LoginForm demoMode={false} />)
    expect(screen.queryByRole('button', { name: /Try as/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy()
  })
})
