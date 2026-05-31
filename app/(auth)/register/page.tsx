'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface FormErrors {
  email?: string[]
  password?: string[]
}

export default function RegisterPage() {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})

  async function handleRegister(prevState: any, formData: FormData) {
    setErrorMsg(null)
    setFieldErrors({})

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setFieldErrors({
        password: ['Passwords do not match'],
      })
      return
    }

    try {
      const res = await fetch('/api/auth/register', {
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

  const [state, action, isPending] = useActionState(handleRegister, null)

  return (
    <main className="auth-container">
      <div className="auth-sidebar">
        <div className="auth-brand">
          <div className="brand-logo">⊙ VAULT</div>
          <h1>Create an archive.</h1>
          <p>Begin preserving your stories and media.</p>
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={isPending}>
            {isPending ? 'Archiving...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="auth-display">
        <div className="auth-display-decor">
          <div className="decor-frame">
            <div className="decor-inner-frame">
              <span className="decor-plus">+</span>
            </div>
          </div>
          <div className="decor-metadata">
            <div className="metadata-line">
              <span className="label">CATALOGUE</span>
              <span className="value">NO. 8163</span>
            </div>
            <div className="metadata-line">
              <span className="label">EXPOSURE</span>
              <span className="value">f/1.4 1/125s ISO 200</span>
            </div>
            <div className="metadata-line">
              <span className="label">PRESERVATION</span>
              <span className="value">SEALED / SECURE</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
