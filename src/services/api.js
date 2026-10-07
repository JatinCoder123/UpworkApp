import axios from "axios";
import CryptoJS from "crypto-js";

const SMART_GATEWAY_URL = import.meta.env.VITE_SMART_GATEWAY_URL || "https://upwork.outrightcrm.in/index.php?entryPoint=smart_gateway";
const JOBS_MODULE = "outr_upwork_jobs";

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

export function mapGatewayJob(record) {
  const clientStats = parseClient(record.client);
  const changes = localChanges.get(record.id) || {};
  const category = record.category?.trim();
  const built = record.already_built?.trim();
  const tags = [...new Set([category, built].filter((value) => value && value !== "–" && value !== "—"))];
  const owner = descriptionValue(record.description, "Lead");
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
    url: descriptionValue(record.description, "Upwork link"),
    description: record.description || "No description provided.",
    pitch: record.pitch || "",
    coverLetter: record.cover_letter || "",
    clientStats,
    activity: changes.activity || [`Opportunity imported as ${record.job_id || record.name}`, `Last updated ${record.date_modified_time_ago || "recently"}`],
    raw: record,
    ...changes,
  };
}

export async function fetchJobs({ page = 1, perPage = 20 } = {}) {
  const data = await smartGateway({ action: "fetch", module: JOBS_MODULE, page, per_page: perPage });
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

export const api = {
  getJobs: () => fetchJobs(),
  getJob: fetchJobById,
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
