import * as https from 'https';
import { EventEmitter } from 'events';

// --- Mocks ---
jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
}));

jest.mock('https');

// We need to import AFTER mocks are set up
import * as tl from 'azure-pipelines-task-lib/task';
import { getFailedStepLogs } from '../src/copilot-failure-analysis-task/log-collector';
import type { TaskConfig } from '../src/copilot-failure-analysis-task/config';
import timelineFixture from './fixtures/timeline-response.json';
import * as fs from 'fs';
import * as path from 'path';

// --- Helpers ---

/** Builds a minimal TaskConfig for testing */
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

const logFixture = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'log-response.txt'),
    'utf8',
);

/**
 * Helper to set up `https.request` mock for sequential calls.
 * Each entry in `responses` produces one mock response.
 */
function setupHttpsMock(
    responses: Array<{
        statusCode: number;
        body: string;
        error?: Error;
    }>,
) {
    const mockedRequest = https.request as jest.MockedFunction<typeof https.request>;
    let callIndex = 0;

    mockedRequest.mockImplementation((_options: any, callback?: any) => {
        const response = responses[callIndex++];
        const req = new EventEmitter() as any;
        req.end = jest.fn();
        req.destroy = jest.fn();
        req.setTimeout = jest.fn((_ms: number, cb: () => void) => {
            // don't fire timeout by default
        });

        if (response.error) {
            // Simulate request-level error
            process.nextTick(() => req.emit('error', response.error));
            return req;
        }

        // Simulate a successful HTTP response
        const res = new EventEmitter() as any;
        res.statusCode = response.statusCode;

        process.nextTick(() => {
            if (callback) callback(res);
            res.emit('data', Buffer.from(response.body, 'utf8'));
            res.emit('end');
        });

        return req;
    });
}

// --- Tests ---

describe('log-collector — getFailedStepLogs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should collect logs from failed steps (2 failed tasks)', async () => {
        // Create a timeline with 2 failed tasks
        const timeline = {
            records: [
                {
                    id: 'r1',
                    type: 'Task',
                    name: 'npm install',
                    result: 'failed',
                    log: { id: 5 },
                    issues: [{ type: 'error', message: 'exit code 1' }],
                },
                {
                    id: 'r2',
                    type: 'Task',
                    name: 'Run tests',
                    result: 'failed',
                    log: { id: 6 },
                    issues: [],
                },
                {
                    id: 'r3',
                    type: 'Task',
                    name: 'Build',
                    result: 'succeeded',
                    log: { id: 7 },
                    issues: [],
                },
            ],
        };

        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify(timeline) },
            { statusCode: 200, body: 'Error: npm ERR! code ERESOLVE\nBuild failed.' },
            { statusCode: 200, body: 'FAIL src/test.ts\nTest suite failed to run' },
        ]);

        const config = makeConfig();
        const result = await getFailedStepLogs(config);

        expect(result).toHaveLength(2);
        expect(result[0].stepName).toBe('npm install');
        expect(result[0].logContent).toContain('npm ERR!');
        expect(result[0].issues).toEqual(['exit code 1']);
        expect(result[1].stepName).toBe('Run tests');
        expect(result[1].logContent).toContain('FAIL');
    });

    it('should return empty array when no failed steps', async () => {
        const timeline = {
            records: [
                {
                    id: 'r1',
                    type: 'Task',
                    name: 'Build',
                    result: 'succeeded',
                    log: { id: 1 },
                    issues: [],
                },
            ],
        };

        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify(timeline) },
        ]);

        const result = await getFailedStepLogs(makeConfig());
        expect(result).toHaveLength(0);
    });

    it('should return empty array and log warning on API error', async () => {
        setupHttpsMock([
            { statusCode: 401, body: 'Unauthorized' },
        ]);

        const result = await getFailedStepLogs(makeConfig());

        expect(result).toHaveLength(0);
        expect(tl.warning).toHaveBeenCalledWith(
            expect.stringContaining('Failed to collect pipeline logs'),
        );
    });

    it('should truncate logs to maxLogLines', async () => {
        const timeline = {
            records: [
                {
                    id: 'r1',
                    type: 'Task',
                    name: 'Long step',
                    result: 'failed',
                    log: { id: 10 },
                    issues: [],
                },
            ],
        };

        // Generate a log with 300 lines
        const longLog = Array.from({ length: 300 }, (_, i) => `Line ${i + 1}: log output`).join('\n');

        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify(timeline) },
            { statusCode: 200, body: longLog },
        ]);

        const result = await getFailedStepLogs(makeConfig({ maxLogLines: 10 }));

        expect(result).toHaveLength(1);
        const lines = result[0].logContent.split('\n');
        expect(lines.length).toBe(10);
        // Should keep the LAST 10 lines
        expect(lines[0]).toContain('Line 291');
        expect(lines[9]).toContain('Line 300');
    });

    it('should handle missing log ID gracefully', async () => {
        const timeline = {
            records: [
                {
                    id: 'r1',
                    type: 'Task',
                    name: 'No-log step',
                    result: 'failed',
                    // log is missing entirely
                    issues: [{ type: 'error', message: 'Something broke' }],
                },
            ],
        };

        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify(timeline) },
        ]);

        const result = await getFailedStepLogs(makeConfig());

        expect(result).toHaveLength(1);
        expect(result[0].stepName).toBe('No-log step');
        expect(result[0].logContent).toBe('[No log available for this step]');
        expect(result[0].issues).toEqual(['Something broke']);
    });

    it('should filter correctly with mixed results (failed + succeeded + skipped)', async () => {
        // Uses the fixture file which has 1 failed Task, 1 succeeded Task, 1 failed Job
        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify(timelineFixture) },
            { statusCode: 200, body: logFixture },
        ]);

        const result = await getFailedStepLogs(makeConfig());

        // Only the failed *Task* should be collected (not the failed Job)
        expect(result).toHaveLength(1);
        expect(result[0].stepName).toBe('Run unit tests');
        expect(result[0].issues).toContain('Process completed with exit code 1.');
        expect(result[0].issues).toContain('Jest test suite failed: 3 tests failed out of 42.');
    });

    it('should return empty array when timeline has no records', async () => {
        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify({ records: null }) },
        ]);

        const result = await getFailedStepLogs(makeConfig());
        expect(result).toHaveLength(0);
    });

    it('should handle log fetch error for individual step gracefully', async () => {
        const timeline = {
            records: [
                {
                    id: 'r1',
                    type: 'Task',
                    name: 'Broken log step',
                    result: 'failed',
                    log: { id: 99 },
                    issues: [],
                },
            ],
        };

        setupHttpsMock([
            { statusCode: 200, body: JSON.stringify(timeline) },
            { statusCode: 500, body: 'Internal Server Error' },
        ]);

        const result = await getFailedStepLogs(makeConfig());

        expect(result).toHaveLength(1);
        expect(result[0].stepName).toBe('Broken log step');
        expect(result[0].logContent).toContain('[Log unavailable');
        expect(tl.warning).toHaveBeenCalledWith(
            expect.stringContaining('Failed to fetch log for step'),
        );
    });
});
