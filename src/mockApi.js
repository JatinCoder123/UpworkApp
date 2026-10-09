import { seedJobs, seedTechNews } from './data'

let jobs = seedJobs.map((job) => ({ ...job }))
const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

export const cleanJobUrl = (value) => {
  const url = new URL(value)
  const tracking = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'source', 'ref']
  tracking.forEach((key) => url.searchParams.delete(key))
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export const api = {
  async getJobs() {
    await wait()
    return jobs.map((job) => ({ ...job }))
  },
  async getJob(id) {
    await wait(180)
    const job = jobs.find((item) => item.id === id)
    if (!job) throw new Error('Job not found')
    return { ...job }
  },
  async getTechNews() {
    await wait(200)
    return seedTechNews.map((item) => ({ ...item }))
  },
  async getTechNewsItem(id) {
    await wait(150)
    const story = seedTechNews.find((item) => item.id === id)
    if (!story) throw new Error('Story not found')
    return { ...story }
  },
  async updateStatus({ id, status, reason, coverLetter }) {
    await wait(420)
    jobs = jobs.map((job) => job.id === id ? {
      ...job,
      status,
      reason,
      coverLetter,
      activity: [`Status changed from ${job.status} to ${status}`, ...job.activity],
    } : job)
    return jobs.find((job) => job.id === id)
  },
  async checkDuplicate(value) {
    await wait(350)
    const cleaned = cleanJobUrl(value)
    return { cleaned, exists: jobs.some((job) => cleanJobUrl(job.url) === cleaned) }
  },
}
