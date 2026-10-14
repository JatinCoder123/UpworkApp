import { AUTH_ORIGIN } from "../lib/auth";

/*
 * Domain Intelligence client. GoDaddy, NameSilo, Moz, Azure AI Foundry, RDAP and
 * CRM calls run on the backend (/api/domain/*), so provider keys never reach the
 * browser. Only pure helpers (validation, formatting, the checklist) live here.
 */

export const DEFAULT_TLDS = ["com", "io", "ai", "co"];
export const BATCH_SIZE = 5;
export const MAX_SUGGESTIONS = 50;

export function isAbortError(error) {
  return error?.name === "AbortError";
}

export const makeId = () => (crypto.randomUUID?.() || `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);

/* ------------------------------------------------------------------ */
/* Domain helpers                                                      */
/* ------------------------------------------------------------------ */

const FULL_DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const SINGLE_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeDomain(value, defaultTld = "com") {
  let domain = String(value || "").trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./, "");
  domain = domain.replace(/^[.\s]+|[.\s]+$/g, "");
  if (!domain.includes(".")) {
    if (!SINGLE_LABEL.test(domain)) throw new Error("Enter a valid domain name such as example or example.com.");
    domain += `.${defaultTld}`;
  }
  if (!FULL_DOMAIN.test(domain)) throw new Error("Enter a valid domain name such as example or example.com.");
  return domain;
}

export function tryNormalizeDomain(value, defaultTld) {
  try {
    return normalizeDomain(value, defaultTld);
  } catch {
    return "";
  }
}

export function domainLabel(domain) {
  return String(domain || "").split(".")[0];
}

export function domainTld(domain) {
  const parts = String(domain || "").toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function detectInputMode(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "domain";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value.replace(/\s+/g, ""));
      if (FULL_DOMAIN.test(url.hostname)) return "domain";
    } catch {
      return "prompt";
    }
  }
  const domainValue = value.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const hostCandidate = domainValue.split(/[/?#]/, 1)[0];
  if ((!/\s/.test(value) && FULL_DOMAIN.test(hostCandidate)) || SINGLE_LABEL.test(domainValue)) return "domain";
  return "prompt";
}

export function normalizeTlds(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(/[\s,]+/);
  const valid = [...new Set(list.map((tld) => String(tld).trim().toLowerCase().replace(/^\./, "")).filter((tld) => /^[a-z]{2,24}$/.test(tld)))];
  return (valid.length ? valid : ["com"]).slice(0, 5);
}

export function oneYearPricePlan(prices) {
  return (Array.isArray(prices) ? prices : []).find((plan) => Number(plan?.period) === 1) || null;
}

export function formatPrice(priceData) {
  if (!priceData || !Number.isFinite(Number(priceData.value))) return "—";
  const currency = String(priceData.currencyCode || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(priceData.value) / 100);
  } catch {
    return `${currency} ${(Number(priceData.value) / 100).toFixed(2)}`;
  }
}

export function isPremiumDomain(availability) {
  return /premium/i.test(String(availability?.inventory || ""));
}

export function goDaddySearchUrl(domain) {
  return `https://www.godaddy.com/en-in/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}&checkAvail=1`;
}

/* ------------------------------------------------------------------ */
/* 43-point checklist                                                  */
/* ------------------------------------------------------------------ */

