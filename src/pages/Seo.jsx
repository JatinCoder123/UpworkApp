import { useMemo, useState } from 'react'
import { ArrowUpRight, BookmarkSimple, Clock, MagnifyingGlass, Newspaper, TrendUp, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import HScroll from '../components/HScroll'

const topics = ['All', 'AI Search', 'Technical SEO', 'Content', 'Data & Studies']

const articles = [
  {
    id: 'query-fan-out',
    title: 'How ChatGPT does query fan-out across 15 million searches',
    excerpt: 'A large-scale study reveals when AI systems search, which sources they prefer, and what brands should publish to earn visibility.',
    topic: 'AI Search',
    author: 'Louise Linehan',
    source: 'Ahrefs',
    date: 'Oct 12, 2026',
    readTime: '14 min',
    url: 'https://ahrefs.com/blog/query-fan-out-chatgpt/',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'visibility-attribution',
    title: 'How to measure AI search visibility when attribution falls short',
    excerpt: 'A practical framework for tracking citations, brand mentions, assisted conversions, and the signals standard analytics miss.',
    topic: 'AI Search',
    author: 'Louise Linehan',
    source: 'Ahrefs',
    date: 'Oct 6, 2026',
    readTime: '11 min',
    url: 'https://ahrefs.com/blog/how-to-measure-ai-search-visibility/',
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'ai-search-roi',
    title: 'AI search ROI is messy. Here is how to measure it anyway',
    excerpt: 'Connect AI visibility to business value using directional metrics, controlled comparisons, and better conversion context.',
    topic: 'Data & Studies',
    author: 'Louise Linehan',
    source: 'Ahrefs',
    date: 'Oct 6, 2026',
    readTime: '13 min',
    url: 'https://ahrefs.com/blog/ai-search-roi/',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'branded-overviews',
    title: 'AI Overviews now appear for 83% of branded searches',
    excerpt: 'New research shows how frequently generated answers occupy branded result pages and what that means for reputation teams.',
    topic: 'Data & Studies',
    author: 'Ryan Law',
    source: 'Ahrefs',
    date: 'Oct 2, 2026',
    readTime: '9 min',
    url: 'https://ahrefs.com/blog/ai-overviews-on-branded-searches/',
    image: 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'static-sites',
    title: 'SEO for static sites: 8 technical problems to watch for',
    excerpt: 'Rendering, metadata, canonicals, sitemaps, and deployment details that can quietly limit otherwise fast static websites.',
    topic: 'Technical SEO',
    author: 'Despina Gavoyannis',
    source: 'Ahrefs',
    date: 'Oct 1, 2026',
    readTime: '10 min',
    url: 'https://ahrefs.com/blog/seo-for-static-sites/',
    image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'ai-content-report',
    title: '69% of marketers are publishing more AI content than last year',
    excerpt: 'Fresh survey data explores how production volume, review standards, and team workflows are changing across marketing organizations.',
    topic: 'Content',
    author: 'Glen Allsopp',
    source: 'Ahrefs',
    date: 'Sep 30, 2026',
    readTime: '12 min',
    url: 'https://ahrefs.com/blog/marketers-ai-content-creation/',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'overview-ctr',
    title: 'AI Overviews cut organic click-through rates by 23.1%',
    excerpt: 'A market study quantifies the traffic impact of generated answers and highlights the queries most exposed to lost clicks.',
    topic: 'Data & Studies',
    author: 'Juliette Begue',
    source: 'Ahrefs',
    date: 'Sep 16, 2026',
    readTime: '8 min',
    url: 'https://ahrefs.com/blog/ai-overviews-france-impact/',
    image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'quality-content',
    title: 'Google does not punish AI content. It punishes bad content',
    excerpt: 'An analysis of 331,000 pages separates the role of AI assistance from quality, originality, and search performance.',
    topic: 'Content',
    author: 'Ryan Law',
    source: 'Ahrefs',
    date: 'Jul 27, 2026',
    readTime: '16 min',
    url: 'https://ahrefs.com/blog/google-doesnt-punish-ai-content/',
    image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85',
  },
]

export default function Seo() {
  const [topic, setTopic] = useState('All')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(() => new Set())
  const featured = articles[0]

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const candidates = query || topic !== 'All' ? articles : articles.slice(1)
    return candidates.filter((article) =>
      (topic === 'All' || article.topic === topic) &&
      (!query || `${article.title} ${article.excerpt} ${article.author} ${article.topic}`.toLowerCase().includes(query)),
    )
  }, [search, topic])

  const toggleSaved = (id) => setSaved((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-6 sm:px-6 md:pt-8">
        <header className="flex justify-end">
          <label className="flex items-center gap-2 rounded-full bg-[var(--surface)] p-1.5 pl-4 ring-1 ring-[var(--line)] shadow-[0_12px_36px_rgba(36,49,38,.08)] focus-within:ring-[var(--lime-dark)]">
            <MagnifyingGlass className="shrink-0 text-[var(--muted)]" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the journal" className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none sm:w-56" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear article search" className="grid size-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--paper)]"><X size={12} weight="bold" /></button>}
          </label>
        </header>

        <nav className="mt-6 border-y border-[var(--line)] py-3" aria-label="SEO article topics"><HScroll innerClassName="gap-1" fade="var(--paper)" label="topics">
          {topics.map((item) => <button type="button" key={item} onClick={() => setTopic(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold transition-all ${topic === item ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'}`}>{item}</button>)}
        </HScroll></nav>

        {!search && topic === 'All' && <section className="mt-8 grid overflow-hidden rounded-[2rem] bg-[var(--ink)] text-white shadow-[0_28px_80px_rgba(25,35,27,.18)] lg:grid-cols-[1.1fr_.9fr]">
          <a href={featured.url} target="_blank" rel="noopener noreferrer" className="group relative min-h-72 overflow-hidden sm:min-h-96 lg:min-h-[31rem]">
            <img src={featured.image} alt="Analytics dashboards on a computer display" className="absolute inset-0 size-full object-cover opacity-85 transition-transform duration-700 group-hover:scale-[1.025]" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-5 left-5 rounded-full bg-[var(--lime)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-[#26320b] sm:bottom-7 sm:left-7">Featured research</span>
          </a>
          <div className="flex flex-col justify-between p-6 sm:p-9 lg:p-11">
            <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--lime)]">{featured.topic}</p><h2 className="mt-5 text-[clamp(2rem,4vw,4rem)] font-semibold leading-[.98] tracking-[-.055em]">{featured.title}</h2><p className="mt-5 max-w-xl text-sm leading-6 text-white/75">{featured.excerpt}</p></div>
            <div className="mt-10 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold">{featured.author}</p><p className="mt-1.5 text-[11px] font-medium text-white/65">{featured.source} · {featured.date} · {featured.readTime} read</p></div><a href={featured.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--lime)] px-5 py-3 text-xs font-bold text-[#26320b] transition-transform hover:-translate-y-0.5 active:translate-y-0">Read research <ArrowUpRight size={14} /></a></div>
          </div>
        </section>}

        <section className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] xl:gap-20">
          <div>
            <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] pb-4"><div><h2 className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Latest stories</h2><p className="mt-1 text-xs font-medium text-[var(--muted)]">{filtered.length} reads in this view</p></div><Clock size={18} className="text-[var(--muted)]" /></div>
            {filtered.length ? <div>
              {filtered.map((article) => <ArticleRow key={article.id} article={article} saved={saved.has(article.id)} onSave={() => toggleSaved(article.id)} />)}
            </div> : <div className="py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--line)]"><Newspaper size={22} /></span><h3 className="mt-5 text-xl font-semibold">No stories found</h3><p className="mt-2 text-sm text-[var(--muted)]">Try another topic or search phrase.</p></div>}
          </div>

          <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            <section className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-bold">Trending now</h2><p className="mt-1 text-[11px] font-medium text-[var(--muted)]">What search teams are reading</p></div><TrendUp size={18} weight="duotone" className="text-[var(--accent-strong)]" /></div>
              <div className="mt-5 space-y-5">{articles.slice(1, 5).map((article, index) => <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer" className="group grid grid-cols-[1.5rem_1fr] gap-3"><span className="font-mono text-sm text-[var(--muted)]">0{index + 1}</span><span><span className="block text-sm font-semibold leading-5 group-hover:text-[var(--accent-strong)]">{article.title}</span><span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">{article.topic}</span></span></a>)}</div>
            </section>

            <section className="rounded-[1.6rem] bg-[var(--lime)]/30 p-5 ring-1 ring-[var(--lime-dark)]/25">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-bold">Reading list</h2><p className="mt-1 text-[11px] font-medium text-[var(--muted)]">Saved for later</p></div><BookmarkSimple size={18} weight={saved.size ? 'fill' : 'regular'} /></div>
              {saved.size ? <div className="mt-5 space-y-4">{articles.filter((article) => saved.has(article.id)).map((article) => <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold leading-5 hover:text-[var(--accent-strong)]">{article.title}</a>)}</div> : <p className="mt-5 text-xs leading-5 text-[var(--muted)]">Save useful stories from the feed and they will stay together here.</p>}
            </section>
          </aside>
        </section>
      </main>
    </Shell>
  )
}

function ArticleRow({ article, saved, onSave }) {
  return <article className="group grid gap-5 border-b border-[var(--line)] py-7 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center lg:grid-cols-[minmax(0,1fr)_15rem]">
    <div className="min-w-0 sm:pr-5"><div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.09em] text-[var(--muted)]"><span className="font-bold text-[var(--accent-strong)]">{article.topic}</span><span>{article.date}</span><span>{article.readTime} read</span></div><a href={article.url} target="_blank" rel="noopener noreferrer"><h3 className="mt-3 text-xl font-semibold leading-tight tracking-[-.035em] transition-colors group-hover:text-[var(--accent-strong)] sm:text-2xl">{article.title}</h3></a><p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{article.excerpt}</p><div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs font-semibold">{article.author} <span className="font-medium text-[var(--muted)]">at {article.source}</span></p><button type="button" onClick={onSave} aria-label={saved ? 'Remove from reading list' : 'Save to reading list'} aria-pressed={saved} className={`grid size-8 place-items-center rounded-full transition-all active:scale-95 ${saved ? 'bg-[var(--lime)] !text-[#26320b]' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'}`}><BookmarkSimple size={15} weight={saved ? 'fill' : 'regular'} /></button></div></div>
    <a href={article.url} target="_blank" rel="noopener noreferrer" className="relative order-first overflow-hidden rounded-[1.25rem] bg-[var(--ink)] sm:order-none"><img src={article.image} alt="" className="aspect-[16/10] size-full object-cover transition-transform duration-700 group-hover:scale-105 sm:aspect-[4/3]" /><span className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-[var(--surface)] text-[var(--ink)] opacity-0 shadow-lg transition-all group-hover:opacity-100"><ArrowUpRight size={13} /></span></a>
  </article>
}
