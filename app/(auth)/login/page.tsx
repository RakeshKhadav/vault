'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface FormErrors {
  email?: string[]
  password?: string[]
}

export default function LoginPage() {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})

  async function handleLogin(prevState: any, formData: FormData) {
    setErrorMsg(null)
    setFieldErrors({})

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          setFieldErrors(data.errors)
        } else {
          setErrorMsg(data.message || 'Something went wrong. Please try again.')
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setErrorMsg('Failed to connect to the server.')
    }
  }

  const [state, action, isPending] = useActionState(handleLogin, null)

  return (
    <main className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-logo">🛡️</div>
          <h1>Welcome back to Vault</h1>
          <p>Access your personal secure media store</p>
        </div>

        {errorMsg && (
          <div className="auth-alert error">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form action={action} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              className={fieldErrors.email ? 'input-error' : ''}
            />
            {fieldErrors.email && (
              <span className="error-text">{fieldErrors.email[0]}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className={fieldErrors.password ? 'input-error' : ''}
            />
            {fieldErrors.password && (
              <span className="error-text">{fieldErrors.password[0]}</span>
            )}
          </div>

          <button type="submit" className="btn-submit" disabled={isPending}>
            {isPending ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link href="/register" className="auth-link">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
