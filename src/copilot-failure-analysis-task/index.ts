import * as tl from 'azure-pipelines-task-lib/task';
import { readConfig } from './config';

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

        // 3. Collect failed task logs (placeholder — will be implemented in #4)
        // const logs = await collectLogs(config);

        // 4. Build prompt (placeholder — will be implemented in #5)
        // const prompt = buildPrompt(config, logs);

        // 5. Run Copilot analysis (placeholder — will be implemented in #6)
        // const analysis = await analyzeLogs(prompt, config);

        // 6. Format output (placeholder — will be implemented in #7)
        // await formatOutput(analysis, config);

        tl.setResult(tl.TaskResult.Succeeded, 'Copilot analysis complete');
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
