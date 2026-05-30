import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bird, Mail } from 'lucide-react'
import { authClient } from '../lib/auth'
import toast from 'react-hot-toast'

export default function VerifyEmail() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const email = state?.email || ''
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    try {
      const result = await authClient.emailOtp.verifyEmail({ email, otp: code.trim() })
      if (result?.error) throw result.error
      toast.success('Email verified!')
      navigate('/household-setup')
    } catch (err) {
      toast.error(err.message || 'Invalid or expired code')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email) return
    setResending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
      toast.success('New code sent!')
    } catch (err) {
      toast.error(err.message || 'Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-600 rounded-2xl mb-4">
            <Bird className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Snuggle State: Nest</h1>
          <p className="text-slate-500 mt-1">Your household finances, cosy & clear</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
              <Mail className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2 text-center">Check your email</h2>
          <p className="text-slate-500 text-sm text-center mb-6">
            We sent a verification code to{' '}
            <span className="font-medium text-slate-700">{email || 'your email'}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Verification code</label>
              <input
                type="text"
                className="input text-center tracking-widest text-lg font-mono"
                placeholder="Enter code"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Didn't receive it?{' '}
            <button
              onClick={handleResend}
              disabled={resending || !email}
              className="text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
