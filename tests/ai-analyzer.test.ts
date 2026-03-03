import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// --- Mocks ---
jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
}));

jest.mock('child_process', () => ({
    execFile: jest.fn(),
}));

import * as tl from 'azure-pipelines-task-lib/task';
import { analyzeLogs } from '../src/copilot-failure-analysis-task/ai-analyzer';
import type { TaskConfig } from '../src/copilot-failure-analysis-task/config';

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

const copilotFixture = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'copilot-response.txt'),
    'utf8',
);

const mockedExecFile = execFile as unknown as jest.MockedFunction<
    (
        file: string,
        args: string[],
        options: any,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => { on: jest.Mock }
>;

/**
 * Simulate a successful execFile call.
 */
function mockExecFileSuccess(stdout: string) {
    mockedExecFile.mockImplementation(
        (_file: string, _args: string[], _options: any, callback: any) => {
            process.nextTick(() => callback(null, stdout, ''));
            return { on: jest.fn() } as any;
        },
    );
}

/**
 * Simulate a failed execFile call with an error.
 */
function mockExecFileError(error: Partial<NodeJS.ErrnoException> & { killed?: boolean }) {
    mockedExecFile.mockImplementation(
        (_file: string, _args: string[], _options: any, callback: any) => {
            const err = new Error(error.message ?? 'Unknown error') as NodeJS.ErrnoException & { killed?: boolean };
            err.code = error.code;
            err.killed = error.killed ?? false;
            process.nextTick(() => callback(err, '', ''));
            return { on: jest.fn() } as any;
        },
    );
}

// --- Tests ---

describe('ai-analyzer — analyzeLogs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return success with analysis text and duration', async () => {
        mockExecFileSuccess(copilotFixture);

        const config = makeConfig();
        const result = await analyzeLogs('test prompt', config);

        expect(result.success).toBe(true);
        expect(result.analysisText).toContain('Root Cause');
        expect(result.analysisText).toContain('ERESOLVE');
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.errorMessage).toBeUndefined();
    });

    it('should return failure with descriptive error when CLI not found (ENOENT)', async () => {
        mockExecFileError({ code: 'ENOENT', message: 'spawn npx ENOENT' });

        const result = await analyzeLogs('test prompt', makeConfig());

        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('npx command not found');
        expect(result.errorMessage).toContain('Node.js');
        expect(result.analysisText).toBe('');
        expect(tl.warning).toHaveBeenCalled();
    });

    it('should return failure with timeout message when CLI times out', async () => {
        mockExecFileError({ killed: true, message: 'process killed' });

        const config = makeConfig({ copilotTimeout: 60 });
        const result = await analyzeLogs('test prompt', config);

        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('timed out');
        expect(result.errorMessage).toContain('60');
    });

    it('should return failure when stdout is empty', async () => {
        mockExecFileSuccess('   \n  ');

        const result = await analyzeLogs('test prompt', makeConfig());

        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('empty response');
    });

    it('should return failure with error on non-zero exit', async () => {
        mockExecFileError({ message: 'Command failed: npx @github/copilot -sp' });

        const result = await analyzeLogs('test prompt', makeConfig());

        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('Copilot CLI error');
    });

    it('should sanitize PAT from error messages', async () => {
        const pat = 'ghp_supersecret1234567890abcdef';
        mockExecFileError({
            message: `Authentication failed for token ${pat}: 401 Unauthorized`,
        });

        const config = makeConfig({ githubPat: pat });
        const result = await analyzeLogs('test prompt', config);

        expect(result.success).toBe(false);
        // The PAT must NOT appear in the error message
        expect(result.errorMessage).not.toContain(pat);
        expect(result.errorMessage).toContain('***');
    });

    it('should set GITHUB_TOKEN in the child process environment', async () => {
        mockedExecFile.mockImplementation(
            (_file: string, _args: string[], options: any, callback: any) => {
                // Verify the environment passed to execFile
                expect(options.env.GITHUB_TOKEN).toBe('ghp_testpat1234567890');
                process.nextTick(() => callback(null, 'Analysis result', ''));
                return { on: jest.fn() } as any;
            },
        );

        const result = await analyzeLogs('test prompt', makeConfig());

        expect(result.success).toBe(true);
        expect(mockedExecFile).toHaveBeenCalledWith(
            'npx',
            ['@github/copilot', '-sp', 'test prompt'],
            expect.objectContaining({
                env: expect.objectContaining({ GITHUB_TOKEN: 'ghp_testpat1234567890' }),
                timeout: 120 * 1000,
            }),
            expect.any(Function),
        );
    });

    it('should report duration even on failure', async () => {
        mockExecFileError({ code: 'ENOENT', message: 'not found' });

        const result = await analyzeLogs('test prompt', makeConfig());

        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.success).toBe(false);
    });
});
