jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
}));

import { buildPrompt } from '../src/copilot-failure-analysis-task/prompt-builder';
import type { TaskConfig } from '../src/copilot-failure-analysis-task/config';
import type { FailedStepLog } from '../src/copilot-failure-analysis-task/log-collector';

// --- Helpers ---

function makeConfig(overrides: Partial<TaskConfig> = {}): TaskConfig {
    return {
        connectedServiceName: 'GitHub Copilot CLI Decorator',
        githubPat: 'ghp_testpat1234567890',
        adoToken: 'ado-bearer-token',
        orgUrl: 'https://dev.azure.com/testorg',
        project: 'testproject',
        buildId: 1234,
        pipelineName: 'CI Pipeline',
        buildNumber: '20260303.1',
        sourceBranch: 'refs/heads/main',
        agentOS: 'Linux',
        maxLogLines: 150,
        copilotTimeout: 120,
        ...overrides,
    };
}

function makeLog(overrides: Partial<FailedStepLog> = {}): FailedStepLog {
    return {
        stepName: 'npm install',
        logContent: 'npm ERR! code ERESOLVE\nnpm ERR! Could not resolve dependency',
        issues: ['Process completed with exit code 1.'],
        ...overrides,
    };
}

// --- Tests ---

describe('prompt-builder — buildPrompt', () => {
    it('should produce correct structure with 1 failed step', () => {
        const config = makeConfig();
        const logs = [makeLog()];

        const prompt = buildPrompt(config, logs);

        // Prompt should contain pipeline context
        expect(prompt).toContain('CI Pipeline');
        expect(prompt).toContain('20260303.1');
        expect(prompt).toContain('refs/heads/main');
        expect(prompt).toContain('Linux');
        // Should contain the step name
        expect(prompt).toContain('npm install');
        // Should contain log content (possibly shell-escaped)
        expect(prompt).toContain('npm ERR!');
        // Should contain response format instructions
        expect(prompt).toContain('Root Cause');
        expect(prompt).toContain('Suggested Fix');
    });

    it('should include multiple failed steps', () => {
        const config = makeConfig();
        const logs = [
            makeLog({ stepName: 'Step A', logContent: 'Error in step A' }),
            makeLog({ stepName: 'Step B', logContent: 'Error in step B' }),
            makeLog({ stepName: 'Step C', logContent: 'Error in step C' }),
        ];

        const prompt = buildPrompt(config, logs);

        expect(prompt).toContain('Step A');
        expect(prompt).toContain('Step B');
        expect(prompt).toContain('Step C');
        expect(prompt).toContain('Error in step A');
        expect(prompt).toContain('Error in step B');
        expect(prompt).toContain('Error in step C');
    });

    it('should not truncate prompt within size limit', () => {
        const config = makeConfig();
        const logs = [makeLog({ logContent: 'Short log' })];

        const prompt = buildPrompt(config, logs);

        // Should NOT contain truncation marker
        expect(prompt).not.toContain('[...truncated');
    });

    it('should apply smart truncation for oversized prompt (error lines kept)', () => {
        const config = makeConfig();

        // Generate a very large log that exceeds ~48KB
        const errorLine = 'ERROR: This is a critical error that must be preserved\n';
        const normalLine = 'INFO: This is a normal log line with some padding content here.\n';

        // Create a log just over 48KB — mostly normal lines with some error lines
        const lines: string[] = [];
        for (let i = 0; i < 1500; i++) {
            // Sprinkle error lines every ~100 lines
            if (i % 100 === 0) {
                lines.push(errorLine.trim());
            } else {
                lines.push(normalLine.trim());
            }
        }
        const bigLog = lines.join('\n');

        const logs = [makeLog({ logContent: bigLog })];
        const prompt = buildPrompt(config, logs);

        // Should be within size limit (escaped prompt may be slightly different)
        // The key assertion: error lines should be preserved
        expect(prompt).toContain('ERROR: This is a critical error');
        // The truncation marker should appear
        expect(prompt).toContain('truncated');
    });

    it('should shell-escape single quotes in log content', () => {
        const config = makeConfig();
        const logs = [
            makeLog({
                logContent: "can't find module '@azure/core-rest'",
            }),
        ];

        const prompt = buildPrompt(config, logs);

        // Shell escape replaces ' with '\''
        // The escaped version wraps each single quote as: '\''  
        // So "can't" becomes "can'\''t"
        expect(prompt).toContain("'\\''");
    });

    it('should produce valid prompt structure with empty logs array', () => {
        const config = makeConfig();
        const logs: FailedStepLog[] = [];

        const prompt = buildPrompt(config, logs);

        // Should still have the header and footer
        expect(prompt).toContain('CI/CD failure analyst');
        expect(prompt).toContain('Pipeline Context');
        expect(prompt).toContain('CI Pipeline');
        expect(prompt).toContain('Response Format');
        expect(prompt).toContain('Root Cause');
    });

    it('should include issues in prompt when present', () => {
        const config = makeConfig();
        const logs = [
            makeLog({
                issues: ['Error: ENOENT', 'npm ERR! code ERESOLVE'],
            }),
        ];

        const prompt = buildPrompt(config, logs);

        expect(prompt).toContain('Issues reported');
        expect(prompt).toContain('ENOENT');
        expect(prompt).toContain('ERESOLVE');
    });
});
