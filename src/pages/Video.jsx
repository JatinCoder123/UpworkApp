import { useMemo, useState } from 'react'
import { BookmarkSimple, Eye, Heart, MagnifyingGlass, Play, Sparkle, VideoCamera, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'

const categories = ['All', 'AI & Tech', 'Tutorials', 'Marketing', 'Product']

const videos = [
  {
    id: 'ai-workflows',
    title: 'A new era for AI and Google Workspace',
    description: 'See how generative AI can help teams write, organize, collaborate, and move routine work forward.',
    category: 'AI & Tech',
    creator: 'Google Workspace',
    role: 'Product team',
    views: '18.4K',
    duration: '03:15',
    published: '2 hours ago',
    youtubeId: '6DaJVZBXETE',
  },
  {
    id: 'story-edit',
    title: 'Figma for beginners: Explore ideas',
    description: 'Learn the Figma fundamentals while wireframing an app, organizing layers, and exploring early product ideas.',
    category: 'Product',
    creator: 'Figma',
    role: 'Design education',
    views: '9.7K',
    duration: '16:08',
    published: 'Yesterday',
    youtubeId: 'dXQ7IHkTiMM',
  },
  {
    id: 'search-content',
    title: 'HubSpot Marketing Hub tutorial for beginners',
    description: 'A complete introduction to CRM-powered campaigns, email, ads, social publishing, and AI-assisted copywriting.',
    category: 'Marketing',
    creator: 'HubSpot',
    role: 'Marketing education',
    views: '22.1K',
    duration: '38:44',
    published: '3 days ago',
    youtubeId: '68mC70jSbek',
  },
  {
    id: 'motion-basics',
    title: 'Adobe Premiere Pro crash course for beginners',
    description: 'A practical introduction to editing, timelines, essential tools, audio, color, and exporting a finished video.',
    category: 'Tutorials',
    creator: 'Bring Your Own Laptop',
    role: 'Adobe training',
    views: '14.8K',
    duration: '19:33',
    published: '5 days ago',
    youtubeId: 'MqwlW76sFCM',
  },
  {
    id: 'brief-to-video',
    title: 'What is digital marketing? A beginner tutorial',
    description: 'Understand the core channels, customer journey, content strategy, and measurement behind modern digital marketing.',
    category: 'Marketing',
    creator: 'HubSpot',
    role: 'Marketing education',
    views: '7.3K',
    duration: '09:27',
    published: '1 week ago',
    youtubeId: 'XDpwDwcXGoU',
  },
  {
    id: 'prototype-review',
    title: 'Figma tutorial: A crash course for beginners',
    description: 'Follow a hands-on design workflow covering interface tools, layout decisions, reusable components, and prototyping.',
    category: 'Product',
    creator: 'DesignCourse',
    role: 'Design education',
    views: '11.6K',
    duration: '47:58',
    published: '1 week ago',
    youtubeId: 'IOVFRMuPeVQ',
  },
]

const youtubePoster = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

export default function Video() {
  const [selectedId, setSelectedId] = useState(videos[0].id)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(() => new Set())
  const [liked, setLiked] = useState(() => new Set())

  const selected = videos.find((video) => video.id === selectedId) || videos[0]
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return videos.filter((video) =>
      (category === 'All' || video.category === category) &&
      (!query || `${video.title} ${video.description} ${video.creator} ${video.category}`.toLowerCase().includes(query)),
    )
  }, [category, search])

  const toggleSet = (setter, id) => setter((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const selectVideo = (id) => {
    setSelectedId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-9 sm:px-6 md:pt-12">
        <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[var(--muted)]"><VideoCamera size={15} weight="duotone" />Video feed</p>
            <h1 className="mt-4 max-w-3xl text-[clamp(2.8rem,6vw,5.8rem)] font-semibold leading-[.9] tracking-[-.07em]">Ideas worth,<br /><span className="inline-block pb-1 font-serif font-medium italic leading-[1.1]">watching.</span></h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted)]">Tutorials, product stories, and useful ideas selected for focused teams.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--surface)] p-1.5 ring-1 ring-[var(--line)] shadow-[0_12px_36px_rgba(36,49,38,.08)] focus-within:ring-[var(--lime-dark)]">
            <MagnifyingGlass className="ml-3 shrink-0 text-[var(--muted)]" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos" className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none sm:w-56" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear video search" className="grid size-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--paper)]"><X size={12} weight="bold" /></button>}
          </div>
        </header>

        <section className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,.65fr)]">
          <div className="overflow-hidden rounded-[1.8rem] bg-[var(--ink)] p-1.5 shadow-[0_26px_70px_rgba(25,35,27,.18)]">
            <div className="relative overflow-hidden rounded-[calc(1.8rem-.375rem)] bg-black">
              <iframe
                key={selected.id}
                src={`https://www.youtube-nocookie.com/embed/${selected.youtubeId}?rel=0`}
                title={selected.title}
                className="aspect-video w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="grid gap-5 px-5 pb-6 pt-5 text-white sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-white/70"><span className="font-bold text-[var(--lime)]">{selected.category}</span><span>{selected.duration}</span><span>{selected.published}</span></div>
                <h2 className="mt-3 max-w-3xl text-xl font-semibold leading-tight tracking-[-.035em] sm:text-3xl">{selected.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{selected.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <ActionButton active={liked.has(selected.id)} label="Like video" onClick={() => toggleSet(setLiked, selected.id)}><Heart size={17} weight={liked.has(selected.id) ? 'fill' : 'regular'} /></ActionButton>
                <ActionButton active={saved.has(selected.id)} label="Save video" onClick={() => toggleSet(setSaved, selected.id)}><BookmarkSimple size={17} weight={saved.has(selected.id) ? 'fill' : 'regular'} /></ActionButton>
              </div>
            </div>
          </div>

          <aside className="rounded-[1.8rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--line)]/70 sm:p-5">
            <div className="flex items-center justify-between"><div><p className="text-sm font-bold">Up next</p><p className="mt-1 text-xs font-medium text-[var(--muted)]">Continue exploring</p></div><Sparkle size={17} className="text-[var(--accent-strong)]" weight="duotone" /></div>
            <div className="mt-5 grid gap-3">
              {videos.filter((video) => video.id !== selected.id).slice(0, 3).map((video, index) => <button type="button" key={video.id} onClick={() => selectVideo(video.id)} className="group grid grid-cols-[7.5rem_1fr] gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-[var(--paper)] sm:grid-cols-[9rem_1fr] lg:grid-cols-[7.5rem_1fr]">
                <span className="relative aspect-video overflow-hidden rounded-xl bg-[var(--ink)]"><img src={youtubePoster(video.youtubeId)} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute inset-0 bg-black/10" /><span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white">{video.duration}</span>{index === 0 && <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-[var(--lime)] text-[#26320b]"><Play size={9} weight="fill" /></span>}</span>
                <span className="min-w-0 py-1"><span className="line-clamp-2 text-sm font-semibold leading-5">{video.title}</span><span className="mt-2 block truncate text-[11px] font-semibold text-[var(--muted)]">{video.creator}</span><span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]"><Eye size={12} />{video.views} views</span></span>
              </button>)}
            </div>
          </aside>
        </section>

        <section className="mt-14">
          <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Discover videos</h2><p className="mt-2 text-xs text-[var(--muted)]">{filtered.length} videos in this view</p></div>
            <div className="flex gap-1 overflow-x-auto rounded-full bg-[var(--surface)] p-1 ring-1 ring-[var(--line)]/60">
              {categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold transition-all ${category === item ? 'bg-[var(--lime)] !text-[#26320b] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}</button>)}
            </div>
          </div>

          {filtered.length ? <div className="mt-7 grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((video) => <VideoTile key={video.id} video={video} selected={video.id === selected.id} saved={saved.has(video.id)} onSelect={selectVideo} onSave={() => toggleSet(setSaved, video.id)} />)}
          </div> : <div className="py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--line)]"><VideoCamera size={22} /></span><h3 className="mt-5 text-xl font-semibold">No videos found</h3><p className="mt-2 text-sm text-[var(--muted)]">Try another category or search phrase.</p></div>}
        </section>
      </main>
    </Shell>
  )
}

function ActionButton({ active, label, onClick, children }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={`grid size-10 place-items-center rounded-full ring-1 transition-all active:scale-95 ${active ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime)]' : 'bg-white/10 text-white ring-white/10 hover:bg-white/15'}`}>{children}</button>
}

function VideoTile({ video, selected, saved, onSelect, onSave }) {
  return <article className="group min-w-0">
    <div className={`relative overflow-hidden rounded-[1.35rem] bg-[var(--ink)] ring-1 transition-all duration-500 ${selected ? 'ring-[var(--lime-dark)] shadow-[0_18px_42px_rgba(80,106,43,.18)]' : 'ring-[var(--line)]/70'}`}>
      <img src={youtubePoster(video.youtubeId)} alt="" className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <button type="button" onClick={() => onSelect(video.id)} aria-label={`Play ${video.title}`} className="absolute inset-0 grid place-items-center"><span className="grid size-12 translate-y-2 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] opacity-0 shadow-[0_12px_35px_rgba(0,0,0,.24)] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"><Play size={17} weight="fill" /></span></button>
      <span className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-md">{video.duration}</span>
      {selected && <span className="absolute left-3 top-3 rounded-lg bg-[var(--lime)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#26320b]">Playing</span>}
    </div>
    <div className="mt-4 flex gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[11px] font-bold text-white">{video.creator.split(' ').map((word) => word[0]).join('')}</div>
      <div className="min-w-0 flex-1"><button type="button" onClick={() => onSelect(video.id)} className="line-clamp-2 text-left text-base font-semibold leading-5 tracking-[-.015em] hover:text-[var(--accent-strong)]">{video.title}</button><p className="mt-2 truncate text-xs font-semibold text-[var(--muted)]">{video.creator} · {video.role}</p><p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"><Eye size={13} />{video.views} views · {video.published}</p></div>
      <button type="button" onClick={onSave} aria-label={saved ? 'Remove saved video' : 'Save video'} aria-pressed={saved} className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${saved ? 'bg-[var(--lime)] !text-[#26320b]' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'}`}><BookmarkSimple size={15} weight={saved ? 'fill' : 'regular'} /></button>
    </div>
  </article>
}
