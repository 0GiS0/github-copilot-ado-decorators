import * as tl from 'azure-pipelines-task-lib/task';
import { readConfig } from './config.js';
import { getFailedStepLogs } from './log-collector.js';
import { buildPrompt } from './prompt-builder.js';
import { analyzeLogs } from './ai-analyzer.js';
import { formatAndDisplay } from './output-formatter.js';

/**
 * Main entry point for the Copilot Failure Analysis task.
 *
 * Orchestrates config reading, log collection, prompt building,
 * Copilot invocation, and output formatting.
 *
 * CRITICAL: This function NEVER throws to the caller — all errors
 * are caught and surfaced as warnings so the pipeline is not failed further.
 */
async function run(): Promise<void> {
    try {
        // 1. Read configuration from task inputs and pipeline variables
        const config = readConfig();

        // 2. Validate PAT availability
        if (!config.githubPat) {
            tl.warning(
                'GitHub PAT not available from service connection. Skipping analysis.',
            );
            tl.setResult(tl.TaskResult.Succeeded, 'Analysis skipped — no PAT');
            return;
        }

        // 3. Collect failed task logs from the build timeline
        const logs = await getFailedStepLogs(config);

        if (logs.length === 0) {
            tl.debug('No failed steps found — nothing to analyse');
            tl.setResult(tl.TaskResult.Succeeded, 'No failed steps to analyse');
            return;
        }

        tl.debug(`Collected logs from ${logs.length} failed step(s)`);

        // 4. Build the prompt for Copilot
        const prompt = buildPrompt(config, logs);

        // 5. Run Copilot analysis
        const analysis = await analyzeLogs(prompt, config);

        // 6. Format and display results
        await formatAndDisplay(analysis, config);

        if (analysis.success) {
            tl.setResult(tl.TaskResult.Succeeded, 'Copilot analysis complete');
        } else {
            tl.setResult(
                tl.TaskResult.SucceededWithIssues,
                `Analysis completed with issues: ${analysis.errorMessage ?? 'unknown'}`,
            );
        }
    } catch (error: unknown) {
        // NEVER fail the pipeline — surface as warning + SucceededWithIssues
        const message = error instanceof Error ? error.message : String(error);
        tl.warning(`Copilot analysis failed: ${message}`);
        tl.setResult(
            tl.TaskResult.SucceededWithIssues,
            `Analysis failed: ${message}`,
        );
    }
}

run();
