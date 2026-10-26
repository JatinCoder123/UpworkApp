import axios from "axios";
import CryptoJS from "crypto-js";
import { asArray, asObject, asText } from "../lib/safe";
import { AUTH_ORIGIN } from "../lib/auth";

export const CRM_BASE_URL = (import.meta.env?.VITE_CRM_BASE_URL || "https://upwork.outrightcrm.in").replace(/\/$/, "");
export const SMART_GATEWAY_URL = import.meta.env?.VITE_SMART_GATEWAY_URL || `${CRM_BASE_URL}/index.php?entryPoint=smart_gateway`;
export const TECH_CONTENT_DOCX_URL = import.meta.env?.VITE_TECH_CONTENT_DOCX_URL || `${CRM_BASE_URL}/index.php?entryPoint=TechContentDocx`;
export const DOWNLOAD_URL = import.meta.env?.VITE_DOWNLOAD_URL || `${CRM_BASE_URL}/index.php?entryPoint=download`;
export const VIEW_DOC_URL = import.meta.env?.VITE_VIEW_DOC_URL || `${CRM_BASE_URL}/index.php?entryPoint=viewdoc`;
export const MCP_CRM_BASE_URL = (import.meta.env?.VITE_MCP_CRM_BASE_URL || "https://crm.outrightsystems.org").replace(/\/$/, "");
export const MCP_SMART_GATEWAY_URL = import.meta.env?.VITE_MCP_SMART_GATEWAY_URL || `${MCP_CRM_BASE_URL}/index.php?entryPoint=smart_gateway`;
export const MCP_AGENT_URL = import.meta.env?.VITE_MCP_AGENT_URL || `${MCP_CRM_BASE_URL}/index.php?entryPoint=mcp`;

export const getMcpAgentUrl = () => {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.location.origin.includes("localhost")) {
    return "/mcp-proxy/index.php?entryPoint=mcp";
  }
  return MCP_AGENT_URL;
};

export const getMcpSmartGatewayUrl = () => {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.location.origin.includes("localhost")) {
    return "/mcp-proxy/index.php?entryPoint=smart_gateway";
  }
  return MCP_SMART_GATEWAY_URL;
};

export const CREDENTIALS_MODULE = import.meta.env?.VITE_CREDENTIALS_MODULE || "outr_credentials";
export const JOBS_MODULE = import.meta.env?.VITE_JOBS_MODULE || "outr_upwork_jobs";
export const USERS_MODULE = import.meta.env?.VITE_USERS_MODULE || "Users";
export const SKILLS_MODULE = import.meta.env?.VITE_SKILLS_MODULE || "outr_skills";
export const TECH_NEWS_MODULE = import.meta.env?.VITE_TECH_NEWS_MODULE || "daily_tech_news";
export const VIDEO_FEEDS_MODULE = import.meta.env?.VITE_VIDEO_FEEDS_MODULE || "video_feeds";
export const JOB_ACTIVITY_MODULE = import.meta.env?.VITE_JOB_ACTIVITY_MODULE || "outr_job_activity";
export const SITE_CONTENT_MODULE = import.meta.env?.VITE_SITE_CONTENT_MODULE || "sites_tech_content";
export const ROLES_MODULE = import.meta.env?.VITE_ROLES_MODULE || "ACLRoles";
export const DEFAULT_TECH_NEWS_PER_PAGE = Number(import.meta.env?.VITE_TECH_NEWS_PER_PAGE) || 10;

export function getDocumentDownloadUrl(noteId) {
  if (!noteId) return "";
  return `${DOWNLOAD_URL}&type=Notes&id=${encodeURIComponent(noteId)}`;
}

// Saves a generated document (the Word file on a CRM Note) to the user's computer. The CRM "download" entry point
// sends the real .docx as an attachment and allows cross-site requests, so this works on the live site as well as on
// localhost (the "viewdoc" page does not allow other sites to read it, which made Download open the viewer instead).
export async function downloadNoteDocument(noteId, { filename = "" } = {}) {
  const url = getDocumentDownloadUrl(noteId);
  if (!url) throw createAppError("DOC_MISSING", "This document has no file yet.");
  const response = await fetch(url);
  const type = response.headers.get("content-type") || "";
  // An HTML reply is a CRM error page, not the document.
  if (!response.ok || /text\/html/i.test(type)) throw createAppError("DOC_DOWNLOAD_FAILED", `The document could not be downloaded (${response.status}).`);
  const disposition = response.headers.get("content-disposition") || "";
  const headerName = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] || /filename="?([^";]+)"?/i.exec(disposition)?.[1] || "";
  let name = filename || "document.docx";
  try { name = decodeURIComponent(headerName) || name; } catch { name = headerName || name; }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export function getDocumentViewUrl(noteId) {
  if (!noteId) return "";
  return `${VIEW_DOC_URL}&id=${encodeURIComponent(noteId)}`;
}

// Endpoint that generates a cover letter for a job. Set it in .env once the backend is ready.
const COVER_LETTER_URL = import.meta.env?.VITE_COVER_LETTER_URL || "";
// Endpoint that generates a fresh proposal strategy for a job. Set it in .env once the backend is ready.
const STRATEGY_URL = import.meta.env?.VITE_STRATEGY_URL || "";
const apiClient = axios.create({
  baseURL: SMART_GATEWAY_URL,
  timeout: 600_000,
  headers: { "Content-Type": "application/json" },
});

const localChanges = new Map();
const gatewayUserIdCache = new Map();

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

export function createAppError(code, message, meta = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, meta);
  return error;
}

export async function smartGateway(payload, { timeout, signal } = {}) {
  const token = generateToken();
  let response;
  try {
    response = await apiClient.post("", payload, {
      headers: { "X-Api-Token": token },
      ...(timeout ? { timeout } : {}),
      signal,
    });
  } catch (err) {
    if (axios.isCancel(err)) throw createAppError("ABORTED", "Request cancelled");
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      throw createAppError("UNAUTHORIZED", "Your session has expired or you do not have permission to access this resource.", { status });
    }
    if (err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "")) {
      throw createAppError("TIMEOUT", "The request timed out while waiting for the server.", { status });
    }
    if (!err?.response) {
      throw createAppError("NETWORK_ERROR", "Unable to reach the server. Please check your internet connection.", { status });
    }
    if (status >= 500) {
      throw createAppError("SERVER_ERROR", "The server encountered an internal error. Please try again shortly.", { status });
    }
    throw createAppError("SERVER_ERROR", err?.response?.data?.message || err?.response?.data?.error || err?.message || "The request could not be completed", { status });
  }
  if (!response.data?.success) {
    const message = response.data?.message || response.data?.error || "The request could not be completed";
    if (/unauthorized|forbidden|invalid token|expired session/i.test(message)) {
      throw createAppError("UNAUTHORIZED", message);
    }
    throw createAppError("SERVER_ERROR", message);
  }
  return response.data;
}

