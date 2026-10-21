import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleNotch, Trash } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import ComingSoon from './ComingSoon'
import NotFound from './NotFound'
import SessionLoader from '../components/SessionLoader'
import { useAuth } from '../contexts/AuthContext'
import { canDeleteFeed, useDeleteFeed, useFeeds } from '../lib/feeds'
import { homePath } from '../lib/permissions'

/**
 * A custom feed (/feeds/:id): a Coming Soon page with its description, until the feed is connected to an endpoint that
 * takes the description as its prompt and returns the content to show. The creator and admins can delete it.
 */
export default function CustomFeed() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: feeds = [], isLoading, error, refetch } = useFeeds(user)
  const remove = useDeleteFeed()
  const [confirming, setConfirming] = useState(false)
  const feed = feeds.find((item) => item.id === id)

  if (isLoading) return <SessionLoader />
  if (error) return <Shell>
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 md:pt-8">
      <p role="alert" className="rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">This feed could not be loaded: {error.message} <button type="button" onClick={() => refetch()} className="ml-2 underline">Try again</button></p>
    </main>
  </Shell>
  if (!feed) return <NotFound />

  const deleteFeed = () => remove.mutate(feed.id, { onSuccess: () => navigate(homePath(user), { replace: true }) })

  return <ComingSoon title={feed.name} description={feed.description || `The ${feed.name} feed is being prepared.`}>
    <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-[var(--line)] pt-5 text-[11px] text-[var(--muted)]">
      <span>Created{feed.userName ? ` by ${feed.userName}` : ''}{feed.createdAgo ? ` · ${feed.createdAgo}` : ''}</span>
      {canDeleteFeed(user, feed) && (confirming
        ? <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-[var(--bad)]">Delete this feed for everyone?</span>
          <button type="button" onClick={deleteFeed} disabled={remove.isPending} className="inline-flex items-center gap-1 rounded-full bg-[var(--bad)] px-3 py-1 font-bold text-white disabled:opacity-60">{remove.isPending && <CircleNotch size={11} className="animate-spin" />}Delete</button>
          <button type="button" onClick={() => setConfirming(false)} disabled={remove.isPending} className="rounded-full px-2 py-1 font-semibold hover:text-[var(--ink)]">Cancel</button>
        </span>
        : <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold transition-colors hover:bg-[var(--bad-bg)] hover:text-[var(--bad)]"><Trash size={12} />Delete feed</button>)}
      {remove.error && <span role="alert" className="w-full font-semibold text-[var(--bad)]">{remove.error.message || 'The feed could not be deleted.'}</span>}
    </div>
  </ComingSoon>
}
