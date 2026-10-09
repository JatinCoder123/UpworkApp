import axios from "axios";
import CryptoJS from "crypto-js";

export const SMART_GATEWAY_URL = import.meta.env?.VITE_SMART_GATEWAY_URL || "https://upwork.outrightcrm.in/index.php?entryPoint=smart_gateway";
export const JOBS_MODULE = "outr_upwork_jobs";
export const TECH_NEWS_MODULE = import.meta.env?.VITE_TECH_NEWS_MODULE || "daily_tech_news";
export const DEFAULT_TECH_NEWS_PER_PAGE = 10;

const apiClient = axios.create({
  baseURL: SMART_GATEWAY_URL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

const localChanges = new Map();

function generateToken() {
  const SECRET = "MY_SUPER_SECRET_123";
  const payload = {
    ts: Math.floor(Date.now() / 1000),
    source: "claude-mcp",
  };
  const json = JSON.stringify(payload);
  const signature = CryptoJS.HmacSHA256(json, SECRET).toString(CryptoJS.enc.Hex);
  return btoa(`${json}||${signature}`);
}

export async function smartGateway(payload) {
  const token = generateToken();
  const response = await apiClient.post("", payload, {
    headers: { "X-Api-Token": token },
  });
  if (!response.data?.success) throw new Error(response.data?.message || "The request could not be completed");
  return response.data;
}

function descriptionValue(description, label) {
  return String(description || "").match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim() || "";
}

function initials(value) {
  return String(value || "Upwork").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function addGatewayDateFilter(payload, dateFilter) {
  if (!dateFilter?.date_from || !dateFilter?.date_to) return payload;
  return {
    ...payload,
    date_field: dateFilter.date_field || "date_entered",
    date_from: dateFilter.date_from,
    date_to: dateFilter.date_to,
  };
}

function parseEnteredAt(record) {
  const match = String(record.date_entered || "").match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return new Date().toISOString();
  const [, month, day, year, hour, minute] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+05:30`).toISOString();
}

function parseClient(clientText) {
  const parts = String(clientText || "").split(",").map((part) => part.trim());
  return {
    location: parts[0] || "Remote",
    spent: parts.find((part) => /\bspent\b/i.test(part))?.replace(/\s*spent\s*/i, "") || "—",
    hires: parts.find((part) => /\bhires?\b/i.test(part)) || "—",
    rating: parts.find((part) => /\b\d(?:\.\d+)?\s*rating\b/i.test(part))?.split(/\s+/)[0] || "—",
  };
}

function buildUpworkApplyUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!/(^|\.)upwork\.com$/i.test(url.hostname)) return "";
    const jobId = url.pathname.match(/~[a-zA-Z0-9]+/)?.[0];
    return jobId ? `https://www.upwork.com/nx/proposals/job/${jobId}/apply` : "";
  } catch {
    return "";
  }
}

export function mapGatewayJob(record) {
  const clientStats = parseClient(record.client);
  const changes = localChanges.get(record.id) || {};
  const category = record.category?.trim();
  const built = record.already_built?.trim();
  const tags = [...new Set([category, built].filter((value) => value && value !== "–" && value !== "—"))];
  const owner = descriptionValue(record.description, "Lead");
  const url = descriptionValue(record.description, "Upwork link");
  return {
    id: record.id,
    jobId: record.job_id || record.name,
    title: record.job_title || record.name || "Untitled opportunity",
    company: owner || record.category || "Upwork client",
    client: initials(owner || record.category),
    location: clientStats.location,
    posted: record.posted || record.date_entered_time_ago || "Recently",
    postedAt: parseEnteredAt(record),
    budget: record.budget || "Budget not specified",
    type: /hour|\/hr/i.test(record.budget || "") ? "Hourly" : "Fixed price",
    level: "Not specified",
    duration: "See job description",
    status: changes.status || record.status?.trim() || descriptionValue(record.description, "Status") || "New",
    match: Number(record.fit) || 0,
    tags: tags.length ? tags : ["General"],
    image: "",
    url,
    applyUrl: buildUpworkApplyUrl(url),
    description: record.description || "No description provided.",
    pitch: record.pitch || "",
    coverLetter: record.cover_letter || "",
    clientStats,
    activity: changes.activity || [`Opportunity imported as ${record.job_id || record.name}`, `Last updated ${record.date_modified_time_ago || "recently"}`],
    raw: record,
    ...changes,
  };
}

export async function fetchJobs({ page = 1, perPage = 20, dateFilter } = {}) {
  const payload = addGatewayDateFilter({ action: "fetch", module: JOBS_MODULE, page, per_page: perPage }, dateFilter);
  const data = await smartGateway(payload);
  return (data.records || []).map(mapGatewayJob);
}

export async function fetchJobById(id) {
  const data = await smartGateway({ action: "fetch", module: JOBS_MODULE, filters: { id }, page: 1, per_page: 1 });
  const record = data.records?.find((item) => item.id === id);
  if (!record) throw new Error("Job not found");
  return mapGatewayJob(record);
}

export const cleanJobUrl = (value) => {
  const url = new URL(value);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "source", "ref"].forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  return url.toString().replace(/\/$/, "");
};

// ----------------------------------------------------
// Tech News (OutrightCRM Smart Gateway Integration)
// ----------------------------------------------------

function decodeHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const CATEGORY_IMAGES = {
  "AI": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80",
  "Tech Product": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
  "Other Tech (Cloud)": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
  "Other Tech (Security)": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
  "Other Tech (Hardware)": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  "Other Tech (Dev Tools)": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
  "Other Tech (Business)": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  "Web Architecture": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
};
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80";

function parseSourceType(tagString) {
  const str = String(tagString || "");
  if (/FirstParty/i.test(str)) return "FirstParty";
  if (/YouBlogging/i.test(str)) return "YouBlogging";
  return "ThirdParty";
}

function parseHurryUp(tagString) {
  return /HurryUp/i.test(String(tagString || ""));
}

function parseSourceName(record) {
  if (record.source_note) {
    const matched = record.source_note.split(/·|\(|,/)[0]?.trim();
    if (matched) return decodeHtml(matched);
  }
  if (record.source) {
    try {
      const parsed = new URL(record.source);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      // fallback
    }
  }
  return "Tech Report";
}

function parseScore(scoreVal) {
  const num = Number(scoreVal);
  return Number.isFinite(num) ? num : 50;
}

function parsePriorityTier(priorityVal, score) {
  const upper = String(priorityVal || "").toUpperCase();
  if (upper === "BLOCKBUSTER" || score >= 90) {
    return {
      label: "BLOCKBUSTER",
      colorClass: "bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-rose-500/30",
      squareClass: "bg-rose-500",
      tierKey: "blockbuster",
    };
  }
  if (upper === "HOT" || score >= 70) {
    return {
      label: "HOT",
      colorClass: "bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-amber-500/30",
      squareClass: "bg-amber-500",
      tierKey: "hot",
    };
  }
  return {
    label: "NORMAL",
    colorClass: "bg-purple-500/15 text-purple-900 dark:text-purple-200 ring-purple-500/30",
    squareClass: "bg-purple-500",
    tierKey: "normal",
  };
}

function calculateReadTime(record) {
  const fullText = [
    record.name,
    record.summary,
    record.description,
    record.content_angle,
    record.details,
  ].filter(Boolean).join(" ");

  const words = fullText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.min(10, Math.ceil(words / 65)));
  return `${minutes} min read`;
}

export function mapGatewayTechNews(record) {
  const score = parseScore(record.score);
  const tier = parsePriorityTier(record.priority, score);
  const sourceType = parseSourceType(record.tag);
  const hurryUp = parseHurryUp(record.tag);
  const title = decodeHtml(record.name || "Untitled story");
  const summary = decodeHtml(record.summary || record.description || "");
  const category = decodeHtml(record.category || "AI");
  const image = record.image || CATEGORY_IMAGES[category] || DEFAULT_IMAGE;
  const source = parseSourceName(record);
  const url = record.source || "";

  return {
    id: record.id,
    title,
    summary,
    score,
    tier,
    sourceType,
    hurryUp,
    category,
    source,
    sourceNote: decodeHtml(record.source_note || ""),
    contentAngle: decodeHtml(record.content_angle || ""),
    description: decodeHtml(record.description || ""),
    url,
    image,
    posted: record.date_entered_time_ago || record.date_entered_uni_format || "Recently",
    postedAt: record.date_entered || new Date().toISOString(),
    readTime: calculateReadTime(record),
    tags: [category, sourceType, ...(hurryUp ? ["HurryUp"] : [])],
    raw: record,
  };
}

export async function fetchTechNews({
  page = 1,
  perPage = DEFAULT_TECH_NEWS_PER_PAGE,
  category,
  search,
  filters = {},
  dateFilter,
} = {}) {
  const gatewayFilters = { ...filters };
  if (category && category !== "All") {
    gatewayFilters.category = category;
  }

  const queryPayload = {
    action: "fetch",
    module: TECH_NEWS_MODULE,
    order_by: "date_entered",
    order_dir: "DESC",
    page,
    per_page: perPage,
  };

  if (Object.keys(gatewayFilters).length > 0) {
    queryPayload.filters = gatewayFilters;
  }

  if (search && search.trim()) {
    queryPayload.search = search.trim();
    queryPayload.search_fields = ["name", "summary", "description"];
  }

  const data = await smartGateway(addGatewayDateFilter(queryPayload, dateFilter));
  const records = (data.records || []).map(mapGatewayTechNews);

  return {
    records,
    total: Number(data.total) || records.length,
    page: Number(data.page) || page,
    perPage: Number(data.per_page) || perPage,
    totalPages: Number(data.total_pages) || Math.ceil((Number(data.total) || records.length) / perPage),
  };
}

export async function fetchTechNewsById(id) {
  const data = await smartGateway({
    action: "fetch",
    module: TECH_NEWS_MODULE,
    filters: { id },
    page: 1,
    per_page: 1,
  });

  const record = data.records?.find((item) => item.id === id) || data.records?.[0];
  if (!record) throw new Error("Story not found");
  return mapGatewayTechNews(record);
}

const techNewsCache = new Map();
const inFlightTechNewsRequests = new Map();

export async function fetchAllTechNews({ forceRefresh = false, dateFilter = null } = {}) {
  const now = Date.now();
  const cacheKey = JSON.stringify(dateFilter || {});
  const cached = techNewsCache.get(cacheKey);
  if (!forceRefresh && cached && now - cached.timestamp < 120_000) {
    return cached.data;
  }

  if (!forceRefresh && inFlightTechNewsRequests.has(cacheKey)) {
    return inFlightTechNewsRequests.get(cacheKey);
  }

  const request = (async () => {
    try {
      const first = await fetchTechNews({ page: 1, perPage: 50, dateFilter });
      const total = Number(first.total) || first.records.length;
      const computedTotalPages = Math.max(Number(first.totalPages) || 1, Math.ceil(total / 50));
      let allRecords = [...first.records];

      if (computedTotalPages > 1) {
        for (let p = 2; p <= computedTotalPages; p++) {
          try {
            const nextPage = await fetchTechNews({ page: p, perPage: 50, dateFilter });
            allRecords = allRecords.concat(nextPage.records || []);
          } catch (pageErr) {
            console.warn(`Failed to fetch tech news page ${p}:`, pageErr);
          }
        }
      }

      const result = {
        records: allRecords,
        total,
      };
      techNewsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightTechNewsRequests.delete(cacheKey);
    }
  })();

  inFlightTechNewsRequests.set(cacheKey, request);
  return request;
}

export const api = {
  getJobs: (params) => fetchJobs(params),
  getJob: fetchJobById,
  getTechNews: (params) => fetchTechNews(params),
  getTechNewsItem: (id) => fetchTechNewsById(id),
  getAllTechNews: (options) => fetchAllTechNews(options),
  async updateStatus({ id, status, reason, coverLetter }) {
    const current = await fetchJobById(id);
    await smartGateway({
      action: "update",
      module: JOBS_MODULE,
      id,
      data: { status },
    });
    const changes = { status, reason, coverLetter, activity: [`Status changed from ${current.status} to ${status}`, ...current.activity] };
    localChanges.set(id, changes);
    return { ...current, ...changes };
  },
  async checkDuplicate(value) {
    const cleaned = cleanJobUrl(value);
    const jobs = await fetchJobs();
    return { exists: jobs.some((job) => job.url && cleanJobUrl(job.url) === cleaned), cleaned };
  },
};