function descriptionValue(description, label) {
  return String(description || "").match(new RegExp(`^${label}:[ \\t]*(.+)$`, "im"))?.[1]?.trim() || "";
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

const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

// Upwork posting time arrives as "Wed, 14 Oct 2026 10:37 IST".
function parsePostedAt(record) {
  const match = String(record.posted || "").match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
  const month = match && MONTHS[match[2].toLowerCase()];
  if (!month) return parseEnteredAt(record);
  const [, day, , year, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00+05:30`);
  return Number.isNaN(date.getTime()) ? parseEnteredAt(record) : date.toISOString();
}

const flag = (value) => value === true || /^(1|true|yes|verified)$/i.test(String(value ?? "").trim());
const present = (value) => value !== undefined && value !== null && String(value).trim() !== "";
// A client stat that is not a real number ("N/A", "") becomes null instead of NaN on screen.
const numberOrNull = (value) => (present(value) && Number.isFinite(Number(value)) ? Number(value) : null);

// The client field is "Country; 31 hires, ★5 (16 reviews), payment verified; 22 proposals".
// Structured client_* fields (or a JSON client value) win when the backend provides them.
function parseClient(record) {
  const text = decodeHtml(record.client || "");
  let structured = {};
  if (/^\s*\{/.test(text)) {
    try { structured = JSON.parse(text); } catch { structured = {}; }
  }
  const pick = (...keys) => keys.map((key) => record[`client_${key}`] ?? structured[key]).find(present);
  const segments = text.split(";").map((part) => part.trim()).filter(Boolean);
  const country = pick("country", "location") || (!/\d|hires?|proposals?|verified/i.test(segments[0] || "") ? segments[0] : "") || "";
  const number = (pattern) => text.match(pattern)?.[1]?.replace(/,/g, "");
  const rating = pick("rating") ?? number(/★\s*([\d.]+)/);
  const reviews = pick("reviews", "review_count") ?? number(/\(([\d,]+)\s*reviews?\)/i);
  const hires = pick("hires", "total_hires") ?? number(/([\d,]+)\s*hires?/i);
  const proposals = pick("proposals") ?? number(/([\d,]+)\s*proposals?/i);
  const paymentVerified = present(pick("payment_verified")) ? flag(pick("payment_verified")) : /payment\s+verified/i.test(text) && !/payment\s+(?:not|un)\s*verified/i.test(text);
  const phoneVerifiedValue = pick("phone_verified");
  const totalSpent = pick("total_spent", "spent") || text.match(/\$[\d.,]+[KkMm]?\+?(?=\s*(?:total\s*)?spent)/)?.[0] || "";
  return {
    country,
    city: pick("city") || "",
    timezone: pick("timezone", "tz") || "",
    rating: numberOrNull(rating),
    reviews: numberOrNull(reviews),
    hires: numberOrNull(hires),
    activeHires: numberOrNull(pick("active_hires", "active")),
    proposals: numberOrNull(proposals),
    jobsPosted: numberOrNull(pick("jobs_posted")),
    hireRate: pick("hire_rate") || "",
    openJobs: numberOrNull(pick("open_jobs")),
    totalSpent,
    avgHourlyRate: pick("avg_hourly_rate", "avg_rate") || "",
    totalHours: pick("total_hours", "hours") || "",
    paymentVerified,
    phoneVerified: present(phoneVerifiedValue) ? flag(phoneVerifiedValue) : null,
    // Kept for the fit-score helper, which reads these three.
    location: country || "Location not shared",
    spent: totalSpent || "—",
  };
}

const LEVELS = /^(entry level|intermediate|expert)$/i;
const DURATIONS = /month|week|day|year/i;

// Budget arrives as "Budget, workload, duration, level", with workload and duration optional.
function parseBudget(value) {
  const parts = decodeHtml(value || "").split(",").map((part) => part.trim()).filter(Boolean);
  const amount = parts.shift() || "Budget not specified";
  const level = parts.find((part) => LEVELS.test(part)) || "";
  const workload = parts.find((part) => /hrs\/week|hours|not sure/i.test(part)) || "";
  const duration = parts.find((part) => part !== workload && DURATIONS.test(part)) || "";
  return { amount, level, workload: /not sure/i.test(workload) ? "" : workload, duration };
}

function humanize(value) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

// Some cover letters are stored base64-encoded. Decode them when the payload is clearly base64 text.
export function decodeCoverLetter(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const compact = text.replace(/\s+/g, "");
  if (compact.length >= 16 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact) && !/\s/.test(text.replace(/\n/g, ""))) {
    try {
      const bytes = Uint8Array.from(atob(compact), (char) => char.charCodeAt(0));
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const binary = [...decoded].some((char) => char.charCodeAt(0) < 32 && !"\n\r\t".includes(char));
      if (!binary) return decodeHtml(decoded);
    } catch {
      // Not base64 after all; fall through to the raw text.
    }
  }
  return decodeHtml(text);
}

function jobBrief(description) {
  const text = decodeHtml(description || "");
  const marker = text.split(/^-{2,}\s*Upwork job description\s*-{2,}\s*$/im);
  return (marker.length > 1 ? marker.slice(1).join("\n") : text).trim();
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

function parseJobSkills(value) {
  return [...new Set(String(value || "")
    .split(/[,;\n|]+/)
    .map((skill) => skill.trim())
    .filter(Boolean))];
}

export function mapGatewayJob(input) {
  const record = asObject(input);
  const clientStats = parseClient(record);
  const changes = localChanges.get(record.id) || {};
  const category = humanize(asText(record.category).trim());
  const built = asText(record.already_built).trim();
  const tags = [...new Set([category, built].filter((value) => value && value !== "–" && value !== "—"))];
  const skills = parseJobSkills(record.skills || descriptionValue(record.description, "Skills"));
  const owner = descriptionValue(record.description, "Lead");
  const url = record.upwork_url || descriptionValue(record.description, "Upwork link");
  const budget = parseBudget(record.budget);
  return {
    id: record.id,
    jobId: record.job_id || record.name,
    title: decodeHtml(record.job_title || record.name || "Untitled job"),
    company: owner || category || "Upwork client",
    client: initials(owner || category),
    location: clientStats.location,
    posted: record.posted || record.date_entered_time_ago || "Recently",
    postedAt: parsePostedAt(record),
    // When the job entered the feed (its CRM record was created), shown in its Activity.
    added: record.date_entered_uni_format || record.date_entered || "",
    addedAt: present(record.date_entered) ? parseEnteredAt(record) : "",
    budget: budget.amount,
    type: /hour|\/hr/i.test(budget.amount) ? "Hourly" : "Fixed price",
    level: budget.level || "Not specified",
    duration: budget.duration || "Duration not set",
    workload: budget.workload,
    status: changes.status || asText(record.status).trim() || descriptionValue(record.description, "Status") || "New",    match: Number(record.match_score) || 0,
    fitLabel: decodeHtml(record.fit || ""),
    matchReason: decodeHtml(record.match_reason || ""),
    summary: decodeHtml(record.explain_job || ""),
    tags: tags.length ? tags : ["General"],
    skills,
    image: "",
    url,
    applyUrl: buildUpworkApplyUrl(url),
    description: jobBrief(record.description) || "No description provided.",
    pitch: decodeHtml(record.pitch || ""),
    coverLetter: decodeCoverLetter(record.cover_letter),
    clientStats,
    // The signed-in user's like/save state, when the job was fetched with engagement.
    engagement: mapEngagement(record.engagement),
    activity: Array.isArray(changes.activity) ? changes.activity : [`Job imported as ${record.job_id || record.name}`, `Last updated ${record.date_modified_time_ago || "recently"}`],
    raw: record,
    ...changes,
  };
}

export async function findGatewayUserIdByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw createAppError("CRM_USER_EMAIL_MISSING", "Your signed-in account does not include an email address.");
  if (gatewayUserIdCache.has(normalizedEmail)) return gatewayUserIdCache.get(normalizedEmail);

  const request = (async () => {
    // The gateway filters Users by email1 itself: one small request instead of downloading every user.
    const direct = await smartGateway({ action: "fetch", module: USERS_MODULE, filters: { email1: normalizedEmail }, page: 1, per_page: 5 }).catch(() => null);
    const directMatch = asArray(direct?.records).find((record) => asText(record?.email1).trim().toLowerCase() === normalizedEmail);
    if (directMatch?.id) return directMatch.id;

    const perPage = 100;
    const firstPage = await smartGateway({ action: "fetch", module: USERS_MODULE, page: 1, per_page: perPage });
    let users = [...asArray(firstPage.records)];
    const totalPages = Math.max(Number(firstPage.total_pages) || 1, Math.ceil((Number(firstPage.total) || users.length) / perPage));

    for (let page = 2; page <= totalPages; page += 1) {
      const nextPage = await smartGateway({ action: "fetch", module: USERS_MODULE, page, per_page: perPage });
      users = users.concat(asArray(nextPage.records));
    }

    const matchedUser = users.find((record) => asText(record?.email1).trim().toLowerCase() === normalizedEmail);
    if (!matchedUser?.id) throw createAppError("CRM_USER_NOT_FOUND", `No CRM user was found for ${email}.`);
    return matchedUser.id;
  })();

  gatewayUserIdCache.set(normalizedEmail, request);
  try {
    return await request;
  } catch (error) {
    gatewayUserIdCache.delete(normalizedEmail);
    throw error;
  }
}

// Fields the gateway searches when the user types in the jobs search box.
const JOB_SEARCH_FIELDS = ["name", "job_title", "description", "skills", "matched_skills", "explain_job", "pitch", "category"];

const JOB_ORDER_FIELDS = ["date_entered", "match_score"];

// Filters from the skills section, all applied by the gateway: category and sub category (CRM dropdown keys,
// e.g. "development", "crm_development"; jobs and skills both store the keys) and, for jobs, one skill (LIKE on the job's skills).
// The gateway cannot OR several skills in one request, so a pick of two or more skills is matched on the loaded pages.
function skillGroupFilters({ category = "", subcategory = "", skill = "" } = {}) {
  const filters = {};
  if (asText(category).trim()) filters.category = asText(category).trim();
  if (asText(subcategory).trim()) filters.sub_category = asText(subcategory).trim();
  if (asText(skill).trim()) filters.skills = { like: `%${asText(skill).trim()}%` };
  return filters;
}

// The category and sub category choices, exactly as a CRM module defines them (fetch -> dropdown_lists):
// { category: [{ value, label }], subcategory: [{ value, label }] }. The empty "" (none) option is left out.
// outr_skills and outr_upwork_jobs share the same lists, and both store the keys ("development", "crm_development").
export async function fetchGroupOptions(module = SKILLS_MODULE) {
  const data = await smartGateway({ action: "fetch", module, page: 1, per_page: 1 });
  const lists = asObject(data.dropdown_lists);
  const toOptions = (list) => Object.entries(asObject(list))
    .map(([value, label]) => ({ value: asText(value).trim(), label: asText(label).trim() || asText(value).trim() }))
    .filter((option) => option.value);
  return { category: toOptions(lists.category), subcategory: toOptions(lists.sub_category ?? lists.subcategory) };
}

// Jobs per category, and per sub category inside the chosen category, for the current scope and date window.
// One get_stats call: { category: { [key]: count }, subcategory: { [key]: count } }.
export async function fetchJobGroupCounts({ options, dateFilter, userEmail, allJobs = false, category = "" } = {}) {
  const categories = asArray(options?.category).map((option) => option.value).filter(Boolean);
  const subcategories = asArray(options?.subcategory).map((option) => option.value).filter(Boolean);
  if (!categories.length && !subcategories.length) return { category: {}, subcategory: {} };
  const base = { ai_processed: 1 };
  if (!allJobs) base.assigned_user_id = await findGatewayUserIdByEmail(userEmail);
  const data = await smartGateway({
    action: "get_stats",
    date_range: "",
    date_field: dateFilter?.date_field || "",
    date_from: dateFilter?.date_from || "",
    date_to: dateFilter?.date_to || "",
    queries: [
      ...categories.map((value, index) => ({ key: `category_${index}`, module: JOBS_MODULE, filters: { ...base, ...skillGroupFilters({ category: value }) } })),
      ...subcategories.map((value, index) => ({ key: `subcategory_${index}`, module: JOBS_MODULE, filters: { ...base, ...skillGroupFilters({ category, subcategory: value }) } })),
    ],
  });
  const countOf = (key) => Number(data.stats?.[key]?.count) || 0;
  return {
    category: Object.fromEntries(categories.map((value, index) => [value, countOf(`category_${index}`)])),
    subcategory: Object.fromEntries(subcategories.map((value, index) => [value, countOf(`subcategory_${index}`)])),
  };
}

// Every skill in a category / sub category (dropdown keys), filtered by the gateway; all pages.
export async function fetchSkillsInGroup({ category = "", subcategory = "" } = {}) {
  const filters = skillGroupFilters({ category, subcategory });
  const perPage = 50;
  const query = (page) => smartGateway({ action: "fetch", module: SKILLS_MODULE, filters, order_by: "name", order_dir: "ASC", page, per_page: perPage });
  const first = await query(1);
  const total = Number(first.total) || asArray(first.records).length;
  const totalPages = Math.max(Number(first.total_pages) || 1, Math.ceil(total / perPage));
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => query(index + 2)));
  return [first, ...rest]
    .flatMap((page) => asArray(page?.records))
    .filter((record) => record && record.deleted !== "1")
    .map((record) => ({ ...record, name: asText(record.name).trim() }))
    .filter((record) => record.name);
}

// Skills per category, and per sub category inside the chosen category (dropdown keys), counted by the gateway.
// A sub category with no skills in the chosen category is not part of it, so the UI leaves it out.
export async function fetchSkillGroupCounts({ options, category = "" } = {}) {
  const categories = asArray(options?.category).map((option) => option.value).filter(Boolean);
  const subcategories = asArray(options?.subcategory).map((option) => option.value).filter(Boolean);
  if (!categories.length && !subcategories.length) return { category: {}, subcategory: {} };
  const data = await smartGateway({
    action: "get_stats",
    queries: [
      ...categories.map((value, index) => ({ key: `category_${index}`, module: SKILLS_MODULE, filters: skillGroupFilters({ category: value }) })),
      ...subcategories.map((value, index) => ({ key: `subcategory_${index}`, module: SKILLS_MODULE, filters: skillGroupFilters({ category, subcategory: value }) })),
    ],
  });
  const countOf = (key) => Number(data.stats?.[key]?.count) || 0;
  return {
    category: Object.fromEntries(categories.map((value, index) => [value, countOf(`category_${index}`)])),
    subcategory: Object.fromEntries(subcategories.map((value, index) => [value, countOf(`subcategory_${index}`)])),
  };
}

// `jobIds`: only these jobs (the "My skills" filter, see fetchSkillJobIds); an empty list means none.
export async function fetchJobsPage({ page = 1, perPage = 20, dateFilter, userEmail, allJobs = false, search = "", status = "", orderBy = "date_entered", orderDir = "DESC", category = "", subcategory = "", skill = "", jobIds = null } = {}) {
  if (Array.isArray(jobIds) && !jobIds.length) return { records: [], page: 1, perPage, total: 0, totalPages: 1 };
  const assignedUserId = allJobs ? null : await findGatewayUserIdByEmail(userEmail);
  const query = {
    action: "fetch",
    module: JOBS_MODULE,
    order_by: JOB_ORDER_FIELDS.includes(orderBy) ? orderBy : "date_entered",
    order_dir: orderDir === "ASC" ? "ASC" : "DESC",
    page,
    per_page: perPage,
  };
  const filters = { ai_processed: 1, ...(await engagementFilters(userEmail)) };
  if (assignedUserId) filters.assigned_user_id = assignedUserId;
  if (status) filters.status = status;
  if (Array.isArray(jobIds)) filters.id = { in: jobIds };
  Object.assign(filters, skillGroupFilters({ category, subcategory, skill }));
  if (Object.keys(filters).length) query.filters = filters;
  const searchText = asText(search).trim();
  if (searchText) {
    query.search = searchText;
    query.search_fields = JOB_SEARCH_FIELDS;
  }
  const payload = addGatewayDateFilter(query, dateFilter);
  const data = await smartGateway(payload);
  const records = asArray(data.records).map(mapGatewayJob);
  return {
    records,
    page: Number(data.page) || page,
    perPage: Number(data.per_page) || perPage,
    total: Number(data.total) || records.length,
    totalPages: Number(data.total_pages) || Math.max(1, Math.ceil((Number(data.total) || records.length) / perPage)),
  };
}

// With engagement on, the gateway adds the user's like/save state and the like/save totals to every job.
// It does not narrow the list. A user missing from the CRM just gets jobs without it.
async function engagementFilters(userEmail) {
  if (!userEmail) return {};
  const userId = await findGatewayUserIdByEmail(userEmail).catch(() => "");
  return userId ? { engagement: true, user_id: userId } : {};
}

function mapEngagement(value) {
  if (!value || typeof value !== "object") return null;
  return {
    liked: Boolean(value.liked),
    saved: Boolean(value.saved),
    likesCount: Number(value.likes_count) || 0,
    savesCount: Number(value.saves_count) || 0,
  };
}

// `jobIds`: count only these jobs (the user's skills, see fetchSkillJobIds); get_stats cannot filter by a list of ids,
// so each count is then the total of a one-record fetch.
export async function fetchJobStats({ dateFilter, userEmail, category = "", subcategory = "", skill = "", jobIds = null } = {}) {
  const assignedUserId = await findGatewayUserIdByEmail(userEmail);
  // The tab counts follow the skills section (category, sub category, single skill), like the list. get_stats ignores
  // the LIKE filter the list uses, so the skill is matched with its search on the skills field instead (same result).
  const group = skillGroupFilters({ category, subcategory });
  const skillSearch = asText(skill).trim() ? { search: asText(skill).trim(), search_fields: ["skills"] } : {};
  const statuses = ["New", "Seen", "Applied", "Rejected"];
  const queries = [
    { key: "my_total", module: JOBS_MODULE, filters: { ai_processed: 1, assigned_user_id: assignedUserId } },
    { key: "all_total", module: JOBS_MODULE, filters: { ai_processed: 1 } },
    ...statuses.flatMap((status) => {
      const statusKey = status.toLowerCase();
      return [
        { key: `my_${statusKey}`, module: JOBS_MODULE, filters: { ai_processed: 1, assigned_user_id: assignedUserId, status } },
        { key: `all_${statusKey}`, module: JOBS_MODULE, filters: { ai_processed: 1, status } },
      ];
    }),
  ].map((query) => ({ ...query, ...skillSearch, filters: { ...query.filters, ...group } }));
  if (Array.isArray(jobIds)) {
    const counts = await Promise.all(queries.map(async ({ key, module, filters, ...search }) => {
      if (!jobIds.length) return [key, 0];
      const data = await smartGateway(addGatewayDateFilter({ action: "fetch", module, filters: { ...filters, id: { in: jobIds } }, ...search, fields: ["id"], page: 1, per_page: 1 }, dateFilter));
      return [key, Number(data.total) || 0];
    }));
    return Object.fromEntries(counts);
  }
  const data = await smartGateway({
    action: "get_stats",
    date_range: "",
    date_field: dateFilter?.date_field || "",
    date_from: dateFilter?.date_from || "",
    date_to: dateFilter?.date_to || "",
    queries,
  });
  return Object.fromEntries(
    Object.entries(asObject(data.stats)).map(([key, value]) => [key, Number(value?.count) || 0]),
  );
}

// Jobs per skill for the current scope and date window, as { [skillName]: count }.
// Each get_stats query searches the jobs' skills field, the same search the jobs list uses.
export async function fetchSkillCounts({ skills = [], dateFilter, userEmail, allJobs = false, category = "", subcategory = "" } = {}) {
  const names = [...new Set(asArray(skills).map((skill) => asText(skill).trim()).filter(Boolean))];
  if (!names.length) return {};
  const filters = { ai_processed: 1, ...skillGroupFilters({ category, subcategory }) };
  if (!allJobs) filters.assigned_user_id = await findGatewayUserIdByEmail(userEmail);
  // Index-based keys keep skill names with spaces or symbols out of the stats keys.
  const data = await smartGateway({
    action: "get_stats",
    date_range: "",
    date_field: dateFilter?.date_field || "",
    date_from: dateFilter?.date_from || "",
    date_to: dateFilter?.date_to || "",
    queries: names.map((name, index) => ({ key: `skill_${index}`, module: JOBS_MODULE, filters, search: name, search_fields: ["skills"] })),
  });
  return Object.fromEntries(names.map((name, index) => [name, Number(data.stats?.[`skill_${index}`]?.count) || 0]));
}

// Every page of a gateway fetch (50 per page, the gateway maximum).
async function fetchEveryPage(query) {
  const first = await smartGateway({ ...query, page: 1, per_page: 50 });
  const totalPages = Math.max(Number(first.total_pages) || 1, Math.ceil((Number(first.total) || 0) / 50));
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => smartGateway({ ...query, page: index + 2, per_page: 50 })));
  return [first, ...rest].flatMap((page) => asArray(page?.records)).filter((record) => record && record.deleted !== "1");
}

// The jobs the signed-in user applied to (Apply on Upwork), newest application first, each with when they applied.
// Who applied comes from the job activity log: this user's latest "Applied" / "Undo Applied" entry on each job
// (written by updateStatus). The jobs are then fetched by the gateway, must still be Applied, and follow the page's
// filters (date, search, department / role, one skill). Returns one page, in the shape of fetchJobsPage.
export async function fetchMyAppliedJobs({ userEmail, dateFilter, search = "", category = "", subcategory = "", skill = "" } = {}) {
  const userId = await findGatewayUserIdByEmail(userEmail);
  const activity = await fetchEveryPage({ action: "fetch", module: JOB_ACTIVITY_MODULE, filters: { user_id: userId, description: { in: ["Applied", "Undo Applied"] } }, order_by: "date_entered", order_dir: "DESC" });
  // Newest first, so the first entry seen for a job is the user's latest action on it.
  const latest = new Map();
  for (const record of activity) if (record.job_id && !latest.has(record.job_id)) latest.set(record.job_id, record);
  const applied = [...latest.values()].filter((record) => record.description === "Applied");
  if (!applied.length) return { records: [], page: 1, perPage: 0, total: 0, totalPages: 1 };

  const query = { action: "fetch", module: JOBS_MODULE, filters: { id: { in: applied.map((record) => record.job_id) }, status: "Applied", ...(await engagementFilters(userEmail)), ...skillGroupFilters({ category, subcategory, skill }) } };
  const searchText = asText(search).trim();
  if (searchText) Object.assign(query, { search: searchText, search_fields: JOB_SEARCH_FIELDS });
  const jobs = new Map((await fetchEveryPage(addGatewayDateFilter(query, dateFilter))).map((record) => [record.id, record]));
  const records = applied.filter((record) => jobs.has(record.job_id)).map((record) => ({
    ...mapGatewayJob(jobs.get(record.job_id)),
    appliedAt: asText(record.date_entered_uni_format || record.date_entered),
    appliedAgo: asText(record.date_entered_time_ago),
  }));
  return { records, page: 1, perPage: records.length, total: records.length, totalPages: 1 };
}

// ----------------------------------------------------
// Jobs page alerts
// ----------------------------------------------------

// The gateway compares date_from / date_to with the stored time in UTC (checked against the records), so the alerts'
// windows ("the last 4 hours") are sent in UTC.
const utcText = (time) => new Date(time).toISOString().slice(0, 19).replace("T", " ");
function lastHours(hours) {
  const now = Date.now();
  return { date_field: "date_entered", date_from: utcText(now - hours * 3_600_000), date_to: utcText(now) };
}

// What the Jobs page alerts on when it opens. The feeder: how many jobs it added in the last 4 hours (all of them, and
// how many of those are scored and ready in the user's scope) and when it last added one. Applications (only with
// `applications`): how many jobs were applied to in the last 24 hours (the user's, or the team's with `allJobs`; a job
// whose latest entry there is "Undo Applied" does not count) and when the last application was.
export async function fetchJobAlerts({ userEmail, allJobs = false, applications = true } = {}) {
  const userId = await findGatewayUserIdByEmail(userEmail);
  const byUser = allJobs ? {} : { user_id: userId };
  const [counts, newestJob, entries, lastApplied] = await Promise.all([
    smartGateway({ action: "get_stats", date_range: "", ...lastHours(4), queries: [
      { key: "added", module: JOBS_MODULE },
      { key: "ready", module: JOBS_MODULE, filters: { ai_processed: 1, ...(allJobs ? {} : { assigned_user_id: userId }) } },
    ] }),
    smartGateway({ action: "fetch", module: JOBS_MODULE, order_by: "date_entered", order_dir: "DESC", page: 1, per_page: 1 }),
    applications ? fetchEveryPage({ action: "fetch", module: JOB_ACTIVITY_MODULE, filters: { ...byUser, description: { in: ["Applied", "Undo Applied"] } }, ...lastHours(24), order_by: "date_entered", order_dir: "DESC" }) : [],
    applications ? smartGateway({ action: "fetch", module: JOB_ACTIVITY_MODULE, filters: { ...byUser, description: "Applied" }, order_by: "date_entered", order_dir: "DESC", page: 1, per_page: 1 }) : {},
  ]);
  // Newest first, so the first entry seen for a job is its latest one in the window.
  const latest = new Map();
  for (const entry of entries) if (entry.job_id && !latest.has(entry.job_id)) latest.set(entry.job_id, entry.description);
  const newest = asArray(newestJob.records).find((record) => record && record.deleted !== "1" && present(record.date_entered));
  const last = asArray(lastApplied.records).find((record) => record && record.deleted !== "1" && present(record.date_entered));
  return {
    added: Number(counts.stats?.added?.count) || 0,
    ready: Number(counts.stats?.ready?.count) || 0,
    lastAddedAt: newest ? parseEnteredAt(newest) : "",
    applied: [...latest.values()].filter((description) => description === "Applied").length,
    lastAppliedAt: last ? parseEnteredAt(last) : "",
  };
}

// ----------------------------------------------------
// Feed preferences (outr_user_preferences): per user, saved in the CRM
// ----------------------------------------------------

export const PREFERENCES_MODULE = import.meta.env?.VITE_USER_PREFERENCES_MODULE || "outr_user_preferences";

const clampPercent = (value, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
};

function mapPreference(record) {
  return {
    id: record.id,
    category: asText(record.category),
    subcategory: asText(record.sub_category),
    // The preference's skill (relate to outr_skills), used instead of the Role.
    skillId: asText(record.skill_id),
    skillName: decodeHtml(asText(record.skill_name)),
    minScore: clampPercent(record.min_ai_score, 0),
    priority: clampPercent(record.priority, 50),
    active: ["1", "true", "on"].includes(asText(record.active).toLowerCase()) || record.active === true || record.active === 1,
    // The "My preferences" checkbox on the Jobs page (user_check), kept on every one of the user's preference records.
    userCheck: ["1", "true", "on"].includes(asText(record.user_check).toLowerCase()) || record.user_check === true || record.user_check === 1,
  };
}

// The signed-in user's preferences, and the CRM's Department / Role choices for them.
export async function fetchMyPreferences(userEmail) {
  const userId = await findGatewayUserIdByEmail(userEmail);
  const first = await smartGateway({ action: "fetch", module: PREFERENCES_MODULE, filters: { user_id: userId }, order_by: "date_entered", order_dir: "ASC", page: 1, per_page: 50 });
  const lists = asObject(first.dropdown_lists);
  const choices = (list) => Object.entries(asObject(list)).map(([value, label]) => ({ value: asText(value), label: decodeHtml(asText(label)) })).filter((option) => option.value);
  const totalPages = Math.max(Number(first.total_pages) || 1, 1);
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => smartGateway({ action: "fetch", module: PREFERENCES_MODULE, filters: { user_id: userId }, order_by: "date_entered", order_dir: "ASC", page: index + 2, per_page: 50 })));
  const records = [first, ...rest].flatMap((page) => asArray(page?.records)).filter((record) => record && record.deleted !== "1").map(mapPreference);
  return { records, options: { category: choices(lists.category), subcategory: choices(lists.sub_category) } };
}

// Creates (no id) or updates one preference of the signed-in user. `name` is a readable summary for the CRM list view.
export async function saveMyPreference(userEmail, preference, labels = {}) {
  const userId = await findGatewayUserIdByEmail(userEmail);
  const minScore = clampPercent(preference.minScore, 0);
  const priority = clampPercent(preference.priority, 50);
  const data = {
    name: `${labels.category || preference.category || "Any department"} / ${asText(preference.skillName) || "Any skill"} · AI score ${minScore}%+`,
    user_id: userId,
    assigned_user_id: userId,
    category: asText(preference.category),
    // Skill replaces Role: the Role is left empty so it does not narrow the jobs.
    sub_category: "",
    skill_id: asText(preference.skillId),
    min_ai_score: minScore,
    priority,
    active: preference.active === false ? 0 : 1,
    user_check: preference.userCheck === false ? 0 : 1,
  };
  if (preference.id) {
    await smartGateway({ action: "update", module: PREFERENCES_MODULE, id: preference.id, data });
    return { ...preference, minScore, priority };
  }
  const created = await smartGateway({ action: "create", module: PREFERENCES_MODULE, data });
  return { ...preference, id: created.id ?? created.record?.id ?? created.data?.id ?? "", minScore, priority };
}

// Saves the "My preferences" checkbox (user_check) on all of the user's preference records, so it follows them.
export async function setMyPreferencesEnabled(preferences, enabled) {
  await Promise.all(asArray(preferences).filter((preference) => preference.id).map((preference) => smartGateway({ action: "update", module: PREFERENCES_MODULE, id: preference.id, data: { user_check: enabled ? 1 : 0 } })));
}

export async function deleteMyPreference(id) {
  if (!id) return;
  await smartGateway({ action: "delete", module: PREFERENCES_MODULE, id });
}

// Jobs that match the user's active preferences, any age, still New or Seen, each tagged with the preference it
// matched (the highest priority wins when several match). The gateway filters by Department, Role and AI score.
// The page's scope (My / All Jobs), search, Department / Role picker and single skill still apply.
export async function fetchPreferredJobs({ userEmail, preferences, allJobs = false, search = "", category = "", subcategory = "", skill = "" } = {}) {
  const active = asArray(preferences)
    .filter((preference) => preference.active)
    // A Department picked in the skills row narrows these too, and so does one picked skill: a preference outside
    // them is skipped (the gateway can match one skill per request).
    .filter((preference) => (!category || !preference.category || preference.category === category)
      && (!asText(skill).trim() || !preference.skillName || preference.skillName.toLowerCase() === asText(skill).trim().toLowerCase()));
  if (!active.length) return [];
  const assignedUserId = allJobs ? null : await findGatewayUserIdByEmail(userEmail);
  const engagement = await engagementFilters(userEmail);
  const searchText = asText(search).trim();
  const lists = await Promise.all(active.map(async (preference) => {
    const filters = {
      ai_processed: 1,
      status: { in: ["New", "Seen"] },
      match_score: { gte: preference.minScore },
      ...engagement,
      // Department + the preference's skill (the same skill match as the Jobs skill filter).
      ...skillGroupFilters({ category: preference.category || category, subcategory, skill: preference.skillName || skill }),
    };
    if (assignedUserId) filters.assigned_user_id = assignedUserId;
    const query = { action: "fetch", module: JOBS_MODULE, filters, order_by: "match_score", order_dir: "DESC" };
    if (searchText) Object.assign(query, { search: searchText, search_fields: JOB_SEARCH_FIELDS });
    // The best 100 per preference is plenty for the top of a feed.
    const pages = await Promise.all([1, 2].map((page) => smartGateway({ ...query, page, per_page: 50 })));
    return pages.flatMap((page) => asArray(page?.records)).filter((record) => record && record.deleted !== "1").map((record) => ({ record, preference }));
  }));
  const best = new Map();
  for (const { record, preference } of lists.flat()) {
    const current = best.get(record.id);
    if (!current) best.set(record.id, { record, preference });
  }
  return [...best.values()].map(({ record, preference }) => ({ ...mapGatewayJob(record), preference: { id: preference.id, category: preference.category, skillName: preference.skillName, minScore: preference.minScore } }));
}

// ----------------------------------------------------
// User feedback (outr_feedback): one CRM record per feedback, linked to the user who gave it
// ----------------------------------------------------

export const FEEDBACK_MODULE = import.meta.env?.VITE_FEEDBACK_MODULE || "outr_feedback";

function mapFeedback(record) {
  return {
    id: record.id,
    userId: asText(record.user_id),
    userName: decodeHtml(asText(record.user_name || record.assigned_user_name)),
    section: decodeHtml(asText(record.section)) || "Portal",
    pageUrl: decodeHtml(asText(record.page_url)),
    type: asText(record.feedback_type) || "other",
    rating: Math.min(5, Math.max(0, Math.round(Number(record.rating) || 0))),
    message: decodeHtml(asText(record.description)),
    status: asText(record.status) || "new",
    createdAt: asText(record.date_entered_uni_format || record.date_entered),
    createdAgo: asText(record.date_entered_time_ago),
  };
}

// Feedback newest first: the signed-in user's own (mine) or everyone's (admin), with the CRM's Type / Status choices.
export async function fetchFeedback({ userEmail = "", mine = false } = {}) {
  const filters = mine ? { user_id: await findGatewayUserIdByEmail(userEmail) } : {};
  const query = { action: "fetch", module: FEEDBACK_MODULE, filters, order_by: "date_entered", order_dir: "DESC" };
  const first = await smartGateway({ ...query, page: 1, per_page: 50 });
  const totalPages = Math.max(Number(first.total_pages) || 1, 1);
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => smartGateway({ ...query, page: index + 2, per_page: 50 })));
  const lists = asObject(first.dropdown_lists);
  const choices = (list) => Object.entries(asObject(list)).map(([value, label]) => [asText(value), decodeHtml(asText(label))]).filter(([value]) => value);
  return {
    records: [first, ...rest].flatMap((page) => asArray(page?.records)).filter((record) => record && record.deleted !== "1").map(mapFeedback),
    options: { type: choices(lists.feedback_type), status: choices(lists.status) },
  };
}

// Saves one feedback from the signed-in user (status New).
export async function createFeedback(userEmail, { section = "", pageUrl = "", type = "other", rating = 0, message = "", typeLabel = "" } = {}) {
  const text = asText(message).trim();
  if (!text) throw createAppError("FEEDBACK_EMPTY", "Write your feedback first.");
  const userId = await findGatewayUserIdByEmail(userEmail);
  const stars = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  const data = {
    name: [asText(section) || "Portal", typeLabel || type, stars ? `★${stars}` : ""].filter(Boolean).join(" · "),
    description: text,
    user_id: userId,
    assigned_user_id: userId,
    section: asText(section) || "Portal",
    page_url: asText(pageUrl).slice(0, 255),
    feedback_type: type,
    rating: stars,
    status: "new",
  };
  const created = await smartGateway({ action: "create", module: FEEDBACK_MODULE, data });
  return created.id ?? created.record?.id ?? created.data?.id ?? "";
}

// Admin: changes a feedback's status.
export async function setFeedbackStatus(id, status) {
  if (!id || !status) return;
  await smartGateway({ action: "update", module: FEEDBACK_MODULE, id, data: { status } });
}

// ----------------------------------------------------
// Custom feeds (outr_feeds): sections any user adds to the nav, one CRM record per feed, linked to its creator
// ----------------------------------------------------

export const FEEDS_MODULE = import.meta.env?.VITE_FEEDS_MODULE || "outr_feeds";

function mapFeed(record) {
  return {
    id: record.id,
    name: decodeHtml(asText(record.name)).trim(),
    // What the feed should show; later sent as the prompt to the endpoint the feed is connected to.
    description: decodeHtml(asText(record.description)).trim(),
    department: asText(record.department),
    skill: decodeHtml(asText(record.skill)).trim(),
    customSkill: decodeHtml(asText(record.custom_skill)).trim(),
    userId: asText(record.user_id || record.assigned_user_id),
    userName: decodeHtml(asText(record.user_name || record.assigned_user_name || record.created_by_name)),
    createdAt: asText(record.date_entered_uni_format || record.date_entered),
    createdAgo: asText(record.date_entered_time_ago),
  };
}

// Every user's feeds, oldest first so the menu order stays the same as feeds are added.
export async function fetchFeeds() {
  const query = { action: "fetch", module: FEEDS_MODULE, order_by: "date_entered", order_dir: "ASC" };
  const first = await smartGateway({ ...query, page: 1, per_page: 50 });
  const totalPages = Math.max(Number(first.total_pages) || 1, 1);
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => smartGateway({ ...query, page: index + 2, per_page: 50 })));
  return [first, ...rest].flatMap((page) => asArray(page?.records)).filter((record) => record && record.deleted !== "1").map(mapFeed).filter((feed) => feed.name);
}

// Saves a new feed from the signed-in user and returns its id.
export async function createFeed(userEmail, { name = "", description = "", department = "", skill = "", customSkill = "" } = {}) {
  const title = asText(name).trim();
  if (!title) throw createAppError("FEED_NAME_EMPTY", "Give the feed a name first.");
  const userId = await findGatewayUserIdByEmail(userEmail);
  const data = {
    name: title,
    description: asText(description).trim(),
    // The Department (CRM dropdown key), Skill (name) and custom skill the feed is about.
    department: asText(department).trim(),
    skill: asText(skill).trim(),
    custom_skill: asText(customSkill).trim(),
    user_id: userId,
    assigned_user_id: userId,
  };
  const created = await smartGateway({ action: "create", module: FEEDS_MODULE, data });
  return created.id ?? created.record?.id ?? created.data?.id ?? "";
}

export async function deleteFeed(id) {
  if (!id) return;
  await smartGateway({ action: "delete", module: FEEDS_MODULE, id });
}

// Why each job was rejected: the reason in its latest "Rejected: …" activity entry, as { [jobId]: reason }.
// One gateway request for the whole list.
export async function fetchRejectReasons(jobIds) {
  const ids = [...new Set(asArray(jobIds).filter(Boolean))];
  if (!ids.length) return {};
  const data = await smartGateway({ action: "fetch", module: JOB_ACTIVITY_MODULE, filters: { job_id: { in: ids }, description: { like: "Rejected:" } }, order_by: "date_entered", order_dir: "DESC", page: 1, per_page: 200 });
  const reasons = {};
  for (const record of asArray(data.records)) {
    const reason = rejectReasonOf(record.description);
    if (record.job_id && reason && !(record.job_id in reasons)) reasons[record.job_id] = reason;
  }
  return reasons;
}

// "Rejected: Budget too low" -> "Budget too low" (anything else -> "").
export function rejectReasonOf(description) {
  const match = /^Rejected:\s*(.+)$/s.exec(decodeHtml(asText(description)).trim());
  return match ? match[1].trim() : "";
}

export async function fetchJobs(options = {}) {
  const page = await fetchJobsPage(options);
  return page.records;
}

// Looked up by id alone, so a job opens the same way from My Jobs and All Jobs.
export async function fetchJobById(id, userEmail) {
  if (!id || !String(id).trim()) throw createAppError("JOB_NOT_FOUND", "Job not found");
  const data = await smartGateway({ action: "fetch", module: JOBS_MODULE, filters: { id, ...(await engagementFilters(userEmail)) }, page: 1, per_page: 1 });
  const record = asArray(data.records).find((item) => item?.id === id);
  if (!record) throw createAppError("JOB_NOT_FOUND", "Job not found");
  return mapGatewayJob(record);
}

export async function fetchCoverLetter(job) {
  if (!COVER_LETTER_URL) {
    throw createAppError("COVER_LETTER_ENDPOINT_MISSING", "The cover letter endpoint is not configured yet. Set VITE_COVER_LETTER_URL in .env.");
  }
  let response;
  try {
    response = await axios.post(COVER_LETTER_URL, {
      id: job.id,
      job_id: job.jobId,
      title: job.title,
      description: job.description,
      skills: job.skills,
      upwork_url: job.url,
    }, { timeout: 90_000, headers: { "Content-Type": "application/json", "X-Api-Token": generateToken() } });
  } catch (err) {
    throw createAppError("COVER_LETTER_FAILED", err?.response?.data?.message || "Could not fetch a cover letter. Please try again.");
  }
  const data = response.data;
  const raw = typeof data === "string" ? data : data?.cover_letter ?? data?.data?.cover_letter ?? data?.content ?? data?.data ?? "";
  const letter = decodeCoverLetter(typeof raw === "string" ? raw : "");
  if (!letter) throw createAppError("COVER_LETTER_EMPTY", "The endpoint did not return a cover letter.");
  return letter;
}

// Saves a cover letter on the CRM job through the gateway, then records `activity` (e.g. "Cover letter edited with AI")
// for the signed-in user. A failed activity entry does not undo the save. Live Upwork jobs have no CRM record, so they stay local.
export async function saveCoverLetter(job, letter, { userEmail, activity } = {}) {
  if (job.status === "Live") return letter;
  await smartGateway({ action: "update", module: JOBS_MODULE, id: job.id, data: { cover_letter: letter } });
  localChanges.set(job.id, { ...(localChanges.get(job.id) || {}), coverLetter: letter });
  if (activity && userEmail) await logJobActivity({ jobId: job.id, userEmail, description: activity }).catch((error) => console.warn("Could not record cover letter activity", error));
  return letter;
}

// ----------------------------------------------------
// AI endpoints (Claude on the auth backend; they need the login session cookie)
// ----------------------------------------------------

async function postAi(path, body, signal) {
  let response;
  try {
    response = await fetch(`${AUTH_ORIGIN}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw createAppError("ABORTED", "Request cancelled");
    throw createAppError("NETWORK_ERROR", "Unable to reach the AI service. Please check your internet connection.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // The backend's `message` is written to be shown to the user.
    if (response.status === 401) throw createAppError("UNAUTHORIZED", data?.message || "Your session has expired. Please sign in again.", { status: 401 });
    throw createAppError(asText(data?.error) || "AI_FAILED", data?.message || "The AI could not answer right now. Please try again.", { status: response.status });
  }
  return asObject(data);
}

// Explains `text` (a selection from a job) the way `prompt` asks; with no prompt, in simple words.
export async function askAi(text, prompt = "", { signal } = {}) {
  const data = await postAi("/api/ai/ask", { text, prompt }, signal);
  const answer = asText(data.answer).trim();
  if (!answer) throw createAppError("AI_EMPTY", "The AI did not return an answer. Please try again.");
  return answer;
}

// Rewrites a cover letter from the user's instructions. The server keeps no history, so send the latest letter each time.
export async function editCoverLetterWithAi(letter, prompt, { signal } = {}) {
  const data = await postAi("/api/ai/cover-letter", { coverLetter: letter, prompt }, signal);
  const coverLetter = asText(data.coverLetter).trim();
  if (!coverLetter) throw createAppError("COVER_LETTER_EMPTY", "The AI did not return a cover letter. Please try again.");
  return { coverLetter, summary: asText(data.summary).trim() };
}

// Asks for a new strategy; the current one is sent along so the endpoint can offer a different angle.
export async function fetchStrategy(job) {
  if (!STRATEGY_URL) {
    throw createAppError("STRATEGY_ENDPOINT_MISSING", "The tips endpoint is not configured yet. Set VITE_STRATEGY_URL in .env.");
  }
  let response;
  try {
    response = await axios.post(STRATEGY_URL, {
      id: job.id,
      job_id: job.jobId,
      title: job.title,
      description: job.description,
      skills: job.skills,
      budget: job.budget,
      level: job.level,
      upwork_url: job.url,
      current_strategy: job.pitch,
    }, { timeout: 90_000, headers: { "Content-Type": "application/json", "X-Api-Token": generateToken() } });
  } catch (err) {
    throw createAppError("STRATEGY_FAILED", err?.response?.data?.message || "Could not generate new tips. Please try again.");
  }
  const data = response.data;
  const raw = typeof data === "string" ? data : data?.strategy ?? data?.pitch ?? data?.data?.strategy ?? data?.data?.pitch ?? data?.content ?? data?.data ?? "";
  const strategy = decodeHtml(typeof raw === "string" ? raw : "").trim();
  if (!strategy) throw createAppError("STRATEGY_EMPTY", "The endpoint did not return any tips.");
  return strategy;
}

let teamMembersRequest = null;

// Active CRM users with an email, used to pick teammates to notify about a job.
export async function fetchTeamMembers() {
  teamMembersRequest ||= (async () => {
    const perPage = 100;
    const first = await smartGateway({ action: "fetch", module: USERS_MODULE, page: 1, per_page: perPage });
    const totalPages = Math.max(Number(first.total_pages) || 1, Math.ceil((Number(first.total) || 0) / perPage));
    const rest = await Promise.all(Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => smartGateway({ action: "fetch", module: USERS_MODULE, page: index + 2, per_page: perPage })));
    return [first, ...rest]
      .flatMap((page) => asArray(page?.records))
      .filter((record) => record && record.deleted !== "1" && String(record.status || "Active") === "Active" && /@/.test(asText(record.email1)))
      .map((record) => ({
        id: record.id,
        email: asText(record.email1).trim(),
        name: decodeHtml([record.first_name, record.last_name].filter(Boolean).join(" ") || record.user_name || record.email1),
        title: decodeHtml(record.title || record.department || ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })().catch((error) => { teamMembersRequest = null; throw error; });
  return teamMembersRequest;
}

// ----------------------------------------------------
// Job activity (who did what on a job, stored in the job activity module)
// ----------------------------------------------------

const userNameCache = new Map();
const pendingActivity = new Map();

// CRM user's display name by id, fetched once per id.
export function fetchUserName(userId) {
  if (!userId) return Promise.resolve("");
  if (!userNameCache.has(userId)) {
    const request = smartGateway({ action: "fetch", module: USERS_MODULE, filters: { id: userId }, page: 1, per_page: 1 })
      .then((data) => {
        const record = data.records?.find((item) => item.id === userId);
        // Users without a first/last name have a blank full_name (" "), so skip blanks and fall back to the login or email.
        const fullName = [record.first_name, record.last_name].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
        const name = record && [fullName, record.full_name, record.name, record.user_name, record.email1].map((value) => String(value || "").trim()).find(Boolean);
        return name ? decodeHtml(name) : "";
      })
      .catch((error) => { userNameCache.delete(userId); throw error; });
    userNameCache.set(userId, request);
  }
  return userNameCache.get(userId);
}

const crmUserResolutionCache = new Map();

/**
 * Resolves CRM user details (userName and userId) based on the logged-in user session
 */
export async function resolveCrmUser(user) {
  if (!user) return { userName: "User", userId: "" };
  const emailKey = String(user.email || user.name || "").trim().toLowerCase();
  if (emailKey && crmUserResolutionCache.has(emailKey)) {
    return crmUserResolutionCache.get(emailKey);
  }

  const promise = (async () => {
    let resolvedId = user.crmUserId || user.crm_user_id || user.id || "";
    let resolvedName = "";

    if (!resolvedId && user.email) {
      try {
        resolvedId = await findGatewayUserIdByEmail(user.email);
      } catch {
        // user not matched in CRM Users table by email
      }
    }

    if (resolvedId) {
      try {
        resolvedName = await fetchUserName(resolvedId);
      } catch {
        // fetch failed
      }
    }

    const finalName = resolvedName || user.name || user.user_name || user.userName || user.email?.split("@")[0] || "User";
    return { userName: finalName, userId: resolvedId };
  })();

  if (emailKey) crmUserResolutionCache.set(emailKey, promise);
  try {
    return await promise;
  } catch {
    if (emailKey) crmUserResolutionCache.delete(emailKey);
    return { userName: user?.name || user?.email?.split("@")[0] || "User", userId: "" };
  }
}

// ----------------------------------------------------
// User roles (CRM ACL roles; a user's role is saved in the "Role" field of their Users record)
// ----------------------------------------------------

// Every CRM role, A-Z, as { id, name, description }.
export async function fetchRoles() {
  const data = await smartGateway({ action: "fetch", module: ROLES_MODULE, order_by: "name", order_dir: "ASC", page: 1, per_page: 100 });
  return asArray(data.records)
    .filter((record) => record?.id && record.deleted !== "1" && asText(record.name).trim())
    .map((record) => ({ id: record.id, name: decodeHtml(asText(record.name).trim()), description: decodeHtml(asText(record.description).trim()) }));
}

// Saves the chosen role in the user's "Role" field, once. The record is read first: a role that is already
// saved is never overwritten from the app (only an admin can change it in the CRM). Then it is read back to confirm.
export async function saveUserRole(crmUserId, role) {
  if (!crmUserId || !role?.id) throw createAppError("ROLE_INVALID", "Choose a role to continue.");
  const before = await smartGateway({ action: "fetch", module: USERS_MODULE, filters: { id: crmUserId }, page: 1, per_page: 1 });
  const record = asArray(before.records).find((item) => item?.id === crmUserId);
  if (!record) throw createAppError("CRM_USER_NOT_FOUND", "Your CRM user could not be found.");
  const existing = asText(record.aclrole_id_c).trim();
  if (existing === role.id) return role;
  if (existing) throw createAppError("ROLE_ALREADY_SET", "A role is already saved for your account. Only an admin can change it.");
  await smartGateway({ action: "update", module: USERS_MODULE, id: crmUserId, data: { aclrole_id_c: role.id } });
  const check = await smartGateway({ action: "fetch", module: USERS_MODULE, filters: { id: crmUserId }, page: 1, per_page: 1 });
  const saved = asText(asArray(check.records).find((item) => item?.id === crmUserId)?.aclrole_id_c).trim();
  if (saved !== role.id) throw createAppError("ROLE_NOT_SAVED", "Your role could not be saved. Please try again or ask an admin.");
  return role;
}

// Activity on a CRM job, newest first, each with the name of the user who did it.
export async function fetchJobActivity(jobId) {
  if (!jobId) return [];
  const data = await smartGateway({ action: "fetch", module: JOB_ACTIVITY_MODULE, filters: { job_id: jobId }, order_by: "date_entered", order_dir: "DESC", page: 1, per_page: 100 });
  const records = (data.records || []).filter((record) => record.deleted !== "1");
  const names = await Promise.all(records.map((record) => fetchUserName(record.user_id).catch(() => "")));
  return records.map((record, index) => ({
    id: record.id,
    userId: record.user_id,
    userName: names[index] || "Someone",
    description: decodeHtml(record.description || ""),
    timeAgo: record.date_entered_time_ago || "",
    date: record.date_entered_uni_format || record.date_entered || "",
  }));
}

// Records one activity by the signed-in user. With `once`, nothing is created when the same
// user already has this description on this job. Resolves to true when an entry was created.
export function logJobActivity({ jobId, userEmail, description, once = false }) {
  const key = `${userEmail}|${jobId}|${description}`;
  if (once && pendingActivity.has(key)) return pendingActivity.get(key);
  const request = (async () => {
    const userId = await findGatewayUserIdByEmail(userEmail);
    if (once) {
      const existing = await smartGateway({ action: "fetch", module: JOB_ACTIVITY_MODULE, filters: { user_id: userId, job_id: jobId, description }, page: 1, per_page: 1 });
      if ((existing.records || []).some((record) => record.deleted !== "1")) return false;
    }
    await smartGateway({ action: "create", module: JOB_ACTIVITY_MODULE, data: { name: description, user_id: userId, job_id: jobId, description, assigned_user_id: userId } });
    return true;
  })();
  if (!once) return request;
  pendingActivity.set(key, request);
  // Keep successful "once" checks so reopening the job in this session skips the lookup.
  request.catch(() => pendingActivity.delete(key));
  return request;
}

// The activity entry for a status change; New -> Seen is covered by the "Seen" entry logged on open.
function statusActivity(from, to) {
  if (from === to || (from === "New" && to === "Seen")) return "";
  if (to === "Seen" && (from === "Applied" || from === "Rejected")) return `Undo ${from}`;
  return to;
}

// ----------------------------------------------------
// Likes and saves (one CRM record per user and job)
// ----------------------------------------------------

// Likes live in outr_likes, saves in outr_saves; each record is { user_id, content_id, content_module }.
const REACTION_MODULES = { liked: "outr_likes", saved: "outr_saves" };

// The CRM user id from the signed-in session when it carries one, otherwise looked up by email.
// The session's own `id` is the login provider's id, not a CRM user, so it is never used here.
async function reactionUserId(user) {
  const sessionId = asText(user?.crmUserId || user?.crm_user_id || user?.crmUser?.id || user?.crm_user?.id).trim();
  return sessionId || findGatewayUserIdByEmail(user?.email);
}

async function fetchReactionRecords(module, filters) {
  const perPage = 200;
  const first = await smartGateway({ action: "fetch", module, filters, page: 1, per_page: perPage });
  const totalPages = Math.max(1, Number(first.total_pages) || 1);
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => smartGateway({ action: "fetch", module, filters, page: index + 2, per_page: perPage })));
  return [first, ...rest].flatMap((page) => asArray(page?.records)).filter((record) => record && record.deleted !== "1" && record.content_id);
}

// { liked: [jobId], saved: [jobId] } for the signed-in user, newest first.
export async function fetchJobReactions(user) {
  const userId = await reactionUserId(user);
  const [liked, saved] = await Promise.all(Object.values(REACTION_MODULES).map((module) =>
    fetchReactionRecords(module, { user_id: userId, content_module: JOBS_MODULE })
      .then((records) => [...new Set(records.sort((a, b) => Date.parse(parseEnteredAt(b)) - Date.parse(parseEnteredAt(a))).map((record) => record.content_id))])));
  return { liked, saved };
}

// Adds or removes the user's like/save on a job. Adding skips a record that already exists;
// removing deletes every matching record, so a double click elsewhere cannot leave one behind.
export async function setJobReaction(user, kind, jobId, on) {
  const module = REACTION_MODULES[kind];
  if (!module || !jobId) throw createAppError("REACTION_INVALID", "This job could not be updated.");
  const userId = await reactionUserId(user);
  const filters = { user_id: userId, content_id: jobId, content_module: JOBS_MODULE };
  const existing = await fetchReactionRecords(module, filters);
  if (on) {
    if (!existing.length) await smartGateway({ action: "create", module, data: filters });
  } else {
    await Promise.all(existing.map((record) => smartGateway({ action: "delete", module, id: record.id })));
  }
  return on;
}

// ----------------------------------------------------
// Live Upwork jobs (fetched straight from Upwork through the gateway)
// ----------------------------------------------------

const LIVE_LEVELS = { ENTRY_LEVEL: "Entry level", ENTRY: "Entry level", INTERMEDIATE: "Intermediate", EXPERT: "Expert" };

// Upwork sends "2026-10-14T09:31:58+0000"; the colon-less offset is not valid ISO everywhere.
function parseUpworkDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const money = (value) => {
  const amount = Number(value?.rawValue ?? value?.amount ?? value);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "";
};

function liveBudget(record) {
  const fixed = money(record.amount);
  if (fixed) return { amount: fixed, type: "Fixed price" };
  const min = money(record.hourlyBudgetMin), max = money(record.hourlyBudgetMax);
  if (min || max) return { amount: `${[min, max].filter(Boolean).join("–")}/hr`, type: "Hourly" };
  const hourly = (record.hourlyBudgetType && record.hourlyBudgetType !== "NOT_PROVIDED") || /hrs?\/week|hours/i.test(record.engagement || "");
  return { amount: "Budget not specified", type: hourly ? "Hourly" : "Fixed price" };
}

// Upwork skills arrive as { prettyName, name, highlighted } objects; plain strings are accepted too.
const liveSkillName = (skill) => (typeof skill === "string" ? skill : skill?.prettyName || skill?.name || "");

export function mapLiveJob(input) {
  const record = asObject(input);
  const client = asObject(record.client);
  const location = asObject(client.location);
  const budget = liveBudget(record);
  const category = record.occupations?.category?.prefLabel || humanize(record.category);
  const subcategory = record.occupations?.subCategories?.[0]?.prefLabel || humanize(record.subcategory);
  const rating = Number(client.totalFeedback);
  const workload = record.engagement && !/to be determined|not sure/i.test(record.engagement) ? record.engagement : "";
  const country = location.country || "";
  const url = record.url || (record.ciphertext ? `https://www.upwork.com/jobs/${record.ciphertext}` : "");
  return {
    id: record.id,
    jobId: record.ciphertext || record.id,
    title: decodeHtml(record.title || "Untitled job"),
    company: category || "Upwork client",
    location: country || "Location not shared",
    posted: "",
    postedAt: parseUpworkDate(record.publishedDateTime) || parseUpworkDate(record.createdDateTime) || new Date().toISOString(),
    renewedAt: parseUpworkDate(record.renewedDateTime),
    budget: budget.amount,
    type: budget.type,
    level: LIVE_LEVELS[String(record.experienceLevel || "").toUpperCase()] || humanize(String(record.experienceLevel || "").toLowerCase()) || "Not specified",
    duration: record.durationLabel || record.engagementDuration?.label || "Duration not set",
    workload,
    status: "Live",
    match: 0,
    summary: "",
    tags: [category, subcategory].filter(Boolean),
    skills: [...new Set(asArray(record.skills).map(liveSkillName).filter(Boolean))],
    highlightedSkills: asArray(record.skills).filter((skill) => skill?.highlighted).map(liveSkillName).filter(Boolean),
    matchedSkills: asArray(record.matched_skills).map(asText).filter(Boolean),
    url,
    applyUrl: buildUpworkApplyUrl(url),
    description: decodeHtml(record.description || "") || "No description provided.",
    applicants: Number(record.totalApplicants) || 0,
    freelancersToHire: Number(record.freelancersToHire) || Number(record.totalFreelancersToHire) || 0,
    preferredLocations: asArray(record.preferredFreelancerLocation).map(asText).filter(Boolean),
    preferredLocationMandatory: Boolean(record.preferredFreelancerLocationMandatory),
    enterprise: Boolean(record.enterprise),
    premium: Boolean(record.premium),
    clientStats: {
      country,
      city: location.city || "",
      timezone: location.timezone && location.timezone !== "Etc/UTC" ? location.timezone : "",
      rating: rating > 0 ? rating : null,
      reviews: Number(client.totalReviews) || null,
      hires: client.totalHires != null ? Number(client.totalHires) : null,
      activeHires: null,
      proposals: record.totalApplicants != null ? Number(record.totalApplicants) : null,
      jobsPosted: client.totalPostedJobs != null ? Number(client.totalPostedJobs) : null,
      hireRate: "",
      openJobs: null,
      totalSpent: money(client.totalSpent),
      avgHourlyRate: "",
      totalHours: "",
      paymentVerified: String(client.verificationStatus || "").toUpperCase() === "VERIFIED",
      phoneVerified: null,
      companyName: client.companyName || "",
      location: country || "Location not shared",
      spent: money(client.totalSpent) || "—",
    },
    raw: record,
  };
}

// Upwork is queried live, which can take a while, so this call gets a longer timeout than the CRM fetches.
export async function fetchLiveUpworkJobs({ skills = [], minutes = 60, includeRenewed = true, signal } = {}) {
  const cleaned = [...new Set(asArray(skills).map((skill) => asText(skill).trim()).filter(Boolean))];
  if (!cleaned.length) throw createAppError("LIVE_SKILLS_REQUIRED", "Pick at least one skill to search.");
  const data = await smartGateway({ action: "fetch_live_upwork_jobs", skills: cleaned, minutes, include_renewed: includeRenewed ? 1 : 0 }, { timeout: 90_000, signal });
  // A job matching several skills can come back once per skill; merge those into one entry.
  const byId = new Map();
  asArray(data.jobs).map(mapLiveJob).filter((job) => job.id != null).forEach((job) => {
    const seen = byId.get(job.id);
    byId.set(job.id, seen ? { ...seen, matchedSkills: [...new Set([...seen.matchedSkills, ...job.matchedSkills])] } : job);
  });
  const jobs = [...byId.values()].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  return {
    jobs,
    total: Number(data.total_jobs) || jobs.length,
    skillsSearched: asObject(data.skills_searched),
    windowMinutes: Number(data.window_minutes) || minutes,
    includeRenewed: Boolean(data.include_renewed ?? includeRenewed),
    generatedAt: data.generated_at || new Date().toISOString(),
    cutoff: data.cutoff_utc || "",
    errors: asArray(data.errors),
    skills: cleaned,
  };
}

// Skill category dropdown (e.g. "Digital Marketing", "Development"). The field name can be set in .env.
const SKILL_CATEGORY_FIELD = import.meta.env?.VITE_SKILL_CATEGORY_FIELD || "category";

function skillCategory(record) {
  const value = [record[SKILL_CATEGORY_FIELD], record.category, record.category_c, record.skill_category].map((item) => asText(item).trim()).find(Boolean) || "";
  return /^none$/i.test(value) ? "" : humanize(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

// Upwork posting time in the CRM's own format, "Fri, 16 Oct 2026 16:12 IST", so parsePostedAt reads it back.
function istPosted(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute} IST`;
}

// A mapped live job as a CRM jobs record, in the same text formats the importer writes
// (budget "Budget, workload, duration, level"; client "Country; hires, rating, payment; proposals").
function liveJobToCrmRecord(input) {
  const job = asObject(input);
  const raw = asObject(job.raw);
  const client = asObject(job.clientStats);
  const key = asText(job.jobId).replace(/^~/, "");
  const skills = asArray(job.skills).map(asText).filter(Boolean);
  const matched = asArray(job.matchedSkills).map(asText).filter(Boolean);
  const description = asText(job.description) === "No description provided." ? "" : asText(job.description);
  const budget = [job.budget, job.workload, job.duration !== "Duration not set" && job.duration, job.level !== "Not specified" && job.level].filter(Boolean).join(", ");
  const clientFacts = [
    client.hires != null && `${client.hires} hires`,
    client.rating != null && `★${client.rating}${client.reviews ? ` (${client.reviews} reviews)` : ""}`,
    client.totalSpent && `${client.totalSpent} spent`,
    client.paymentVerified ? "payment verified" : "payment not verified",
  ].filter(Boolean).join(", ");
  const clientText = [client.country, clientFacts, client.proposals != null && `${client.proposals} proposals`].filter(Boolean).join("; ");
  return {
    name: asText(job.title),
    job_title: asText(job.title),
    job_id: key,
    upwork_url: asText(job.url),
    skills: skills.join(", "),
    matched_skills: matched.join(", "),
    category: asText(raw.category),
    budget,
    posted: istPosted(job.postedAt),
    client: clientText,
    status: "New",
    ai_processed: 1,
    description: [
      `Upwork link: ${asText(job.url)}`,
      `Upwork key: ${key}`,
      "Status: New",
      "",
      `Found with: ${matched.join(", ")}`,
      `Skills: ${skills.join(", ")}`,
      "",
      "--- Upwork job description ---",
      description,
    ].join("\n"),
  };
}

// Saves a live Upwork job as a CRM job so it shows in the Jobs section.
// A job already in the CRM (same Upwork key) is not created twice; its id is returned instead.
export async function saveLiveJobToCrm(job) {
  const record = liveJobToCrmRecord(job);
  if (!record.job_id) throw createAppError("LIVE_JOB_INVALID", "This job has no Upwork id, so it cannot be saved.");
  const existing = await smartGateway({ action: "fetch", module: JOBS_MODULE, filters: { job_id: record.job_id }, page: 1, per_page: 1 });
  const found = asArray(existing.records).find((item) => item && item.deleted !== "1");
  if (found?.id) return { id: found.id, existed: true };
  const data = await smartGateway({ action: "create", module: JOBS_MODULE, data: record });
  return { id: data.id ?? data.record?.id ?? data.data?.id ?? "", existed: false };
}

export async function fetchSkills({ page = 1, perPage = 20 } = {}) {
  // Sorted by name so pages never overlap: without an order the gateway repeated some skills and left others out.
  const data = await smartGateway({ action: "fetch", module: SKILLS_MODULE, order_by: "name", order_dir: "ASC", page, per_page: perPage });
  return {
    // Skill names are sorted and compared as text in the UI, so every record gets a string name.
    records: asArray(data.records).filter((record) => record && record.deleted !== "1").map((record) => ({ ...record, name: asText(record.name).trim(), category: skillCategory(record) })).filter((record) => record.name),
    page: Number(data.page) || page,
    perPage: Number(data.per_page) || perPage,
    total: Number(data.total) || 0,
    totalPages: Number(data.total_pages) || 1,
  };
}

// `group` ({ category, subcategory } dropdown keys) files the new skill under that category / sub category.
export async function createSkill(name, group = {}) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw createAppError("SKILL_NAME_REQUIRED", "Enter a skill name.");
  return smartGateway({ action: "create", module: SKILLS_MODULE, data: { name: trimmedName, ...skillGroupFilters({ category: group?.category, subcategory: group?.subcategory }) } });
}

export async function updateSkill(id, name) {
  const trimmedName = String(name || "").trim();
  if (!id) throw createAppError("SKILL_ID_REQUIRED", "Skill ID is required.");
  if (!trimmedName) throw createAppError("SKILL_NAME_REQUIRED", "Enter a skill name.");
  return smartGateway({ action: "update", module: SKILLS_MODULE, id, data: { name: trimmedName } });
}

export async function deleteSkill(id) {
  if (!id) throw createAppError("SKILL_ID_REQUIRED", "Skill ID is required.");
  return smartGateway({ action: "delete", module: SKILLS_MODULE, id });
}

// ---- The user's own skills (CRM: Users <-> Skills) and the jobs linked to them (Upwork Jobs <-> Skills) ----

// Skill names compared: case and extra spaces do not matter ("Core  PHP" = "core php").
const skillKey = (name) => asText(name).trim().replace(/\s+/g, " ").toLowerCase();

// The skills linked to a CRM user, A-Z, as { id, name }.
export async function fetchUserSkills(crmUserId) {
  if (!crmUserId) return [];
  const records = await fetchEveryPage({ action: "fetch_related", module: USERS_MODULE, id: crmUserId, related_module: SKILLS_MODULE, fields: ["id", "name"] });
  return records.map((record) => ({ id: record.id, name: asText(record.name).trim() })).filter((skill) => skill.name).sort((a, b) => a.name.localeCompare(b.name));
}

// How many skills a CRM user has (for the "pick your skills" step at login).
export async function countUserSkills(crmUserId) {
  const data = await smartGateway({ action: "fetch_related", module: USERS_MODULE, id: crmUserId, related_module: SKILLS_MODULE, fields: ["id"], page: 1, per_page: 1 });
  return Number(data.total) || asArray(data.records).length;
}

export async function fetchMySkills(userEmail) {
  return fetchUserSkills(await findGatewayUserIdByEmail(userEmail));
}

export async function saveMySkills(userEmail, skills) {
  return saveUserSkills(await findGatewayUserIdByEmail(userEmail), skills);
}

// Saves a CRM user's skills (the user's own, or any user's from the admin panel): links the picked ones and unlinks
// the rest. A skill typed in ({ name }, no id) is matched by name first and created (active, no department) when the
// Skills module does not have it. Returns the saved skills.
export async function saveUserSkills(userId, skills) {
  if (!userId) throw createAppError("USER_MISSING", "No user was given.");
  const [current, all] = await Promise.all([fetchUserSkills(userId), fetchSkillsInGroup()]);
  const idByName = new Map(all.map((skill) => [skillKey(skill.name), skill.id]));
  const wanted = new Set();
  for (const skill of asArray(skills)) {
    const name = asText(skill?.name).trim().replace(/\s+/g, " ");
    let id = skill?.id && !String(skill.id).startsWith("new:") ? skill.id : idByName.get(skillKey(name));
    if (!id && name) {
      const created = await smartGateway({ action: "create", module: SKILLS_MODULE, data: { name, is_active: 1 } });
      id = created.id ?? created.record?.id ?? created.data?.id;
      if (!id) throw createAppError("SKILL_NOT_CREATED", `The skill "${name}" could not be added. Please try again.`);
      idByName.set(skillKey(name), id);
    }
    if (id) wanted.add(id);
  }
  const have = new Set(current.map((skill) => skill.id));
  const relate = (action, skillId) => smartGateway({ action, module: USERS_MODULE, id: userId, related_module: SKILLS_MODULE, related_id: skillId });
  await Promise.all([
    ...[...wanted].filter((id) => !have.has(id)).map((id) => relate("add_relationship", id)),
    ...[...have].filter((id) => !wanted.has(id)).map((id) => relate("remove_relationship", id)),
  ]);
  return fetchUserSkills(userId);
}

// The ids of every scored job linked to any of these skills, for the Jobs page's "My skills" filter.
export async function fetchSkillJobIds(skillIds = []) {
  const ids = [...new Set(asArray(skillIds).filter(Boolean))];
  const lists = await Promise.all(ids.map((id) => fetchEveryPage({ action: "fetch_related", module: SKILLS_MODULE, id, related_module: JOBS_MODULE, filters: { ai_processed: 1 }, fields: ["id"] })));
  return [...new Set(lists.flat().map((record) => record.id).filter(Boolean))];
}

export const cleanJobUrl = (value) => {
  let url;
  // A malformed URL (typed by the user or stored on a job) compares as plain text instead of throwing.
  try { url = new URL(asText(value).trim()); } catch { return asText(value).trim().replace(/\/$/, ""); }
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
    const matched = asText(record.source_note).split(/·|\(|,/)[0]?.trim();
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

export function mapGatewayTechNews(input) {
  const record = asObject(input);
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

const TECH_NEWS_SEARCH_FIELDS = [
  "name",
  "summary",
  "description",
  "category",
  "source_note",
  "tag",
  "source",
];

export async function fetchTechNews({
  page = 1,
  perPage = DEFAULT_TECH_NEWS_PER_PAGE,
  category,
  tag,
  sourceType,
  priority,
  search,
  filters = {},
  dateFilter,
} = {}) {
  const gatewayFilters = { ...filters };
  if (category && category !== "All") {
    gatewayFilters.category = category;
  }
  if (priority && priority !== "All") {
    gatewayFilters.priority = priority;
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

  const cleanSearch = asText(search).trim();
  const activeTag = asText(tag || sourceType);
  const hasTag = activeTag && activeTag !== "All";

  if (cleanSearch) {
    queryPayload.search = cleanSearch;
    queryPayload.search_fields = TECH_NEWS_SEARCH_FIELDS;
  } else if (hasTag) {
    queryPayload.search = activeTag.replace(/^#/, "");
    queryPayload.search_fields = ["tag"];
  }

  const data = await smartGateway(addGatewayDateFilter(queryPayload, dateFilter));
  const records = asArray(data.records).map(mapGatewayTechNews);

  return {
    records,
    total: Number(data.total) || records.length,
    page: Number(data.page) || page,
    perPage: Number(data.per_page) || perPage,
    totalPages: Number(data.total_pages) || Math.ceil((Number(data.total) || records.length) / perPage),
  };
}

export async function fetchTechNewsStats({ dateFilter } = {}) {
  const categories = [
    "Other Tech (Cloud)",
    "AI",
    "Other Tech (Security)",
    "Tech Product",
    "Other Tech (Hardware)",
    "Other Tech (Dev Tools)",
    "Other Tech (Business)",
  ];

  const queries = [
    { key: "total", module: TECH_NEWS_MODULE },
    { key: "FirstParty", module: TECH_NEWS_MODULE, search: "FirstParty", search_fields: ["tag"] },
    { key: "ThirdParty", module: TECH_NEWS_MODULE, search: "ThirdParty", search_fields: ["tag"] },
    { key: "YouBlogging", module: TECH_NEWS_MODULE, search: "YouBlogging", search_fields: ["tag"] },
    { key: "HurryUp", module: TECH_NEWS_MODULE, search: "HurryUp", search_fields: ["tag"] },
    ...categories.map((cat) => ({
      key: `cat_${cat}`,
      module: TECH_NEWS_MODULE,
      filters: { category: cat },
    })),
  ];

  const data = await smartGateway({
    action: "get_stats",
    date_range: "",
    date_field: dateFilter?.date_field || "",
    date_from: dateFilter?.date_from || "",
    date_to: dateFilter?.date_to || "",
    queries,
  });

  const stats = {};
  for (const [key, val] of Object.entries(asObject(data.stats))) {
    stats[key] = Number(val?.count) || 0;
  }
  return stats;
}

export async function fetchTechNewsById(id) {
  if (!id || !String(id).trim()) throw createAppError("STORY_NOT_FOUND", "Story not found");
  const data = await smartGateway({
    action: "fetch",
    module: TECH_NEWS_MODULE,
    filters: { id },
    page: 1,
    per_page: 1,
  });

  const record = asArray(data.records).find((item) => item?.id === id);
  if (!record) throw createAppError("STORY_NOT_FOUND", "Story not found");
  return mapGatewayTechNews(record);
}

const techNewsCache = new Map();
const inFlightTechNewsRequests = new Map();

export async function fetchAllTechNews({ forceRefresh = false, dateFilter = null, search = "" } = {}) {
  const now = Date.now();
  const cleanSearch = String(search || "").trim();
  const cacheKey = JSON.stringify({ dateFilter: dateFilter || {}, search: cleanSearch });
  const cached = techNewsCache.get(cacheKey);
  if (!forceRefresh && cached && now - cached.timestamp < 120_000) {
    return cached.data;
  }

  if (!forceRefresh && inFlightTechNewsRequests.has(cacheKey)) {
    return inFlightTechNewsRequests.get(cacheKey);
  }

  const request = (async () => {
    try {
      const first = await fetchTechNews({ page: 1, perPage: 50, dateFilter, search: cleanSearch });
      const total = Number(first.total) || first.records.length;
      const computedTotalPages = Math.max(Number(first.totalPages) || 1, Math.ceil(total / 50));
      let allRecords = [...first.records];

      if (computedTotalPages > 1) {
        for (let p = 2; p <= Math.min(computedTotalPages, 10); p++) {
          try {
            const nextPage = await fetchTechNews({ page: p, perPage: 50, dateFilter, search: cleanSearch });
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

// ----------------------------------------------------
// Video feeds and site content (content briefs, no media)
// ----------------------------------------------------

async function fetchAllRecords(module, perPage = 50) {
  const query = (page) => smartGateway({ action: "fetch", module, order_by: "date_entered", order_dir: "DESC", page, per_page: perPage });
  const first = await query(1);
  const total = Number(first.total) || asArray(first.records).length;
  const totalPages = Math.max(Number(first.total_pages) || 1, Math.ceil(total / perPage));
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => query(index + 2)));
  return [first, ...rest].flatMap((page) => asArray(page?.records)).filter((record) => record && typeof record === "object" && record.deleted !== "1");
}

const splitTags = (value) => decodeHtml(value || "").split(/\s+/).map((tag) => tag.trim()).filter((tag) => tag.startsWith("#"));

// "0:00 Result first: ..." lines become timeline beats.
function parseOutline(description) {
  return decodeHtml(description || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
    if (!match) return { time: "", seconds: null, label: "", text: line };
    const [minutes, seconds] = match[1].split(":").map(Number);
    const labelMatch = match[2].match(/^([^:.]{2,40}):\s*(.*)$/);
    return { time: match[1], seconds: minutes * 60 + seconds, label: labelMatch?.[1] || "", text: labelMatch ? labelMatch[2] : match[2] };
  });
}

export function mapVideoFeed(input) {
  const record = asObject(input);
  const flags = splitTags(record.flags);
  return {
    id: record.id,
    title: decodeHtml(record.name || "Untitled video idea"),
    outline: parseOutline(record.description),
    feedDate: record.feed_date || "",
    match: Number(record.match_percent) || 0,
    rating: Math.round((Number(record.rating) || 0) * 10) / 10,
    sourceUrl: record.source_url || "",
    effort: decodeHtml(record.effort || ""),
    flags,
    firstParty: flags.some((tag) => /firstparty/i.test(tag)),
    hurryUp: flags.some((tag) => /hurryup/i.test(tag)),
    format: decodeHtml(record.video_format || ""),
    whyChosen: decodeHtml(record.why_chosen || ""),
    duplicateCheck: decodeHtml(record.duplicate_check || ""),
    priority: asText(record.priority).toUpperCase(),
    category: decodeHtml(record.category || "General"),
    targetSearchTerm: decodeHtml(record.target_search_term || ""),
    hashtags: splitTags(record.hashtags),
    midRoll: flag(record.mid_roll),
    posted: record.date_entered_time_ago || record.date_entered_uni_format || "Recently",
    postedAt: parseEnteredAt(record),
  };
}

// Description lines look like "Keywords: primary; secondary, secondary". Unlabelled lines are kept as notes.
function parseBrief(description) {
  const sections = [];
  decodeHtml(description || "").split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const match = line.match(/^([A-Z][A-Za-z ]{1,24}):\s*(.+)$/);
    sections.push(match ? { label: match[1], value: match[2] } : { label: "", value: line });
  });
  return sections;
}

function parseKeywords(value) {
  const [primary, ...rest] = String(value || "").split(";");
  return {
    primary: primary?.trim() || "",
    secondary: rest.join(";").split(",").map((keyword) => keyword.trim()).filter(Boolean),
  };
}

export function mapSiteContent(input) {
  const record = asObject(input);
  const brief = parseBrief(record.description);
  const keywords = parseKeywords(brief.find((section) => /^keywords?$/i.test(section.label))?.value);
  const references = Array.from({ length: 8 }, (_, index) => record[`reference_link_${index + 1}`])
    .filter((link) => /^https?:\/\//i.test(link || ""))
    .filter((link, index, links) => links.indexOf(link) === index);
  return {
    id: record.id,
    site: decodeHtml(record.name || "Unknown site"),
    headline: decodeHtml(record.headline || record.name || "Untitled idea"),
    summary: decodeHtml(record.summary || ""),
    angle: decodeHtml(record.content_angle || ""),
    brief: brief.filter((section) => !/^keywords?$/i.test(section.label)),
    keywords,
    source: decodeHtml(record.source || ""),
    sourceUrl: record.source_url || "",
    sourceNote: decodeHtml(record.source_note || ""),
    references,
    partyType: asText(record.party_type).replace("#", ""),
    priority: Number(record.priority) || 99,
    importance: asText(record.importance).toUpperCase(),
    category: decodeHtml(record.category || "General"),
    done: flag(record.is_done),
    itemNumber: Number(record.item_number) || null,
    publishedUrl: record.published_url || "",
    notesId: record.notes_id || "",
    posted: record.date_entered_time_ago || record.date_entered_uni_format || "Recently",
    postedAt: parseEnteredAt(record),
  };
}

export async function fetchNote(noteId, { timeout = 600_000 } = {}) {
  if (!noteId) return null;
  const data = await smartGateway(
    {
      action: "fetch",
      module: "Notes",
      page: 1,
      per_page: 1,
      filters: { id: noteId },
    },
    { timeout }
  );
  const rec = asArray(data.records)[0];
  if (!rec || typeof rec !== "object") return null;
  return {
    id: rec.id,
    name: decodeHtml(rec.name || ""),
    status: asText(rec.status || "queued").toLowerCase(),
    filename: rec.filename || "",
    fileMimeType: rec.file_mime_type || "",
    documentUrl: rec.document_url || getDocumentDownloadUrl(rec.id),
    viewUrl: rec.view_url || getDocumentViewUrl(rec.id),
    userName: rec.user_name || rec.created_by_name || rec.assigned_user_name || "",
    dateEntered: rec.date_entered_time_ago || rec.date_entered_uni_format || rec.date_entered || "",
    dateModified: rec.date_modified_time_ago || rec.date_modified_uni_format || rec.date_modified || "",
  };
}

export async function generateTechContentDoc(contentId, options = {}) {
  if (!contentId) throw createAppError("INVALID_ID", "Content ID is required");
  const userName = typeof options === "string" ? options : (options?.userName || options?.user_name || options?.username || "");
  const userId = typeof options === "object" ? (options?.userId || options?.user_id || "") : "";
  const suggestion = typeof options === "object" ? asText(options?.suggestion).trim() : "";
  const baseEntryPoint = import.meta.env?.DEV
    ? "/crm-entrypoint/index.php?entryPoint=TechContentDocx"
    : TECH_CONTENT_DOCX_URL;
  const separator = baseEntryPoint.includes("?") ? "&" : "?";
  let url = `${baseEntryPoint}${separator}id=${encodeURIComponent(contentId)}`;
  if (userName) {
    url += `&user_name=${encodeURIComponent(userName)}&username=${encodeURIComponent(userName)}&user=${encodeURIComponent(userName)}`;
  }
  if (userId) {
    url += `&user_id=${encodeURIComponent(userId)}&assigned_user_id=${encodeURIComponent(userId)}`;
  }
  // The user's suggestion for this generation (the Note's "suggestion"; the socket events echo it).
  if (suggestion) url += `&suggestion=${encodeURIComponent(suggestion)}`;
  // The user also goes in the URL above. On the live site the request goes straight to the CRM, and custom
  // headers would make the browser ask TechContentDocx for CORS permission first; the CRM refuses (400, no CORS
  // headers), so the request was never sent and nothing was generated. Without them it is a simple request that
  // reaches the CRM; its reply may still be unreadable there, which handleGenerateDoc treats as "queued" (the live
  // socket reports the new document). Through the dev proxy (same site) the headers are kept as before.
  const headers = {};
  if (import.meta.env?.DEV && userName) headers["X-User-Name"] = userName;
  if (import.meta.env?.DEV && userId) headers["X-User-Id"] = userId;
  const response = await fetch(url, { headers });
  // HTTP 202 Accepted is the expected standard response for queued async jobs
  if (!response.ok && response.status !== 202) {
    throw createAppError("DOC_GEN_FAILED", `Failed to initiate document generation (${response.status})`);
  }
  const result = await response.json();
  return result;
}

export async function fetchVideoFeeds() {
  return (await fetchAllRecords(VIDEO_FEEDS_MODULE)).map(mapVideoFeed);
}

export async function fetchSiteContent() {
  return (await fetchAllRecords(SITE_CONTENT_MODULE)).map(mapSiteContent);
}

// ----------------------------------------------------
// WordPress market feed (outr_wordpress): trending plugins, themes, blocks... each with a build opportunity
// ----------------------------------------------------

export const WORDPRESS_MODULE = import.meta.env?.VITE_WORDPRESS_MODULE || "outr_wordpress";

// Multi-select values arrive as "^ai^,^content^".
const splitMultiEnum = (value) => asText(value).split(",").map((item) => item.replace(/\^/g, "").trim()).filter(Boolean);

// The CRM's edit form saves an empty URL field as "http://"; only a link with an address is kept.
const linkOf = (value) => (/^https?:\/\/[^\s/]+\.[^\s]/i.test(asText(value).trim()) ? asText(value).trim() : "");

// "10/18/2026" or "10/20/2026 09:00" (CRM time, IST) -> ISO; "" when missing.
function parseCrmDate(value) {
  const match = asText(value).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return "";
  const [, month, day, year, hour = "00", minute = "00"] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+05:30`).toISOString();
}

function mapWordpressItem(record) {
  return {
    id: record.id,
    name: decodeHtml(record.name),
    summary: decodeHtml(record.summary),
    description: decodeHtml(record.description),
    opportunity: decodeHtml(record.opportunity),
    itemType: asText(record.item_type),
    category: asText(record.category),
    pricingType: asText(record.pricing_type),
    price: numberOrNull(record.price),
    tags: splitMultiEnum(record.tags),
    source: asText(record.source),
    sourceUrl: linkOf(record.source_url),
    demoUrl: linkOf(record.demo_url),
    author: decodeHtml(record.author),
    installs: numberOrNull(record.installs),
    sales: numberOrNull(record.sales_count),
    rating: numberOrNull(record.rating),
    demandScore: numberOrNull(record.demand_score),
    trend: asText(record.trend),
    status: asText(record.feed_status) || "new",
    lastUpdated: parseCrmDate(record.last_updated),
    publishedAt: parseCrmDate(record.published_date) || parseEnteredAt(record),
    addedAt: parseEnteredAt(record),
  };
}

export async function setWordpressStatus(id, status) {
  if (!id || !status) return;
  await smartGateway({ action: "update", module: WORDPRESS_MODULE, id, data: { feed_status: status } });
}

// ----------------------------------------------------
// LLM feed (outr_llm): model news, learning resources (some in step-by-step journeys) and project suggestions
// ----------------------------------------------------

export const LLM_MODULE = import.meta.env?.VITE_LLM_MODULE || "outr_llm";

function mapLlmItem(record) {
  const text = (value) => decodeHtml(asText(value)).trim();
  return {
    id: record.id,
    name: text(record.name),
    summary: text(record.summary),
    description: text(record.description),
    contentGroup: asText(record.content_group),
    newsType: asText(record.news_type),
    company: asText(record.company),
    modelName: text(record.model_name),
    modelType: asText(record.model_type),
    access: asText(record.access),
    impact: asText(record.impact_level),
    priority: asText(record.priority),
    status: asText(record.status) || "new",
    tags: splitMultiEnum(record.tags),
    keyHighlights: text(record.key_highlights),
    specs: text(record.specs),
    pricing: text(record.pricing),
    benchmarks: text(record.benchmark_results),
    availability: text(record.availability),
    source: asText(record.source),
    sourceUrl: linkOf(record.source_url),
    docsUrl: linkOf(record.docs_url),
    whyItMatters: text(record.why_it_matters),
    useForUs: text(record.use_for_us),
    notes: text(record.notes),
    cost: asText(record.cost),
    learningFormat: asText(record.learning_format),
    topic: asText(record.topic),
    skillLevel: asText(record.skill_level),
    journeyName: text(record.journey_name),
    stepNumber: numberOrNull(record.step_number),
    totalSteps: numberOrNull(record.total_steps),
    progress: asText(record.progress_status),
    techStack: text(record.tech_stack),
    hardware: text(record.hardware_needed),
    outcome: text(record.outcome),
    prerequisites: text(record.prerequisites),
    duration: text(record.duration),
    suggestedBecause: text(record.suggested_because),
    publishedAt: parseCrmDate(record.published_date) || parseEnteredAt(record),
    addedAt: parseEnteredAt(record),
  };
}

// Saves an item's review status (status) or learning progress (progress_status).
export async function setLlmFields(id, data) {
  if (!id || !data) return;
  await smartGateway({ action: "update", module: LLM_MODULE, id, data });
}

// ----------------------------------------------------
// AppScript ideas (outr_appscripts): Google Apps Script tools worth building, with demand, earning model and our edge
// ----------------------------------------------------

export const APPSCRIPT_MODULE = import.meta.env?.VITE_APPSCRIPT_MODULE || "outr_appscripts";

// What an idea can be turned into. Each has its own CRM fields: generate_<type> (the trigger), <type>_suggestion (the
// user's notes for the generator), <type>_status (queued / processing / completed / failed, set by the generator) and,
// once made, the document's <type>_view_url and <type>_download_url.
export const APPSCRIPT_OUTPUTS = ["script", "blog", "video"];
const generationOf = (record) => Object.fromEntries(APPSCRIPT_OUTPUTS.map((type) => [type, {
  requested: flag(record[`generate_${type}`]),
  status: asText(record[`${type}_status`]).trim().toLowerCase(),
  suggestion: decodeHtml(asText(record[`${type}_suggestion`])).trim(),
  viewUrl: linkOf(record[`${type}_view_url`]),
  downloadUrl: linkOf(record[`${type}_download_url`]),
  docId: asText(record[`${type}_doc_id`]).trim(),
}]));

function mapAppScript(record) {
  const text = (value) => decodeHtml(asText(value)).trim();
  return {
    id: record.id,
    name: text(record.name),
    pitch: text(record.short_pitch),
    description: text(record.description),
    problem: text(record.problem_solved),
    features: text(record.key_features).split(/\s*,\s*/).filter(Boolean),
    apps: splitMultiEnum(record.google_app),
    category: asText(record.category),
    demandScore: numberOrNull(record.demand_score),
    demandProof: text(record.demand_proof),
    trend: asText(record.trend),
    difficulty: asText(record.difficulty),
    buildTime: text(record.build_time),
    earningModel: asText(record.earning_model),
    priceRange: text(record.price_range),
    tags: splitMultiEnum(record.tags),
    integrations: splitMultiEnum(record.integrations),
    targetUsers: splitMultiEnum(record.target_users),
    source: asText(record.source),
    sourceUrl: linkOf(record.source_url),
    similarTools: text(record.similar_tools),
    edge: text(record.your_edge),
    status: asText(record.status) || "new",
    priority: asText(record.priority),
    notes: text(record.notes),
    // The script, blog and video made from the idea: { script: { requested, status, suggestion, viewUrl, downloadUrl }, ... }.
    generation: generationOf(record),
    publishedAt: parseCrmDate(record.posted_date) || parseEnteredAt(record),
    addedAt: parseEnteredAt(record),
  };
}

// Saves an idea's status or its generate_* checkboxes (1 / 0).
export async function setAppScriptFields(id, data) {
  if (!id || !data) return;
  await smartGateway({ action: "update", module: APPSCRIPT_MODULE, id, data });
}

// Starts making one output of an idea, in one save: the user's suggestion, the generate_<type> box ticked and the
// status set to queued. The generator then sets processing and, at the end, completed (with the links) or failed.
// Generating again (with a new suggestion) is the same save.
export async function generateAppScriptOutput(id, type, suggestion = "") {
  if (!id || !APPSCRIPT_OUTPUTS.includes(type)) throw createAppError("GENERATE_INVALID", "Nothing to generate.");
  await smartGateway({ action: "update", module: APPSCRIPT_MODULE, id, data: { [`${type}_suggestion`]: asText(suggestion).trim(), [`generate_${type}`]: 1, [`${type}_status`]: "queued" } });
}

// The generators' prompts and guidelines, which users can read and edit before generating.
// Prompts: outr_machine_learning records (e.g. "appscript_<type>"), each in three parts: the system prompt
// (role_prompt), the prompt (overwrite_prompt) and the output prompt (output_format).
// Guidelines: outr_guidelines records (e.g. "appscript_<type>_guidelines"), the text in description.
export const PROMPTS_MODULE = import.meta.env?.VITE_PROMPTS_MODULE || "outr_machine_learning";
export const GUIDELINES_MODULE = import.meta.env?.VITE_GUIDELINES_MODULE || "outr_guidelines";
const PROMPT_FIELDS = ["role_prompt", "overwrite_prompt", "output_format"];
// The texts of a prompt record that can be edited: the three parts and, on older prompts, the task in description.
const PROMPT_TEXT_FIELDS = ["description", ...PROMPT_FIELDS];

// A generator's prompt and guidelines, by record name (e.g. "appscript_blog" and "appscript_blog_guidelines", or
// "notes_blog" and "notes_blog_guidelines" for Site Content): { prompt: { id, role_prompt, overwrite_prompt,
// output_format } | null, guidelines: { id, text } | null }.
export async function fetchGenerationInstructions(promptName, guidelinesName) {
  const named = (data, name) => asArray(data?.records).find((record) => record?.id && record.deleted !== "1" && record.name === name);
  const [prompts, guidelines] = await Promise.all([
    promptName ? smartGateway({ action: "fetch", module: PROMPTS_MODULE, filters: { name: promptName }, fields: ["id", "name", ...PROMPT_FIELDS], page: 1, per_page: 5 }) : null,
    guidelinesName ? smartGateway({ action: "fetch", module: GUIDELINES_MODULE, filters: { name: guidelinesName }, fields: ["id", "name", "description"], page: 1, per_page: 5 }) : null,
  ]);
  const prompt = named(prompts, promptName);
  const guideline = named(guidelines, guidelinesName);
  return {
    prompt: prompt ? { id: prompt.id, ...Object.fromEntries(PROMPT_FIELDS.map((field) => [field, decodeHtml(asText(prompt[field]))])) } : null,
    guidelines: guideline ? { id: guideline.id, text: decodeHtml(asText(guideline.description)) } : null,
  };
}

// Saves one text of a prompt (role_prompt, overwrite_prompt, output_format or description), or a guidelines text.
export async function savePromptPart(id, field, value) {
  if (!id || !PROMPT_TEXT_FIELDS.includes(field)) throw createAppError("PROMPT_INVALID", "This prompt cannot be saved.");
  await smartGateway({ action: "update", module: PROMPTS_MODULE, id, data: { [field]: asText(value) } });
}

// Prompt management: every prompt in outr_machine_learning, A-Z, without its texts (they load when one is opened).
export async function fetchPromptList() {
  const records = await fetchEveryPage({ action: "fetch", module: PROMPTS_MODULE, fields: ["id", "name", "type", "stage", "motive", "date_modified"], order_by: "name", order_dir: "ASC" });
  return records.filter((record) => record?.id).map((record) => ({
    id: record.id,
    name: decodeHtml(asText(record.name)).trim() || "Untitled prompt",
    type: asText(record.type).trim(),
    stage: asText(record.stage).trim(),
    motive: decodeHtml(asText(record.motive)).trim(),
    modifiedAt: asText(record.date_modified),
  }));
}

// One prompt with its texts.
export async function fetchPrompt(id) {
  const data = await smartGateway({ action: "fetch", module: PROMPTS_MODULE, filters: { id }, fields: ["id", "name", "type", "stage", "motive", ...PROMPT_TEXT_FIELDS], page: 1, per_page: 1 });
  const record = asArray(data.records)[0];
  if (!record) throw createAppError("PROMPT_NOT_FOUND", "This prompt is no longer in the CRM.");
  return {
    id: record.id,
    name: decodeHtml(asText(record.name)).trim() || "Untitled prompt",
    type: asText(record.type).trim(),
    stage: asText(record.stage).trim(),
    motive: decodeHtml(asText(record.motive)).trim(),
    ...Object.fromEntries(PROMPT_TEXT_FIELDS.map((field) => [field, decodeHtml(asText(record[field]))])),
  };
}
export async function saveGuidelines(id, text) {
  if (!id) throw createAppError("GUIDELINES_INVALID", "These guidelines cannot be saved.");
  await smartGateway({ action: "update", module: GUIDELINES_MODULE, id, data: { description: asText(text) } });
}

// Guidelines management: every guidelines record, A-Z (the text loads when one is opened).
export async function fetchGuidelineList() {
  const records = await fetchEveryPage({ action: "fetch", module: GUIDELINES_MODULE, fields: ["id", "name", "date_modified"], order_by: "name", order_dir: "ASC" });
  return records.filter((record) => record?.id).map((record) => ({ id: record.id, name: decodeHtml(asText(record.name)).trim() || "Untitled guidelines", modifiedAt: asText(record.date_modified) }));
}
export async function fetchGuideline(id) {
  const data = await smartGateway({ action: "fetch", module: GUIDELINES_MODULE, filters: { id }, fields: ["id", "name", "description", "date_modified"], page: 1, per_page: 1 });
  const record = asArray(data.records)[0];
  if (!record) throw createAppError("GUIDELINES_NOT_FOUND", "These guidelines are no longer in the CRM.");
  return { id: record.id, name: decodeHtml(asText(record.name)).trim() || "Untitled guidelines", text: decodeHtml(asText(record.description)), modifiedAt: asText(record.date_modified) };
}

// Prompt scheduler (outr_scheduler_prompts): the prompts the scheduler runs on its own, each with its cron schedule,
// on / off, and when it last ran.
export const SCHEDULER_PROMPTS_MODULE = import.meta.env?.VITE_SCHEDULER_PROMPTS_MODULE || "outr_scheduler_prompts";
const SCHEDULER_TEXT_FIELDS = ["prompt", "description", "schedule"];
const mapSchedulerPrompt = (record) => ({
  id: record.id,
  name: decodeHtml(asText(record.name)).trim() || "Untitled scheduled prompt",
  schedule: asText(record.schedule).trim(),
  active: flag(record.is_active),
  instance: asText(record.crm_instance).trim(),
  lastRunAt: asText(record.last_run_at).trim(),
  lastRunAgo: asText(record.last_run_at_time_ago).trim(),
  modifiedAt: asText(record.date_modified),
});
export async function fetchSchedulerPromptList() {
  const records = await fetchEveryPage({ action: "fetch", module: SCHEDULER_PROMPTS_MODULE, fields: ["id", "name", "schedule", "is_active", "crm_instance", "last_run_at", "date_modified"], order_by: "name", order_dir: "ASC" });
  return records.filter((record) => record?.id).map(mapSchedulerPrompt);
}
export async function fetchSchedulerPrompt(id) {
  const data = await smartGateway({ action: "fetch", module: SCHEDULER_PROMPTS_MODULE, filters: { id }, fields: ["id", "name", "schedule", "is_active", "crm_instance", "last_run_at", "date_modified", "prompt", "description"], page: 1, per_page: 1 });
  const record = asArray(data.records)[0];
  if (!record) throw createAppError("SCHEDULED_PROMPT_NOT_FOUND", "This scheduled prompt is no longer in the CRM.");
  return { ...mapSchedulerPrompt(record), prompt: decodeHtml(asText(record.prompt)), description: decodeHtml(asText(record.description)) };
}
// Saves one text of a scheduled prompt (prompt, description or schedule), or turns it on / off.
export async function saveSchedulerPrompt(id, field, value) {
  if (!id) throw createAppError("SCHEDULED_PROMPT_INVALID", "This scheduled prompt cannot be saved.");
  if (field === "is_active") return smartGateway({ action: "update", module: SCHEDULER_PROMPTS_MODULE, id, data: { is_active: value ? 1 : 0 } });
  if (!SCHEDULER_TEXT_FIELDS.includes(field)) throw createAppError("SCHEDULED_PROMPT_INVALID", "This scheduled prompt cannot be saved.");
  return smartGateway({ action: "update", module: SCHEDULER_PROMPTS_MODULE, id, data: { [field]: field === "schedule" ? asText(value).trim() : asText(value) } });
}

// Where the outputs of a few ideas stand, read while they are being made: { [id]: generation } (as in mapAppScript).
export async function fetchAppScriptGeneration(ids = []) {
  if (!ids.length) return {};
  const fields = ["id", ...APPSCRIPT_OUTPUTS.flatMap((type) => [`generate_${type}`, `${type}_status`, `${type}_suggestion`, `${type}_view_url`, `${type}_download_url`, `${type}_doc_id`])];
  const data = await smartGateway({ action: "fetch", module: APPSCRIPT_MODULE, filters: { id: { in: ids } }, fields, page: 1, per_page: 50 });
  return Object.fromEntries(asArray(data.records).filter((record) => record?.id).map((record) => [record.id, generationOf(record)]));
}

// ----------------------------------------------------
// Social posts (outr_socials): ready-to-post drafts per platform, from idea to posted (with results), some made from
// a WordPress / LLM / AppScript feed item
// ----------------------------------------------------

export const SOCIAL_MODULE = import.meta.env?.VITE_SOCIAL_MODULE || "outr_socials";

function mapSocialPost(record) {
  const text = (value) => decodeHtml(asText(value)).trim();
  return {
    id: record.id,
    name: text(record.name),
    // The post as it will be published (keeps its line breaks and emojis).
    post: decodeHtml(asText(record.description)).replace(/\r\n/g, "\n").trim(),
    hook: text(record.hook),
    summary: text(record.summary),
    platform: asText(record.platform),
    contentType: asText(record.content_type),
    format: asText(record.post_format),
    niche: asText(record.niche),
    goal: asText(record.goal),
    trend: asText(record.trend),
    reachScore: numberOrNull(record.expected_reach_score),
    bestTime: text(record.best_time_to_post),
    outline: text(record.content_outline).split(/\s*\|\s*/).filter(Boolean),
    callToAction: text(record.call_to_action),
    hashtags: splitMultiEnum(record.hashtags),
    mentions: text(record.mentions),
    characters: numberOrNull(record.character_count),
    mediaNeeded: text(record.media_needed),
    mediaUrl: linkOf(record.media_url),
    whyThisWorks: text(record.why_this_works),
    exampleUrl: linkOf(record.example_post_url),
    repurposeFor: splitMultiEnum(record.repurpose_for),
    status: asText(record.status) || "suggested",
    scheduledAt: parseCrmDate(record.scheduled_date),
    postUrl: linkOf(record.our_post_url),
    // Results once posted (null when not posted yet).
    views: numberOrNull(record.views_count),
    likes: numberOrNull(record.likes_count),
    comments: numberOrNull(record.comments_count),
    shares: numberOrNull(record.shares_count),
    leads: numberOrNull(record.leads_generated),
    notes: decodeHtml(asText(record.notes)).split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    // The feed item the post was made from: its module (outr_wordpress / outr_llm / outr_appscripts) and name.
    parentType: asText(record.parent_type),
    parentId: asText(record.parent_id),
    parentName: text(record.parent_name),
    publishedAt: parseCrmDate(record.published_date) || parseEnteredAt(record),
    addedAt: parseEnteredAt(record),
  };
}

// ----------------------------------------------------
// Feed sections (WordPress, LLM, AppScript, Social): filtering, search, sorting and paging (fetch) and counts
// (get_stats) done by the smart gateway, like Jobs and AI News
// ----------------------------------------------------

// Per section: its module, how a record is shown, the fields a text search looks in, and the sorts the gateway does
// ([field, direction]). Sorts it cannot do (rank order such as high > medium > low, empty values last going up) are
// done on the page.
const FEEDS = {
  wordpress: {
    module: WORDPRESS_MODULE, map: mapWordpressItem,
    searchFields: ["name", "summary", "description", "opportunity", "author", "tags"],
    sorts: { demand: ["demand_score", "DESC"], newest: ["published_date", "DESC"], installs: ["installs", "DESC"], sales: ["sales_count", "DESC"], rating: ["rating", "DESC"] },
  },
  llm: {
    module: LLM_MODULE, map: mapLlmItem,
    searchFields: ["name", "summary", "description", "model_name", "why_it_matters", "use_for_us", "outcome", "tech_stack", "journey_name", "company", "tags"],
    sorts: { newest: ["published_date", "DESC"] },
  },
  appscript: {
    module: APPSCRIPT_MODULE, map: mapAppScript,
    searchFields: ["name", "short_pitch", "description", "problem_solved", "your_edge", "similar_tools", "key_features", "google_app", "tags"],
    sorts: { demand: ["demand_score", "DESC"], newest: ["posted_date", "DESC"] },
  },
  // The post's "made from" name (parent_name) is not a column, so a search cannot look in it.
  social: {
    module: SOCIAL_MODULE, map: mapSocialPost,
    searchFields: ["name", "description", "hook", "summary", "call_to_action", "why_this_works", "platform", "hashtags"],
    sorts: { reach: ["expected_reach_score", "DESC"], newest: ["published_date", "DESC"], views: ["views_count", "DESC"] },
  },
};

function feedOf(name) {
  if (!FEEDS[name]) throw createAppError("FEED_UNKNOWN", `There is no feed named ${name}.`);
  return FEEDS[name];
}

// The gateway searches with LIKE, where "_" stands for any one character. Keys and tags are stored with "_" for
// spaces (lead_capture), so spaces are sent as "_": "lead capture" then matches both the text and the key.
const feedSearchText = (search) => asText(search).trim().replace(/\s+/g, "_");

// `picks` is { crmField: [values] }, for fields that hold one value per item: one value is an exact match, several
// are an OR ({ in: [...] }, which fetch supports). Fields holding several values ("ai,seo") are matched on the page.
function feedFilters(picks = {}) {
  const filters = {};
  for (const [field, values] of Object.entries(picks)) {
    const list = asArray(values).filter(Boolean);
    if (list.length) filters[field] = list.length === 1 ? list[0] : { in: list };
  }
  return filters;
}

function feedQuery(feed, { picks, search = "", dateFilter } = {}) {
  const query = { action: "fetch", module: feed.module };
  const filters = feedFilters(picks);
  if (Object.keys(filters).length) query.filters = filters;
  const text = feedSearchText(search);
  if (text) Object.assign(query, { search: text, search_fields: feed.searchFields });
  return addGatewayDateFilter(query, dateFilter);
}

// One page of a feed, filtered, searched and sorted by the gateway. `dateFilter` comes from toGatewayDateFilter; a
// sort the gateway does not do falls back to the feed's first one.
export async function fetchFeedPage(name, { picks, search, dateFilter, sort, page = 1, perPage = 20 } = {}) {
  const feed = feedOf(name);
  const [orderBy, orderDir] = feed.sorts[sort] || Object.values(feed.sorts)[0];
  const data = await smartGateway({ ...feedQuery(feed, { picks, search, dateFilter }), order_by: orderBy, order_dir: orderDir, page, per_page: perPage });
  const records = asArray(data.records).filter((record) => record && typeof record === "object" && record.deleted !== "1").map(feed.map);
  const total = Number(data.total) || 0;
  return { records, page: Number(data.page) || page, total, totalPages: Math.max(Number(data.total_pages) || 1, Math.ceil(total / perPage)) };
}

// Every item the gateway matches (every page, 50 at a time: the gateway's most), for what the page finishes itself:
// an OR over fields holding several values, and sorts the gateway cannot do.
export async function fetchFeedAll(name, params = {}) {
  const first = await fetchFeedPage(name, { ...params, page: 1, perPage: 50 });
  const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => fetchFeedPage(name, { ...params, page: index + 2, perPage: 50 })));
  const seen = new Set();
  return [first, ...rest].flatMap((page) => page.records).filter((item) => !seen.has(item.id) && seen.add(item.id));
}

// One item of a feed by its id (an item opened from a link may not be in the pages loaded); null when it is gone.
export async function fetchFeedItem(name, id) {
  const feed = feedOf(name);
  const data = await smartGateway({ action: "fetch", module: feed.module, filters: { id }, page: 1, per_page: 1 });
  const record = asArray(data.records).find((entry) => entry && typeof entry === "object" && entry.id === id && entry.deleted !== "1");
  return record ? feed.map(record) : null;
}

// The module's dropdown lists (every choice and its label) and how many items it has, from a one-record fetch.
export async function fetchFeedOptions(name) {
  const data = await smartGateway({ action: "fetch", module: feedOf(name).module, page: 1, per_page: 1 });
  const choices = (list) => Object.entries(asObject(list)).map(([value, label]) => ({ value: asText(value), label: decodeHtml(asText(label)) })).filter((option) => option.value);
  return { options: Object.fromEntries(Object.entries(asObject(data.dropdown_lists)).map(([key, list]) => [key, choices(list)])), total: Number(data.total) || 0 };
}

// How many items each request would show, all in one get_stats call (like the Jobs and AI News counts).
// `requests` is [{ key, picks, search, dateFilter }] (all with the same dateFilter; picks of one-value fields only);
// returns { key: count }. get_stats takes exact values only (no `in`), so several values picked in a field become one
// query per value, added up: such a field holds one value per item, so the parts do not overlap.
export async function countFeed(name, requests = []) {
  if (!requests.length) return {};
  const feed = feedOf(name);
  const queries = [];
  const parts = requests.map((request, index) => {
    const text = feedSearchText(request.search);
    const combos = Object.entries(request.picks || {})
      .filter(([, values]) => asArray(values).length)
      .reduce((list, [field, values]) => list.flatMap((combo) => values.map((value) => ({ ...combo, [field]: value }))), [{}]);
    return [request.key, combos.map((filters, part) => {
      const key = `q${index}_${part}`;
      const query = { key, module: feed.module };
      if (Object.keys(filters).length) query.filters = filters;
      if (text) Object.assign(query, { search: text, search_fields: feed.searchFields });
      queries.push(query);
      return key;
    })];
  });
  const dateFilter = requests[0]?.dateFilter;
  const data = await smartGateway({ action: "get_stats", date_range: "", date_field: dateFilter?.date_field || "", date_from: dateFilter?.date_from || "", date_to: dateFilter?.date_to || "", queries });
  return Object.fromEntries(parts.map(([key, keys]) => [key, keys.reduce((sum, part) => sum + (Number(data.stats?.[part]?.count) || 0), 0)]));
}

// Every step of the given LLM learning journeys (by journey name), so a journey shows whole whatever the filters.
export async function fetchLlmJourneys(names = []) {
  const list = [...new Set(asArray(names).filter(Boolean))];
  return list.length ? fetchFeedAll("llm", { picks: { journey_name: list } }) : [];
}

export async function mcpSmartGateway(payload, { timeout = 60_000, signal } = {}) {
  const token = generateToken();
  const targetUrl = getMcpSmartGatewayUrl();
  try {
    const response = await axios.post(targetUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Token": token,
      },
      timeout,
      signal,
    });
    if (!response.data?.success) {
      throw createAppError("SERVER_ERROR", response.data?.message || response.data?.error || "The request could not be completed");
    }
    return response.data;
  } catch (err) {
    if (axios.isCancel(err)) throw createAppError("ABORTED", "Request cancelled");
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "The request could not be completed";
    throw createAppError(status === 401 || status === 403 ? "UNAUTHORIZED" : "SERVER_ERROR", msg, { status });
  }
}

