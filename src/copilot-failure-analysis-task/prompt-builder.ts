import { TaskConfig } from './config.js';
import { FailedStepLog } from './log-collector.js';

/** Maximum prompt size in characters (~48 KB ≈ ~12,000 tokens) */
const MAX_PROMPT_SIZE = 48 * 1024;

/** Patterns that indicate an error line — used when prioritising truncation */
const ERROR_PATTERNS = /\b(error|Error|ERROR|FAILED|exception|Exception|fatal|Fatal|FATAL)\b/;

/**
 * Escapes a string for safe use as a shell argument.
 * Wraps in single quotes and escapes any embedded single quotes.
 */
function shellEscape(value: string): string {
    // Replace single quotes with the shell-safe escape sequence
    return value.replace(/'/g, "'\\''");
}

/**
 * Truncates a log excerpt intelligently when the overall prompt exceeds
 * the size budget. Keeps error-relevant lines and trims the rest.
 *
 * @param log       Full log text
 * @param maxChars  Maximum characters allowed for this log
 * @returns         Truncated log text
 */
function truncateLogSmart(log: string, maxChars: number): string {
    if (log.length <= maxChars) return log;

    const lines = log.split('\n');

    // Separate error lines from non-error lines, preserving order indices
    const errorLines: { idx: number; line: string }[] = [];
    const otherLines: { idx: number; line: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (ERROR_PATTERNS.test(lines[i])) {
            errorLines.push({ idx: i, line: lines[i] });
        } else {
            otherLines.push({ idx: i, line: lines[i] });
        }
    }

    // Always keep all error lines first, then fill remaining budget with tail lines
    let result: { idx: number; line: string }[] = [...errorLines];
    let currentSize = result.reduce((s, l) => s + l.line.length + 1, 0);

    // Add non-error lines from the end (most-recent first, reversed later)
    for (let i = otherLines.length - 1; i >= 0 && currentSize < maxChars; i--) {
        const line = otherLines[i];
        if (currentSize + line.line.length + 1 <= maxChars) {
            result.push(line);
            currentSize += line.line.length + 1;
        }
    }

    // Sort by original index to preserve logical order
    result.sort((a, b) => a.idx - b.idx);

    const truncated = result.map((l) => l.line).join('\n');
    return `[...truncated to fit prompt budget...]\n${truncated}`;
}

/**
 * Builds the combined prompt that will be sent to Copilot CLI for analysis.
 *
 * @param config  Task configuration (pipeline metadata)
 * @param logs    Array of failed step logs
 * @returns       Escaped prompt string ready for CLI invocation
 */
export function buildPrompt(config: TaskConfig, logs: FailedStepLog[]): string {
    // --- Persona & instructions ---
    const header = [
        'You are a CI/CD failure analyst. Analyze the following Azure DevOps pipeline failure and provide actionable guidance.',
        '',
        '## Pipeline Context',
        `- **Pipeline:** ${config.pipelineName}`,
        `- **Build number:** ${config.buildNumber}`,
        `- **Branch:** ${config.sourceBranch}`,
        `- **Agent OS:** ${config.agentOS}`,
        '',
        '## Failed Steps',
    ].join('\n');

    // --- Build per-step sections ---
    const stepSections: string[] = [];
    for (const log of logs) {
        const issueText =
            log.issues.length > 0
                ? `### Issues reported\n${log.issues.map((i) => `- ${i}`).join('\n')}\n`
                : '';

        stepSections.push(
            [
                `### Step: ${log.stepName}`,
                issueText,
                '```',
                log.logContent,
                '```',
                '',
            ].join('\n'),
        );
    }

    // --- Response format instructions ---
    const footer = [
        '',
        '## Response Format',
        'Please structure your response with these sections:',
        '1. **Root Cause** — One-sentence summary of why the build failed',
        '2. **Details** — Technical explanation of the failure',
        '3. **Suggested Fix** — Concrete steps to resolve the issue',
        '4. **Related Documentation** — Links or references if applicable',
    ].join('\n');

    // --- Combine and enforce size limit ---
    let fullPrompt = [header, ...stepSections, footer].join('\n');

    if (fullPrompt.length > MAX_PROMPT_SIZE) {
        // Recalculate with truncated logs
        const overhead = header.length + footer.length + 256; // buffer for section headers
        const logBudget = MAX_PROMPT_SIZE - overhead;
        const perStepBudget = Math.floor(logBudget / Math.max(logs.length, 1));

        const truncatedSections: string[] = [];
        for (const log of logs) {
            const truncatedLog = truncateLogSmart(log.logContent, perStepBudget);
            const issueText =
                log.issues.length > 0
                    ? `### Issues reported\n${log.issues.map((i) => `- ${i}`).join('\n')}\n`
                    : '';

            truncatedSections.push(
                [
                    `### Step: ${log.stepName}`,
                    issueText,
                    '```',
                    truncatedLog,
                    '```',
                    '',
                ].join('\n'),
            );
        }

        fullPrompt = [header, ...truncatedSections, footer].join('\n');
    }

    // Escape for safe shell invocation
    return shellEscape(fullPrompt);
}
