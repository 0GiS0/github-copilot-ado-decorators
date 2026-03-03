import * as fs from 'fs';

// --- Mocks ---
jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
    getVariable: jest.fn(),
}));

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        writeFileSync: jest.fn(),
    };
});

import * as tl from 'azure-pipelines-task-lib/task';
import { formatAndDisplay } from '../src/copilot-failure-analysis-task/output-formatter';
import type { AnalysisResult } from '../src/copilot-failure-analysis-task/ai-analyzer';
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

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
    return {
        analysisText: '## Root Cause\nDependency conflict.\n## Suggested Fix\nDowngrade TypeScript.',
        success: true,
        duration: 5432,
        ...overrides,
    };
}

// --- Tests ---

describe('output-formatter — formatAndDisplay', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        (tl.getVariable as jest.Mock).mockReturnValue('/tmp/agent-temp');
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('should write Markdown with analysis content for successful analysis', async () => {
        const analysis = makeAnalysis();
        const config = makeConfig();

        await formatAndDisplay(analysis, config);

        // Verify writeFileSync was called with Markdown content
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string;

        expect(writtenContent).toContain('# 🤖 Copilot Failure Analysis');
        expect(writtenContent).toContain('CI Pipeline');
        expect(writtenContent).toContain('20260303.1');
        expect(writtenContent).toContain('## Analysis');
        expect(writtenContent).toContain('Root Cause');
        expect(writtenContent).toContain('Dependency conflict');
        expect(writtenContent).toContain('Disclaimer');
    });

    it('should write error report in Markdown for failed analysis', async () => {
        const analysis = makeAnalysis({
            success: false,
            analysisText: '',
            errorMessage: 'Copilot CLI timed out after 120 seconds',
            duration: 120000,
        });

        await formatAndDisplay(analysis, makeConfig());

        const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string;

        expect(writtenContent).toContain('⚠️ Analysis Error');
        expect(writtenContent).toContain('could not be completed');
        expect(writtenContent).toContain('Copilot CLI timed out after 120 seconds');
        expect(writtenContent).toContain('120000 ms');
    });

    it('should show "No analysis available" for empty analysis', async () => {
        const analysis = makeAnalysis({
            success: true,
            analysisText: '',
            duration: 3000,
        });

        await formatAndDisplay(analysis, makeConfig());

        const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string;

        expect(writtenContent).toContain('No analysis available');
        expect(writtenContent).toContain('empty response');
    });

    it('should emit ##vso[task.uploadsummary] command', async () => {
        await formatAndDisplay(makeAnalysis(), makeConfig());

        const vsoCall = consoleLogSpy.mock.calls.find(
            (call: any[]) => typeof call[0] === 'string' && call[0].includes('##vso[task.uploadsummary]'),
        );

        expect(vsoCall).toBeDefined();
        expect(vsoCall![0]).toContain('copilot-analysis.md');
    });

    it('should log warning when file write fails', async () => {
        (fs.writeFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        await formatAndDisplay(makeAnalysis(), makeConfig());

        expect(tl.warning).toHaveBeenCalledWith(
            expect.stringContaining('Failed to write analysis report'),
        );
        expect(tl.warning).toHaveBeenCalledWith(
            expect.stringContaining('EACCES'),
        );
    });

    it('should print analysis to stdout for step log visibility', async () => {
        const analysis = makeAnalysis({
            analysisText: 'Root cause: dependency conflict in npm packages.',
        });

        await formatAndDisplay(analysis, makeConfig());

        const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
        expect(allOutput).toContain('COPILOT FAILURE ANALYSIS');
        expect(allOutput).toContain('Root cause: dependency conflict');
    });

    it('should print error message to stdout when analysis failed', async () => {
        const analysis = makeAnalysis({
            success: false,
            analysisText: '',
            errorMessage: 'npx command not found',
        });

        await formatAndDisplay(analysis, makeConfig());

        const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join('\n');
        expect(allOutput).toContain('Analysis failed');
        expect(allOutput).toContain('npx command not found');
    });

    it('should include pipeline info in the Markdown table', async () => {
        const config = makeConfig({
            pipelineName: 'My Custom Pipeline',
            buildNumber: 'build-42',
            sourceBranch: 'refs/heads/feature/cool',
            agentOS: 'Windows_NT',
        });

        await formatAndDisplay(makeAnalysis(), config);

        const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string;

        expect(writtenContent).toContain('My Custom Pipeline');
        expect(writtenContent).toContain('build-42');
        expect(writtenContent).toContain('refs/heads/feature/cool');
        expect(writtenContent).toContain('Windows_NT');
    });
});
