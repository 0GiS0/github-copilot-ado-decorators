import * as tl from 'azure-pipelines-task-lib/task';
import * as https from 'https';
import * as url from 'url';
import { TaskConfig } from './config.js';

/**
 * Represents a failed pipeline step with its log content and issues.
 */
export interface FailedStepLog {
    /** Display name of the failed task/step */
    stepName: string;
    /** Truncated log content (last N lines) */
    logContent: string;
    /** Error/warning messages from the timeline record */
    issues: string[];
}

/**
 * Makes an authenticated HTTPS GET request to the Azure DevOps REST API.
 * Uses Node.js built-in `https` module — no external dependencies.
 */
function httpsGet(requestUrl: string, token: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsed = new url.URL(requestUrl);
        const options: https.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(
                        new Error(
                            `ADO API returned HTTP ${res.statusCode}: ${body.substring(0, 200)}`,
                        ),
                    );
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('ADO API request timed out after 30 seconds'));
        });
        req.end();
    });
}

/** Simple delay helper */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Timeline record shape (partial — only fields we use)
interface TimelineRecord {
    name: string;
    type: string;
    state: string;
    result: string | null;
    log?: { id: number; url: string };
    issues?: Array<{ message?: string }>;
}

/**
 * Fetches the build timeline and filters for failed Task records.
 * Returns the full list of failed task records, or an empty array.
 */
async function fetchFailedTasks(
    baseUrl: string,
    config: TaskConfig,
    attempt: number,
    maxAttempts: number,
): Promise<TimelineRecord[]> {
    const timelineUrl =
        `${baseUrl}/${encodeURIComponent(config.project)}/_apis/build/builds/${config.buildId}/timeline?api-version=7.1`;

    console.log(`[Copilot Analysis] Fetching timeline (attempt ${attempt}/${maxAttempts}): ${timelineUrl}`);
    const timelineBody = await httpsGet(timelineUrl, config.adoToken);
    const timeline = JSON.parse(timelineBody);

    if (!timeline.records || !Array.isArray(timeline.records)) {
        console.log('[Copilot Analysis] No timeline records found in API response');
        return [];
    }

    // Log summary of all records for diagnostics
    console.log(`[Copilot Analysis] Timeline has ${timeline.records.length} records:`);
    for (const r of timeline.records) {
        console.log(`  - ${r.name} [type=${r.type}, state=${r.state}, result=${r.result}]`);
    }

    // Filter for failed Task records (case-insensitive)
    const failedTasks = timeline.records.filter(
        (r: TimelineRecord) =>
            r.result?.toLowerCase() === 'failed' && r.type?.toLowerCase() === 'task',
    );

    return failedTasks;
}

/**
 * Fetches failed step logs from the Azure DevOps Build Timeline API.
 *
 * The ADO agent runs post-job steps immediately after a failure, but the
 * server-side Timeline API may not have propagated the failed result yet.
 * To handle this race condition, we retry the timeline query with a delay.
 *
 * 1. Waits briefly to let the timeline API catch up.
 * 2. Calls the Timeline API and filters for failed Task records.
 * 3. If none found, retries up to MAX_RETRIES times (common race condition).
 * 4. Fetches the log for each failed task.
 * 5. Truncates logs to the last `config.maxLogLines` lines.
 *
 * @returns Array of FailedStepLog (empty if no failures or on error)
 */
export async function getFailedStepLogs(config: TaskConfig): Promise<FailedStepLog[]> {
    const MAX_RETRIES = 4;
    const INITIAL_DELAY_MS = 2000;
    const RETRY_DELAY_MS = 3000;

    // Normalize orgUrl — strip trailing slash to avoid double-slash in URL
    const baseUrl = config.orgUrl.replace(/\/+$/, '');

    // Initial delay — give the Timeline API time to propagate results.
    // The agent evaluates conditions locally and starts post-job steps
    // before the server-side timeline has been fully updated.
    console.log(
        `[Copilot Analysis] Waiting ${INITIAL_DELAY_MS / 1000}s for timeline to finalize...`,
    );
    await delay(INITIAL_DELAY_MS);

    // Retry loop — the timeline may need several seconds to propagate
    let failedTasks: TimelineRecord[] = [];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            failedTasks = await fetchFailedTasks(baseUrl, config, attempt, MAX_RETRIES);

            if (failedTasks.length > 0) {
                console.log(
                    `[Copilot Analysis] Found ${failedTasks.length} failed task(s) on attempt ${attempt}`,
                );
                break;
            }

            if (attempt < MAX_RETRIES) {
                console.log(
                    `[Copilot Analysis] No failed tasks found yet. ` +
                    `Timeline may still be propagating. Retrying in ${RETRY_DELAY_MS / 1000}s...`,
                );
                await delay(RETRY_DELAY_MS);
            } else {
                console.log(
                    `[Copilot Analysis] No failed tasks found after ${MAX_RETRIES} attempts. ` +
                    `The timeline API did not report any failed records.`,
                );
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            tl.warning(`Failed to fetch timeline (attempt ${attempt}): ${msg}`);
            if (attempt < MAX_RETRIES) {
                await delay(RETRY_DELAY_MS);
            }
        }
    }

    if (failedTasks.length === 0) {
        return [];
    }

    // Fetch logs for each failed task
    const failedLogs: FailedStepLog[] = [];

    for (const task of failedTasks) {
        const stepName: string = task.name ?? 'Unknown Step';
        let logContent = '';
        const issues: string[] = [];

        // Collect issues from the timeline record
        if (Array.isArray(task.issues)) {
            for (const issue of task.issues) {
                if (issue.message) {
                    issues.push(issue.message);
                }
            }
        }

        // Fetch log if available
        if (task.log && task.log.id) {
            try {
                const logUrl =
                    `${baseUrl}/${encodeURIComponent(config.project)}/_apis/build/builds/${config.buildId}/logs/${task.log.id}?api-version=7.1`;

                console.log(`[Copilot Analysis] Fetching log ${task.log.id} for step "${stepName}"`);
                const rawLog = await httpsGet(logUrl, config.adoToken);

                // Truncate to last N lines — errors are typically at the end
                const lines = rawLog.split('\n');
                if (lines.length > config.maxLogLines) {
                    logContent = lines.slice(-config.maxLogLines).join('\n');
                } else {
                    logContent = rawLog;
                }
            } catch (logError: unknown) {
                const msg =
                    logError instanceof Error ? logError.message : String(logError);
                tl.warning(`Failed to fetch log for step "${stepName}": ${msg}`);
                logContent = `[Log unavailable: ${msg}]`;
            }
        } else {
            logContent = '[No log available for this step]';
        }

        failedLogs.push({ stepName, logContent, issues });
    }

    return failedLogs;
}