export const DOMAIN_CHECKLIST = [
  ["easy_to_pronounce", "Branding", "Easy to pronounce", "High", true],
  ["easy_to_spell", "Branding", "Easy to spell", "High", true],
  ["easy_to_remember", "Branding", "Easy to remember", "High", true],
  ["looks_professional", "Branding", "Looks professional", "High", true],
  ["no_explanation_needed", "Branding", "Doesn't require explanation", "Medium", true],
  ["global_audience", "Branding", "Suitable for global audience", "High", true],
  ["no_numbers_or_hyphens", "Branding", "No confusing numbers or hyphens", "High", true],
  ["no_famous_brand", "Trademark & Legal", "No famous brand name included", "Critical", true],
  ["trademark_search", "Trademark & Legal", "Trademark search completed", "Critical", false],
  ["company_name_search", "Trademark & Legal", "Company name search completed", "High", false],
  ["social_username", "Trademark & Legal", "Social media username available", "Medium", false],
  ["no_legal_disputes", "Trademark & Legal", "No ongoing legal disputes", "High", false],
  ["never_used_for_spam", "SEO", "Domain never used for spam", "High", false],
  ["no_google_penalties", "SEO", "No Google penalties", "High", false],
  ["clean_backlinks", "SEO", "Clean backlink profile", "High", false],
  ["archive_reviewed", "SEO", "Archive history reviewed", "High", false],
  ["no_malware_history", "SEO", "No malware history", "High", false],
  ["indexed_normally", "SEO", "Domain indexed normally", "Medium", false],
  ["works_as_brand", "Marketing", "Works as a brand", "High", true],
  ["suitable_for_logo", "Marketing", "Suitable for logo", "Medium", true],
  ["word_of_mouth", "Marketing", "Good for word-of-mouth marketing", "High", true],
  ["advertising_friendly", "Marketing", "Looks good in advertisements", "Medium", true],
  ["professional_email", "Marketing", "Email addresses look professional", "High", true],
  ["multi_product_growth", "Business Growth", "Can expand into multiple products", "High", true],
  ["not_country_limited", "Business Growth", "Not limited to one country", "High", true],
  ["not_technology_limited", "Business Growth", "Not limited to one technology", "High", true],
  ["future_saas", "Business Growth", "Suitable for future SaaS", "Medium", true],
  ["mobile_app", "Business Growth", "Suitable for mobile app", "Medium", true],
  ["dot_com_available", "Technical", ".com available", "High", false],
  ["common_tlds_secured", "Technical", "Common TLDs (.net/.io/.ai/.co) secured if needed", "Medium", false],
  ["ssl_supported", "Technical", "SSL supported", "Low", false],
  ["whois_privacy", "Technical", "WHOIS privacy available", "Low", false],
  ["under_12_characters", "Length & Quality", "Under 12 characters preferred", "Medium", true],
  ["one_or_two_words", "Length & Quality", "One or two words", "High", true],
  ["no_repeated_letters", "Length & Quality", "No repeated letters", "Medium", true],
  ["not_another_brand", "Length & Quality", "Doesn't resemble another brand", "Critical", true],
  ["no_awkward_pronunciation", "Length & Quality", "No awkward pronunciation", "Medium", true],
  ["no_offensive_meaning", "International", "No offensive meaning in major languages", "Medium", true],
  ["globally_pronounceable", "International", "Easy to pronounce globally", "Medium", true],
  ["works_key_markets", "International", "Works in US, Europe, India", "Medium", true],
  ["reasonable_price", "Commercial", "Domain price is reasonable", "Medium", false],
  ["acceptable_renewal", "Commercial", "Renewal fee acceptable", "Medium", false],
  ["premium_justified", "Commercial", "Premium domain justified", "Low", false],
].map(([id, category, check, priority, ai]) => ({ id, category, check, priority, ai }));

export const CHECK_CATEGORIES = [...new Set(DOMAIN_CHECKLIST.map((item) => item.category))];

/** Moz is lazy-loaded; it only overrides the researched spam assessment once requested. */
function mozSpamAssessment(moz) {
  if (!moz) return null;
  if (Number.isFinite(moz.spam_score)) {
    return { status: moz.spam_score <= 30 ? "pass" : moz.spam_score <= 60 ? "caution" : "fail", note: `Moz Spam Score: ${Number(moz.spam_score.toFixed(1))}%.` };
  }
  return moz.error ? { status: "manual", note: moz.error } : null;
}

export function applyMozToChecks(checks, moz) {
  const assessment = mozSpamAssessment(moz);
  if (!Array.isArray(checks) || !assessment) return checks;
  return checks.map((check) => (check.id === "never_used_for_spam" ? { ...check, ...assessment } : check));
}

/* ------------------------------------------------------------------ */
/* Backend client                                                      */
/* ------------------------------------------------------------------ */

const DOMAIN_API = `${AUTH_ORIGIN}/api/domain`;

function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal;
}

async function errorFrom(response) {
  const data = await response.json().catch(() => null);
  if (response.status === 401) return new Error("Your session has expired. Sign in again to use Domain Intelligence.");
  return new Error(data?.message || `Domain service error (${response.status}).`);
}

async function send(path, { method = "GET", body, signal, timeout = 60_000, headers = {} } = {}) {
  try {
    const response = await fetch(`${DOMAIN_API}${path}`, {
      method,
      credentials: "include",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: withTimeout(signal, timeout),
    });
    if (!response.ok) throw await errorFrom(response);
    return response;
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error?.name === "TimeoutError") throw new Error("The domain service took too long to respond.");
    if (error instanceof TypeError) throw new Error("Could not reach the domain service. Check your connection and try again.");
    throw error;
  }
}

async function request(path, options) {
  const response = await send(path, options);
  return response.status === 204 ? null : response.json();
}

let configPromise = null;

/** { integrations, defaultTlds, batchSize, maxSuggestions } from the backend, cached for the session. */
export function getDomainConfig() {
  configPromise ||= request("/config", { timeout: 20_000 }).catch((error) => {
    configPromise = null;
    throw error;
  });
  return configPromise;
}

