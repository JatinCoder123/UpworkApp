import { CRM_BASE_URL, api, createAppError, logJobActivity } from "./api";
import { asArray, asObject, asText } from "../lib/safe";

/*
 * Proposals sent to Upwork from the app (CRM entryPoint=upworkSubmitProposal), in two steps:
 * 1. GET with the job returns the job (fixed or hourly, budget, screening questions) and `form`: the request body with
 *    what the CRM already knows filled in (record_id, the generated cover letter, a starting amount).
 * 2. POST the filled-in form. With dry_run 1 it is only checked (`would_send` is exactly what Upwork would get); with
 *    dry_run 0 the proposal is submitted, Connects are spent and the CRM job becomes Applied.
 * The endpoint has no login or key yet, and file attachments wait on an Upwork permission, so none are sent from here.
 */
export const SUBMIT_PROPOSAL_URL = import.meta.env?.VITE_SUBMIT_PROPOSAL_URL || `${CRM_BASE_URL}/index.php?entryPoint=upworkSubmitProposal`;

// The choices Upwork offers, used when the form's `fields` do not list them.
export const DURATIONS = ["Less than 1 month", "1 to 3 months", "3 to 6 months", "More than 6 months"];
export const RATE_INCREASE_MONTHS = [3, 6, 12];

async function proposalEndpoint(query = "", init = undefined) {
  // In development through the dev proxy (same site); on the live site straight to the CRM.
  const base = import.meta.env?.DEV ? "/crm-entrypoint/index.php?entryPoint=upworkSubmitProposal" : SUBMIT_PROPOSAL_URL;
  let response;
  try {
    response = await fetch(`${base}${query}`, init);
  } catch {
    throw createAppError("PROPOSAL_UNREACHABLE", "The proposal service could not be reached. Check the connection and try again.");
  }
  const data = await response.json().catch(() => null);
  // Errors come as { success: false, errors: [...], hint } with 422 (wrong input, already applied, not enough
  // Connects), 404 (job not found or closed) or 502 (a problem on Upwork's side).
  if (!data?.success) {
    const errors = asArray(data?.errors).map(asText).filter(Boolean);
    throw createAppError("PROPOSAL_FAILED", errors.join("\n") || `The proposal service failed (${response.status}).`, { errors, hint: asText(data?.hint), status: response.status });
  }
  return data;
}

// Step 1 for a CRM job: { job, form, fields } as the endpoint returns them. The record id brings the CRM's cover letter
// and lets the endpoint mark the record Applied; the Upwork link finds the job on Upwork.
export async function fetchProposalForm(job) {
  const params = new URLSearchParams();
  if (job?.url) params.set("job", job.url);
  if (job?.id) params.set("record_id", job.id);
  const data = await proposalEndpoint(`&${params}`);
  return { job: asObject(data.job), form: asObject(data.form), fields: asObject(data.fields) };
}

const toNumber = (value) => {
  const number = Number(asText(value).trim());
  return asText(value).trim() && Number.isFinite(number) ? number : null;
};

// The milestone and project rows the user filled in; untouched rows are left out.
export const filledMilestones = (draft) => asArray(draft.milestones).filter((row) => row.description.trim() || asText(row.amount).trim() || row.dueDate);
export const filledProjects = (draft) => asArray(draft.projects).filter((row) => row.title.trim() || row.url.trim() || row.description.trim());

// The POST body for the dialog's draft. `dry_run` is always set: left out, the endpoint would submit for real.
export function proposalBody(draft, { dryRun = true } = {}) {
  const body = { job: draft.job, ...(draft.recordId ? { record_id: draft.recordId } : {}), cover_letter: draft.coverLetter.trim() };
  if (draft.hourly) {
    body.amount = toNumber(draft.amount);
    const percent = toNumber(draft.rateIncrease.percent), everyMonths = toNumber(draft.rateIncrease.everyMonths);
    if (percent && everyMonths) body.rate_increase = { percent, every_months: everyMonths };
  } else {
    body.payment_type = draft.paymentType;
    // By milestone the amount is left out: the endpoint adds the milestones up.
    if (draft.paymentType === "milestone") body.milestones = filledMilestones(draft).map((row) => ({ description: row.description.trim(), amount: toNumber(row.amount), due_date: row.dueDate }));
    else body.amount = toNumber(draft.amount);
  }
  if (draft.duration) body.estimated_duration = draft.duration;
  if (draft.answers.length) body.answers = draft.answers.map(({ question, answer }) => ({ question, answer: answer.trim() }));
  body.boost = toNumber(draft.boost) || 0;
  const projects = filledProjects(draft).map((row) => ({ title: row.title.trim(), url: row.url.trim(), description: row.description.trim() }));
  if (projects.length) body.projects = projects;
  body.dry_run = dryRun === false ? 0 : 1;
  return body;
}

// Step 2. A dry run comes back as { dryRun: true, wouldSend }; a real submit as { proposalId, recordStatus }.
export async function sendProposal(body) {
  const data = await proposalEndpoint("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    dryRun: data.dry_run === true || data.dry_run === 1,
    wouldSend: data.would_send ?? null,
    proposalId: asText(data.proposal_id),
    recordStatus: asText(data.record_status),
    message: asText(data.message),
  };
}

// After a real submit. The endpoint sets the CRM job to Applied itself; setting it here too keeps the app's own copy of
// the job in step, and the "Applied" activity entry is what puts the job in this user's Applied list.
export async function markProposalApplied(job, userEmail) {
  const updated = await api.updateStatus({ id: job.id, status: "Applied" });
  if (userEmail) await logJobActivity({ jobId: job.id, userEmail, description: "Applied" });
  return updated;
}