// The API Playground only offers credentials ticked "API Playground" in the CRM (outr_credentials.is_payload = 1).
const PLAYGROUND_FILTER = { is_payload: 1 };

// The APIs with a "Test <API>" button. Each one's ticked credentials are picked by the gateway, by name,
// so a credential added or ticked in the CRM later (e.g. one named "Claude ...") shows up on its own.
export const PLAYGROUND_APIS = [
  { key: "claude", label: "Claude", match: "claude" },
  { key: "chatgpt", label: "ChatGPT", match: "chatgpt" },
  { key: "upwork", label: "Upwork", match: "upwork" },
];

// { records: every ticked credential (the dropdown), groups: [{ key, label, credentials }] (the Test buttons),
//   options: the CRM's own API type and status choices (the create form) }.
export async function fetchPlaygroundCredentials() {
  const [all, ...groups] = await Promise.all([
    fetchCredentials({ perPage: 100, filters: PLAYGROUND_FILTER }),
    ...PLAYGROUND_APIS.map(async (target) => ({
      ...target,
      credentials: (await fetchCredentials({ perPage: 100, filters: { ...PLAYGROUND_FILTER, name: { like: `%${target.match}%` } } })).records,
    })),
  ]);
  return { ...all, groups };
}

export async function fetchCredentials({ page = 1, perPage = 100, filters = {} } = {}) {
  const data = await mcpSmartGateway({
    action: "fetch",
    module: CREDENTIALS_MODULE,
    page,
    per_page: perPage,
    filters,
    order_by: "date_entered",
    order_dir: "DESC",
  });
  const records = asArray(data?.records).filter((r) => r && r.deleted !== "1").map((r) => ({
    id: r.id,
    name: decodeHtml(r.name || ""),
    // As saved in the CRM; nothing is invented when a field is empty.
    status: asText(r.status),
    apiType: asText(r.api_type),
    description: decodeHtml(r.description || ""),
    productionFirstToken: r.production_first_token || "",
    productionSecondToken: r.production_second_token || "",
    productionEndpoint: r.production_endpoint || "",
    devFirstToken: r.dev_first_token || "",
    devSecondToken: r.dev_second_token || "",
    devEndpoint: r.dev_endpoint || "",
    dateEntered: r.date_entered_time_ago || r.date_entered_uni_format || r.date_entered || "",
    dateModified: r.date_modified_time_ago || r.date_modified_uni_format || r.date_modified || "",
    raw: r,
  }));
  // The CRM dropdowns for these fields, as [{ value, label }] (the empty "none" choice kept, labelled by the CRM).
  const lists = asObject(data?.dropdown_lists);
  const choices = (list) => Object.entries(asObject(list)).map(([value, label]) => ({ value: asText(value), label: decodeHtml(asText(label)) || asText(value) }));
  return {
    records,
    total: Number(data?.total) || records.length,
    page: Number(data?.page) || page,
    totalPages: Number(data?.total_pages) || 1,
    options: { apiType: choices(lists.api_type), status: choices(lists.status) },
  };
}

