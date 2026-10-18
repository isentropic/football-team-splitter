import { useEffect, useLayoutEffect, useState } from 'react'
import { CATEGORIES, type AwardConfig, type AwardResults, type Ballot } from '@/lib/awards'
import { authHeaders, isLoggedIn } from '@/lib/auth'
import { LoginScreen } from '@/components/LoginScreen'
import './awards.css'

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data as T
}

export default function AwardsPage({ admin = false }: { admin?: boolean }) {
  const [config, setConfig] = useState<AwardConfig | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [voterId, setVoterId] = useState('')
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [ballot, setBallot] = useState<Ballot>({})
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [results, setResults] = useState<AwardResults | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/awards').then(readResponse<AwardConfig>).then(data => { if (!cancelled) setConfig(data) }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [reload])
  useEffect(() => {
    if (!admin || !loggedIn) return
    let cancelled = false
    fetch('/api/awards-results', { headers: authHeaders(), cache: 'no-store' }).then(readResponse<AwardResults>).then(data => { if (!cancelled) setResults(data) }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [admin, loggedIn, reload])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [started, step, submitted])

  const voter = config?.players.find(p => p.id === voterId)
  const category = CATEGORIES[step]
  const picks = category ? ballot[category.id] ?? [] : []
  const completed = CATEGORIES.filter(c => (ballot[c.id]?.length ?? 0) > 0).length
  const playerName = (id: string) => config?.players.find(p => p.id === id)?.name ?? 'Unknown player'
  const move = (next: number) => { setStep(next); setSearch(''); setError('') }
  const updatePicks = (next: string[]) => setBallot(prev => ({ ...prev, [category.id]: next }))
  const submit = async () => {
    setSubmitting(true); setError('')
    try {
      await fetch('/api/awards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterId, ballot }) }).then(readResponse)
      setSubmitted(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Submission failed. Please try again.') }
    finally { setSubmitting(false) }
  }

  return <div className="awards-shell">
    <header className="awards-header"><a href="/">← Seoul Nomads</a>{admin && <a href="/awards">Voting page</a>}</header>
    <main className="awards-main">
      <div className="awards-eyebrow">SEOUL NOMADS</div>
      <h1>Awards 2026</h1>
      <div className="awards-deadline">Closes October 23 at 11:59 pm · Seoul time</div>
      {error && <div role="alert" className="awards-error">{error}<button onClick={() => { setError(''); setReload(r => r + 1) }}>Retry loading</button></div>}
      {admin ? <>
        <h2 className="awards-section-title">Admin · Results & participation</h2>
        {!loggedIn ? <LoginScreen onLogin={() => { setLoggedIn(true); setError('') }} /> : !results ? <p role="status">Loading results…</p> : <>
          <div className="awards-panel"><h2>{results.submitted} ballots submitted</h2><p>{results.eligible} currently eligible players · Results are visible only to admins.</p><button className="awards-secondary" onClick={() => setReload(r => r + 1)}>Refresh results</button></div>
          <p className="awards-note">3 / 2 / 1 points. Ties: first-place votes, then second-place votes, then a shared rank.</p>
          {CATEGORIES.map(c => {
            const result = results.categories.find(r => r.id === c.id)
            return <section className="awards-panel" key={c.id}><h2>{c.icon} {c.name}</h2><p>{result?.ballots ?? 0} votes in this category</p>
              {!result?.standings.length ? <p>No votes yet.</p> : <div className="awards-table-wrap"><table><thead><tr><th>Rank / player</th><th>Points</th><th>🥇</th><th>🥈</th><th>🥉</th></tr></thead><tbody>{result.standings.map(p => <tr key={p.id}><td>{p.rank === 1 ? '🏆' : p.rank} {p.name}</td><td><strong>{p.points}</strong></td><td>{p.first}</td><td>{p.second}</td><td>{p.third}</td></tr>)}</tbody></table></div>}
            </section>
          })}
          <section className="awards-panel"><h2>Participation</h2>{results.participation.map(p => <div className="awards-participation" key={p.id}><span>{p.name}</span><span>{p.submittedAt ? '✓ Submitted' : 'Awaiting vote'}</span></div>)}</section>
        </>}
      </> : !config ? <p role="status">Loading eligible players…</p> : submitted ? <section className="awards-panel awards-success"><div>🏆</div><h2>Vote submitted</h2><p>Thank you, {voter?.name}. Your ballot is final. Results will be announced by the club.</p><a className="awards-primary" href="/">Back to the club</a></section> : !config.isOpen ? <section className="awards-panel"><h2>Voting is closed</h2><p>Voting runs October 16–23, 2026, Seoul time. Results will be announced by the club.</p></section> : !started ? <>
        <p className="awards-rules">Rank one, two, or three teammates per award: first choice earns 3 points, second earns 2, and third earns 1. You can skip a category. No self-voting. Review your choices before submitting; each player gets one final ballot.</p>
        <section className="awards-panel"><h2>Select your name</h2><p>Open to active players who played in 2026.</p>
          <label className="awards-search">Find your name<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…" type="search" /></label>
          <div className="awards-player-grid">{config.players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} aria-pressed={voterId === p.id} className={`awards-player ${voterId === p.id ? 'selected' : ''}`} onClick={() => setVoterId(p.id)}><span className="awards-avatar">{p.name.slice(0, 1)}</span>{p.name}{voterId === p.id && <span>✓</span>}</button>)}</div>
          {!config.players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).length && <p>No matching players.</p>}
        </section>
        <button className="awards-primary awards-wide" disabled={!voterId} onClick={() => { setStarted(true); setSearch('') }}>Continue as {voter?.name ?? '…'} →</button>
      </> : <>
        <div className="awards-voter"><span>Voting as <strong>{voter?.name}</strong></span><button disabled={submitting} onClick={() => { setStarted(false); setBallot({}); setSearch(''); setStep(0); setError('') }}>Change name</button></div>
        <nav aria-label="Award categories" className="awards-progress">{CATEGORIES.map((c, i) => <button key={c.id} title={c.name} aria-label={`${c.name}${(ballot[c.id]?.length ?? 0) > 0 ? ', complete' : ''}`} aria-current={step === i ? 'step' : undefined} onClick={() => move(i)}>{(ballot[c.id]?.length ?? 0) > 0 ? '✓' : i + 1}</button>)}<button aria-label="Review ballot" aria-current={step === 8 ? 'step' : undefined} onClick={() => move(8)}>☑</button></nav>
        {category ? <>
          <section className="awards-panel"><div className="awards-eyebrow">AWARD {step + 1} OF 8</div><h2 className="awards-category-title">{category.icon} {category.name}</h2><p>{category.description}</p>
            <div className="awards-picks">{[0, 1, 2].map(i => <div key={i} className={`awards-pick ${picks[i] ? 'filled' : ''}`}><span>{['🥇', '🥈', '🥉'][i]}</span><div><small>{['1st · 3 points', '2nd · 2 points', '3rd · 1 point'][i]}</small><strong>{picks[i] ? playerName(picks[i]) : 'Tap a teammate below'}</strong></div>{picks[i] && <div className="awards-pick-actions">{i > 0 && <button aria-label={`Move ${playerName(picks[i])} up`} onClick={() => { const next = [...picks]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; updatePicks(next) }}>↑</button>}<button aria-label={`Remove ${playerName(picks[i])}`} onClick={() => updatePicks(picks.filter(id => id !== picks[i]))}>×</button></div>}</div>)}</div>
            <p className="awards-note" aria-live="polite">{picks.length === 3 ? 'Three choices selected. Use ↑ to change the order.' : picks.length === 0 ? 'Choose up to three teammates, or continue without selecting anyone to skip this category.' : `${picks.length} ${picks.length === 1 ? 'choice' : 'choices'} selected. Continue now, or add another teammate.`}</p>
            <label className="awards-search">Find a teammate<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…" /></label>
            <div className="awards-player-grid">{config.players.filter(p => p.id !== voterId && p.name.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} className={`awards-player ${picks.includes(p.id) ? 'selected' : ''}`} aria-pressed={picks.includes(p.id)} disabled={picks.length === 3 && !picks.includes(p.id)} onClick={() => { updatePicks(picks.includes(p.id) ? picks.filter(id => id !== p.id) : [...picks, p.id]); setSearch('') }}><span className="awards-avatar">{picks.includes(p.id) ? ['🥇', '🥈', '🥉'][picks.indexOf(p.id)] : p.name.slice(0, 1)}</span>{p.name}</button>)}</div>
          </section>
          <div className="awards-navigation"><button className="awards-secondary" onClick={() => step === 0 ? setStarted(false) : move(step - 1)}>← Back</button><button className="awards-primary" onClick={() => move(step + 1)}>{step === 7 ? 'Review ballot' : 'Next award'} →</button></div>
          <button className="awards-skip" onClick={() => { updatePicks([]); move(step + 1) }}>Skip this category{picks.length > 0 ? ' & clear choices' : ''}</button>
        </> : <section className="awards-panel"><h2>Review your ballot</h2><p>{completed} of 8 categories completed. Skipped categories receive no points.</p>
          {CATEGORIES.map((c, i) => <div className="awards-review" key={c.id}><div><strong>{c.icon} {c.name}</strong><p>{(ballot[c.id] ?? []).length ? ballot[c.id].map((id, rank) => <span key={id}>{['🥇', '🥈', '🥉'][rank]} {playerName(id)}<br /></span>) : 'Skipped'}</p></div><button disabled={submitting} onClick={() => move(i)}>Edit</button></div>)}
          <p className="awards-final-warning">By submitting, you confirm that you are {voter?.name}. Your ballot is final and cannot be changed.</p>
          <button className="awards-primary awards-wide" disabled={submitting || completed === 0} onClick={submit}>{submitting ? 'Submitting…' : 'Submit my final ballot'}</button>
        </section>}
      </>}
    </main>
  </div>
}
