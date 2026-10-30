import { MCP_CRM_BASE_URL, createAppError } from "./api";
import { asText } from "../lib/safe";

/*
 * NOT IN USE YET: the share dialog still opens Teams with the message ready (ShareJobDialog), because the CRM entry point
 * does not allow calls from the browser on the live site (no CORS headers, unlike smart_gateway). Once it does, import
 * sendTeamsMessage in ShareJobDialog and call it for each chosen person instead of opening the Teams chat link.
 *
 * Teams messages sent from the app (CRM entryPoint=send_teams_message): a POST with { email, message } posts the
 * message to that person in Teams, one person per call; "\n" in the message starts a new line. The entry point's key
 * goes in X-Api-Key (VITE_TEAMS_MESSAGE_KEY in .env). Errors come as { success: false, error } with 401 (wrong key),
 * 400 (no valid email, or no message) or 405 (not a POST).
 */
export const TEAMS_MESSAGE_URL = import.meta.env?.VITE_TEAMS_MESSAGE_URL || `${MCP_CRM_BASE_URL}/index.php?entryPoint=send_teams_message`;
const TEAMS_MESSAGE_KEY = import.meta.env?.VITE_TEAMS_MESSAGE_KEY || "";

export async function sendTeamsMessage({ email, message }) {
  if (!TEAMS_MESSAGE_KEY) throw createAppError("TEAMS_NOT_SET_UP", "Sending to Teams is not set up yet (VITE_TEAMS_MESSAGE_KEY is missing).");
  // In development through the dev proxy (same site); on the live site straight to the CRM.
  const url = import.meta.env?.DEV ? "/mcp-proxy/index.php?entryPoint=send_teams_message" : TEAMS_MESSAGE_URL;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": TEAMS_MESSAGE_KEY },
      body: JSON.stringify({ email, message }),
    });
  } catch {
    throw createAppError("TEAMS_UNREACHABLE", "The Teams message service could not be reached.");
  }
  const data = await response.json().catch(() => null);
  if (!data?.success) throw createAppError("TEAMS_FAILED", asText(data?.error) || `The Teams message could not be sent (${response.status}).`, { status: response.status });
  return data;
}