export async function createCredential(data) {
  const name = String(data?.name || "").trim();
  if (!name) throw createAppError("NAME_REQUIRED", "Credential name is required");
  const payload = {
    name,
    api_type: data.apiType ?? data.api_type ?? "",
    status: data.status || "active",
    description: data.description || "",
    production_first_token: data.productionFirstToken || data.production_first_token || data.token || "",
    production_second_token: data.productionSecondToken || data.production_second_token || "",
    production_endpoint: data.productionEndpoint || data.production_endpoint || data.endpoint || "",
    dev_first_token: data.devFirstToken || data.dev_first_token || "",
    dev_second_token: data.devSecondToken || data.dev_second_token || "",
    dev_endpoint: data.devEndpoint || data.dev_endpoint || "",
  };
  // Ticks "API Playground" (is_payload) when asked, so a credential made in the playground shows up there.
  if (data.inPlayground) payload.is_payload = 1;
  return mcpSmartGateway({
    action: "create",
    module: CREDENTIALS_MODULE,
    data: payload,
  });
}

export async function deleteCredential(id) {
  if (!id) throw createAppError("ID_REQUIRED", "Credential ID is required");
  return mcpSmartGateway({
    action: "delete",
    module: CREDENTIALS_MODULE,
    id,
  });
}

