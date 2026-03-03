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
    const totalStart = Date.now();

    try {
        // Phase 1: Read configuration
        console.log('[Copilot Analysis] Phase 1/6: Reading configuration...');
        let phaseStart = Date.now();
        const config = readConfig();
        console.log(`[Copilot Analysis] Configuration loaded (${Date.now() - phaseStart}ms)`);

        // Phase 2: Validate PAT
        console.log('[Copilot Analysis] Phase 2/6: Validating credentials...');
        if (!config.githubPat) {
            tl.warning(
                'GitHub PAT not available from service connection. Skipping analysis.',
            );
            tl.setResult(tl.TaskResult.Succeeded, 'Analysis skipped — no PAT');
            return;
        }
        console.log('[Copilot Analysis] Credentials validated');

        // Phase 3: Collect failed task logs
        console.log('[Copilot Analysis] Phase 3/6: Collecting failed step logs...');
        phaseStart = Date.now();
        const logs = await getFailedStepLogs(config);
        const logDuration = Date.now() - phaseStart;

        if (logs.length === 0) {
            console.log(`[Copilot Analysis] No failed steps found (${logDuration}ms)`);
            tl.setResult(tl.TaskResult.Succeeded, 'No failed steps to analyse');
            return;
        }

        console.log(`[Copilot Analysis] Collected logs from ${logs.length} failed step(s) (${logDuration}ms)`);

        // Phase 4: Build prompt
        console.log('[Copilot Analysis] Phase 4/6: Building analysis prompt...');
        phaseStart = Date.now();
        const prompt = buildPrompt(config, logs);
        console.log(`[Copilot Analysis] Prompt built — ${prompt.length} chars (${Date.now() - phaseStart}ms)`);

        // Phase 5: Run Copilot analysis
        console.log('[Copilot Analysis] Phase 5/6: Running Copilot analysis...');
        phaseStart = Date.now();
        const analysis = await analyzeLogs(prompt, config);
        console.log(`[Copilot Analysis] Analysis ${analysis.success ? 'completed' : 'failed'} (${Date.now() - phaseStart}ms)`);

        // Phase 6: Format and display results
        console.log('[Copilot Analysis] Phase 6/6: Formatting results...');
        phaseStart = Date.now();
        await formatAndDisplay(analysis, config);
        console.log(`[Copilot Analysis] Results formatted (${Date.now() - phaseStart}ms)`);

        const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
        console.log(`[Copilot Analysis] Total duration: ${totalDuration}s`);

        if (analysis.success) {
            tl.setResult(tl.TaskResult.Succeeded, `Copilot analysis complete (${totalDuration}s)`);
        } else {
            tl.setResult(
                tl.TaskResult.SucceededWithIssues,
                `Analysis completed with issues: ${analysis.errorMessage ?? 'unknown'}`,
            );
        }
    } catch (error: unknown) {
        const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
        // NEVER fail the pipeline — surface as warning + SucceededWithIssues
        const message = error instanceof Error ? error.message : String(error);
        tl.warning(`Copilot analysis failed after ${totalDuration}s: ${message}`);
        tl.setResult(
            tl.TaskResult.SucceededWithIssues,
            `Analysis failed: ${message}`,
        );
    }
}

run();
