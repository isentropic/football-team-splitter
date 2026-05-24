import { useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { login } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(password)
      onLogin()
    } catch {
      setError('Wrong password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-16 w-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Team Splitter</h1>
          <p className="text-sm text-slate-500">Admin access required</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="password"
              placeholder="Password"
              className="pl-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <Button type="submit" className="w-full h-12" disabled={loading || !password}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