/*
 * One step of the CRM MCP agent (the same endpoint the CRM's own mcp_ui page uses).
 * Body: { message, user } to start, then { job_id, user } while the reply has `has_more`.
 * Reply: { success, message, job_id, status, has_more, tool_count, actions: [{ step, action, module, id, status, detail }] }.
 * The agent does not need a key. `agentKey` is only sent when a real agent key is given; never pass an API
 * credential's token here (the agent ignores it, and it would only expose the secret).
 * CORS: the endpoint allows only the Content-Type and X-Agent-Key headers.
 */
export async function runMcpAgentStep(body, { agentKey, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (agentKey) headers["X-Agent-Key"] = agentKey;

  const send = (url) => fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  const primaryUrl = getMcpAgentUrl();
  let response;
  try {
    response = await send(primaryUrl);
  } catch (err) {
    if (err.name === "AbortError") throw err;
    // Local dev proxy unavailable: try the CRM directly.
    if (primaryUrl === MCP_AGENT_URL) throw createAppError("NETWORK_ERROR", "Unable to reach the agent server. Please check your connection.");
    try {
      response = await send(MCP_AGENT_URL);
    } catch (directErr) {
      if (directErr.name === "AbortError") throw directErr;
      throw createAppError("NETWORK_ERROR", "Unable to reach the agent server. Please check your connection.");
    }
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw createAppError("PARSE_ERROR", `The agent server did not answer with JSON (HTTP ${response.status}): ${raw.trim().slice(0, 150) || "empty response"}`, { status: response.status });
  }
  if (!response.ok || data?.success === false) {
    throw createAppError("AGENT_ERROR", data?.message || data?.error || `The agent server answered HTTP ${response.status}.`, { status: response.status, data, jobId: data?.job_id });
  }
  return data;
}

export const api = {
  getCredentials: fetchCredentials,
  getPlaygroundCredentials: fetchPlaygroundCredentials,
  createCredential,
  deleteCredential,
  runMcpAgentStep,
  getJobs: (params) => fetchJobs(params),
  getJobsPage: (params) => fetchJobsPage(params),
  getJobStats: (params) => fetchJobStats(params),
  getMyAppliedJobs: (params) => fetchMyAppliedJobs(params),
  getJobAlerts: (params) => fetchJobAlerts(params),
  getMySkills: (userEmail) => fetchMySkills(userEmail),
  saveMySkills: (userEmail, skills) => saveMySkills(userEmail, skills),
  getUserSkills: (userId) => fetchUserSkills(userId),
  saveUserSkills: (userId, skills) => saveUserSkills(userId, skills),
  getSkillJobIds: (skillIds) => fetchSkillJobIds(skillIds),
  getRejectReasons: (jobIds) => fetchRejectReasons(jobIds),
  getMyPreferences: (userEmail) => fetchMyPreferences(userEmail),
  saveMyPreference: (userEmail, preference, labels) => saveMyPreference(userEmail, preference, labels),
  deleteMyPreference: (id) => deleteMyPreference(id),
  setMyPreferencesEnabled: (preferences, enabled) => setMyPreferencesEnabled(preferences, enabled),
  getPreferredJobs: (params) => fetchPreferredJobs(params),
  getFeedback: (params) => fetchFeedback(params),
  createFeedback: (userEmail, entry) => createFeedback(userEmail, entry),
  setFeedbackStatus: (id, status) => setFeedbackStatus(id, status),
  getFeeds: () => fetchFeeds(),
  createFeed: (userEmail, feed) => createFeed(userEmail, feed),
  deleteFeed: (id) => deleteFeed(id),
  getSkillCounts: (params) => fetchSkillCounts(params),
  getGroupOptions: (module) => fetchGroupOptions(module),
  getJobGroupCounts: (params) => fetchJobGroupCounts(params),
  getSkillsInGroup: (params) => fetchSkillsInGroup(params),
  getSkillGroupCounts: (params) => fetchSkillGroupCounts(params),
  getJob: (id, userEmail) => fetchJobById(id, userEmail),
  getCoverLetter: (job) => fetchCoverLetter(job),
  saveCoverLetter,
  editCoverLetter: editCoverLetterWithAi,
  askAi,
  getStrategy: (job) => fetchStrategy(job),  getTeamMembers: () => fetchTeamMembers(),
  getLiveJobs: (params) => fetchLiveUpworkJobs(params),
  getJobReactions: fetchJobReactions,
  setJobReaction,
  saveLiveJobToCrm,
  getVideoFeeds: (options) => fetchVideoFeeds(options),
  getSiteContent: (options) => fetchSiteContent(options),
  getFeedPage: (name, params) => fetchFeedPage(name, params),
  getFeedAll: (name, params) => fetchFeedAll(name, params),
  getFeedOptions: (name) => fetchFeedOptions(name),
  getFeedItem: (name, id) => fetchFeedItem(name, id),
  countFeed: (name, requests) => countFeed(name, requests),
  getLlmJourneys: (names) => fetchLlmJourneys(names),
  setWordpressStatus: (id, status) => setWordpressStatus(id, status),
  setLlmFields: (id, data) => setLlmFields(id, data),
  setAppScriptFields: (id, data) => setAppScriptFields(id, data),
  generateAppScriptOutput: (id, type, suggestion) => generateAppScriptOutput(id, type, suggestion),
  getAppScriptGeneration: (ids) => fetchAppScriptGeneration(ids),
  getGenerationInstructions: (promptName, guidelinesName) => fetchGenerationInstructions(promptName, guidelinesName),
  savePromptPart: (id, field, value) => savePromptPart(id, field, value),
  getPromptList: () => fetchPromptList(),
  getPrompt: (id) => fetchPrompt(id),
  saveGuidelines: (id, text) => saveGuidelines(id, text),
  getGuidelineList: () => fetchGuidelineList(),
  getGuideline: (id) => fetchGuideline(id),
  getSchedulerPromptList: () => fetchSchedulerPromptList(),
  getSchedulerPrompt: (id) => fetchSchedulerPrompt(id),
  saveSchedulerPrompt: (id, field, value) => saveSchedulerPrompt(id, field, value),
  getNote: (id) => fetchNote(id),
  generateTechContentDoc: (contentId, options) => generateTechContentDoc(contentId, options),
  resolveCrmUser: (user) => resolveCrmUser(user),
  getRoles: () => fetchRoles(),
  getSkills: (params) => fetchSkills(params),
  createSkill,
  updateSkill,
  deleteSkill,
  getTechNews: (params) => fetchTechNews(params),
  getTechNewsPage: (params) => fetchTechNews(params),
  getTechNewsStats: (params) => fetchTechNewsStats(params),
  getTechNewsItem: (id) => fetchTechNewsById(id),
  getAllTechNews: (options) => fetchAllTechNews(options),
  getJobActivity: (jobId) => fetchJobActivity(jobId),
  logJobActivity,
  // With `userEmail`, the change is also recorded in the job activity module. A failed
  // activity entry is logged to the console and does not undo the status change.
  async updateStatus({ id, status, reason, coverLetter, userEmail }) {
    const current = await fetchJobById(id);
    await smartGateway({
      action: "update",
      module: JOBS_MODULE,
      id,
      data: { status },
    });
    let description = userEmail ? statusActivity(current.status, status) : "";
    // A rejection keeps its reason in the activity entry ("Rejected: Budget too low"); see fetchRejectReasons.
    const reasonText = asText(reason).trim().slice(0, 150);
    if (description === "Rejected" && reasonText) description = `Rejected: ${reasonText}`;
    if (description) await logJobActivity({ jobId: id, userEmail, description }).catch((error) => console.warn("Could not record job activity", error));
    const changes = { status, reason, coverLetter, activity: [`Status changed from ${current.status} to ${status}`, ...current.activity] };
    localChanges.set(id, changes);
    return { ...current, ...changes };
  },
  async checkDuplicate(value, userEmail) {
    const cleaned = cleanJobUrl(value);
    const jobs = await fetchJobs({ userEmail });
    return { exists: jobs.some((job) => job.url && cleanJobUrl(job.url) === cleaned), cleaned };
  },
};
