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

/**
 * Fetches failed step logs from the Azure DevOps Build Timeline API.
 *
 * 1. Calls the Timeline API to get all records for the current build.
 * 2. Filters for failed Task records.
 * 3. Fetches the log for each failed task.
 * 4. Truncates logs to the last `config.maxLogLines` lines.
 * 5. Collects issues from the timeline record.
 *
 * @returns Array of FailedStepLog (empty if no failures or on error)
 */
export async function getFailedStepLogs(config: TaskConfig): Promise<FailedStepLog[]> {
    const failedLogs: FailedStepLog[] = [];

    try {
        // Normalize orgUrl — strip trailing slash to avoid double-slash in URL
        const baseUrl = config.orgUrl.replace(/\/+$/, '');

        // 1. Fetch build timeline
        const timelineUrl =
            `${baseUrl}/${encodeURIComponent(config.project)}/_apis/build/builds/${config.buildId}/timeline?api-version=7.1`;

        tl.debug(`Fetching timeline: ${timelineUrl}`);
        const timelineBody = await httpsGet(timelineUrl, config.adoToken);
        const timeline = JSON.parse(timelineBody);

        if (!timeline.records || !Array.isArray(timeline.records)) {
            tl.debug('No timeline records found');
            return [];
        }

        // Log summary of all records for diagnostics
        const recordSummary = timeline.records.map(
            (r: { name: string; type: string; result: string }) =>
                `${r.name} [type=${r.type}, result=${r.result}]`,
        );
        tl.debug(`Timeline has ${timeline.records.length} records: ${recordSummary.join('; ')}`);

        // 2. Filter for failed Task records (case-insensitive comparison
        //    because the ADO API may return "failed" or "Failed")
        const failedTasks = timeline.records.filter(
            (r: { result: string; type: string }) =>
                r.result?.toLowerCase() === 'failed' && r.type === 'Task',
        );

        if (failedTasks.length === 0) {
            tl.debug('No failed task records in timeline');
            return [];
        }

        tl.debug(`Found ${failedTasks.length} failed task(s)`);

        // 3. Fetch logs for each failed task
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

                    tl.debug(`Fetching log ${task.log.id} for step "${stepName}"`);
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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        tl.warning(`Failed to collect pipeline logs: ${msg}`);
        // Return empty — don't break the pipeline
    }

    return failedLogs;
}
