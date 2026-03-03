import * as tl from 'azure-pipelines-task-lib/task';
import { execFile } from 'child_process';
import { TaskConfig } from './config.js';

/**
 * Result of the Copilot analysis invocation.
 */
export interface AnalysisResult {
    /** Raw analysis text returned by Copilot CLI */
    analysisText: string;
    /** Whether the analysis completed successfully */
    success: boolean;
    /** Duration of the Copilot invocation in milliseconds */
    duration: number;
    /** Error message if success is false */
    errorMessage?: string;
}

/**
 * Sanitises an error message to prevent the GitHub PAT from leaking.
 */
function sanitiseError(message: string, pat: string): string {
    if (!pat) return message;
    // Replace all occurrences of the PAT with a redacted placeholder
    return message.split(pat).join('***');
}

/**
 * Invokes the GitHub Copilot CLI to analyse pipeline failure logs.
 *
 * Uses `npx @github/copilot -sp <prompt>` with `GITHUB_TOKEN` set in the
 * environment. Captures stdout as the analysis text.
 *
 * NEVER throws — always returns an AnalysisResult. On any error the result
 * will have `success: false` with a descriptive `errorMessage`.
 *
 * @param prompt  The escaped prompt string built by prompt-builder
 * @param config  Task configuration (PAT, timeout, etc.)
 * @returns       AnalysisResult with the AI response or error details
 */
export async function analyzeLogs(
    prompt: string,
    config: TaskConfig,
): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
        const analysisText = await new Promise<string>((resolve, reject) => {
            const child = execFile(
                'npx',
                ['@github/copilot', '-sp', prompt],
                {
                    env: { ...process.env, GITHUB_TOKEN: config.githubPat },
                    timeout: config.copilotTimeout * 1000,
                    maxBuffer: 1024 * 1024, // 1 MB
                },
                (error, stdout, stderr) => {
                    if (error) {
                        // Sanitise so the PAT is not exposed
                        const safeMsg = sanitiseError(
                            error.message,
                            config.githubPat,
                        );

                        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                            reject(
                                new Error(
                                    'npx command not found — ensure Node.js is installed on the agent',
                                ),
                            );
                            return;
                        }
                        if (error.killed) {
                            reject(
                                new Error(
                                    `Copilot CLI timed out after ${config.copilotTimeout} seconds`,
                                ),
                            );
                            return;
                        }
                        reject(new Error(`Copilot CLI error: ${safeMsg}`));
                        return;
                    }

                    const output = (stdout ?? '').trim();
                    if (!output) {
                        reject(
                            new Error(
                                'Copilot CLI returned empty response',
                            ),
                        );
                        return;
                    }

                    resolve(output);
                },
            );

            // Extra safety: if the process object itself errors
            child.on('error', (err) => {
                reject(
                    new Error(
                        `Failed to spawn Copilot CLI: ${sanitiseError(err.message, config.githubPat)}`,
                    ),
                );
            });
        });

        const duration = Date.now() - startTime;
        return { analysisText, success: true, duration };
    } catch (error: unknown) {
        const duration = Date.now() - startTime;
        const rawMsg = error instanceof Error ? error.message : String(error);
        const errorMessage = sanitiseError(rawMsg, config.githubPat);

        tl.warning(`Copilot analysis error: ${errorMessage}`);

        return {
            analysisText: '',
            success: false,
            duration,
            errorMessage,
        };
    }
}