/* ------------------------------------------------------------------ */
/* Availability, pricing and metrics                                   */
/* ------------------------------------------------------------------ */

const rdapCache = new Map();

export async function checkRdap(domain, { signal } = {}) {
  if (rdapCache.has(domain)) return rdapCache.get(domain);
  const result = await request(`/rdap?domain=${encodeURIComponent(domain)}`, { signal, timeout: 20_000 });
  if (typeof result?.available === "boolean") rdapCache.set(domain, result);
  return result;
}

export function checkDomainAvailability(domain, { signal } = {}) {
  return request("/availability", { method: "POST", body: { domain }, signal, timeout: 90_000 });
}

export function checkNameSiloDomain(domain, { signal } = {}) {
  return request("/namesilo", { method: "POST", body: { domain }, signal, timeout: 45_000 });
}

export function requestMozMetrics(domain, { signal } = {}) {
  return request("/moz", { method: "POST", body: { domain }, signal, timeout: 60_000 });
}

/* ------------------------------------------------------------------ */
/* AI naming and screening                                             */
/* ------------------------------------------------------------------ */

/**
 * Generates names with AI and keeps only confirmed-available ones. The backend
 * streams NDJSON progress events (round, candidates, availability) to `onEvent`.
 */
export async function collectAvailableSuggestions({ sourceDomain = null, brief = "", tlds, targetCount = BATCH_SIZE, excludedDomains = [], signal, onEvent = () => {} }) {
  const response = await send("/suggestions", {
    method: "POST",
    body: { sourceDomain, brief, tlds, targetCount, excludedDomains },
    headers: { Accept: "application/x-ndjson" },
    signal,
    timeout: 300_000,
  });
  if (!response.body || !/ndjson/i.test(response.headers.get("content-type") || "")) {
    const data = await response.json();
    return { suggestions: data.suggestions || [], candidatesChecked: data.candidatesChecked || 0 };
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const handle = (line) => {
    if (!line.trim()) return null;
    const event = JSON.parse(line);
    if (event.type === "done") return { suggestions: event.suggestions || [], candidatesChecked: event.candidatesChecked || 0 };
    if (event.type === "error") throw new Error(event.message || "Domain suggestions failed.");
    onEvent(event);
    return null;
  };
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const result = handle(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (result) return result;
      }
    }
    const result = handle(buffer);
    if (result) return result;
    throw new Error("The domain service ended the stream without results.");
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** Deep 43-point screening with live web research (up to four minutes). */
export function analyzeDomains({ sourceDomain = null, brief = "", candidates, signal }) {
  return request("/analyze", { method: "POST", body: { sourceDomain, brief, candidates }, signal, timeout: 300_000 });
}

/* ------------------------------------------------------------------ */
/* CRM history and favorites (scoped to the signed-in user)            */
/* ------------------------------------------------------------------ */

export async function crmBeginSearch({ sessionKey, requestKey, inputText, selectedMode, detectedMode, sourceDomain, tlds }) {
  const { id } = await request("/searches", { method: "POST", body: { sessionKey, requestKey, inputText, selectedMode, detectedMode, sourceDomain, tlds } });
  if (!id) throw new Error("CRM did not return a search ID.");
  return String(id);
}

export async function crmSaveDomainResult(searchId, item, { resultType, state, batch, rank }) {
  const { id } = await request(`/searches/${encodeURIComponent(searchId)}/results`, { method: "POST", body: { item, resultType, state, batch, rank } });
  if (!id) throw new Error("CRM did not return a domain result ID.");
  return String(id);
}

export async function crmUpdateSearch(searchId, { status, resultCount, batchCount, error = "" }) {
  if (!searchId) return;
  await request(`/searches/${encodeURIComponent(searchId)}`, { method: "PATCH", body: { status, resultCount, batchCount, error } });
}

export function crmHistory(page = 1) {
  return request(`/searches?page=${encodeURIComponent(page)}`);
}

export async function crmSearchResults(searchId) {
  const { results } = await request(`/searches/${encodeURIComponent(searchId)}/results`);
  return results || [];
}

export async function crmFavorites() {
  const { favorites } = await request("/favorites", { timeout: 90_000 });
  return favorites || [];
}

export async function crmSetFavorite(resultId, favorite) {
  await request(`/results/${encodeURIComponent(resultId)}/favorite`, { method: "POST", body: { favorite } });
}

export async function crmRecordCopy(resultId) {
  const { copyCount } = await request(`/results/${encodeURIComponent(resultId)}/copy`, { method: "POST", body: {} });
  return copyCount;
}

export async function crmSaveMoz(resultId, moz) {
  await request(`/results/${encodeURIComponent(resultId)}/moz`, { method: "POST", body: { moz } });
}
