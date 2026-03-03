import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Configuration for the Copilot Failure Analysis task.
 * All values are read from task inputs and ADO pipeline variables.
 */
export interface TaskConfig {
    /** Name of the GitHub service connection */
    connectedServiceName: string;
    /** GitHub PAT from the service connection (for Copilot CLI) */
    githubPat: string;
    /** Azure DevOps System.AccessToken */
    adoToken: string;
    /** Azure DevOps organization URL (System.TeamFoundationCollectionUri) */
    orgUrl: string;
    /** Azure DevOps project (System.TeamProject) */
    project: string;
    /** Current build ID (Build.BuildId) */
    buildId: number;
    /** Pipeline definition name (Build.DefinitionName) */
    pipelineName: string;
    /** Build number (Build.BuildNumber) */
    buildNumber: string;
    /** Source branch (Build.SourceBranch) */
    sourceBranch: string;
    /** Agent operating system (Agent.OS) */
    agentOS: string;
    /** Max log lines to collect per failed step */
    maxLogLines: number;
    /** Timeout in seconds for the Copilot CLI invocation */
    copilotTimeout: number;
}

/**
 * Reads all required configuration from task inputs and pipeline variables.
 * Masks the GitHub PAT so it never appears in logs.
 *
 * @returns Fully populated TaskConfig
 * @throws If required inputs or variables are missing
 */
export function readConfig(): TaskConfig {
    // --- Task inputs ---
    const connectedServiceName = tl.getInput('connectedServiceName', true)!;

    // Read PAT from the GitHub service connection's AccessToken field
    const githubPat =
        tl.getEndpointAuthorizationParameter(connectedServiceName, 'AccessToken', false) ?? '';

    // Mask the PAT immediately so it never leaks into logs
    if (githubPat) {
        tl.setSecret(githubPat);
    }

    // --- Azure DevOps pipeline variables ---
    const adoToken = tl.getVariable('System.AccessToken') ?? '';
    const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri') ?? '';
    const project = tl.getVariable('System.TeamProject') ?? '';
    const buildIdStr = tl.getVariable('Build.BuildId') ?? '0';
    const pipelineName = tl.getVariable('Build.DefinitionName') ?? '';
    const buildNumber = tl.getVariable('Build.BuildNumber') ?? '';
    const sourceBranch = tl.getVariable('Build.SourceBranch') ?? '';
    const agentOS = tl.getVariable('Agent.OS') ?? '';

    // --- Optional task inputs with defaults ---
    const maxLogLinesStr = tl.getInput('maxLogLines', false) ?? '150';
    const copilotTimeoutStr = tl.getInput('copilotNpxTimeout', false) ?? '120';

    const maxLogLines = parseInt(maxLogLinesStr, 10);
    const copilotTimeout = parseInt(copilotTimeoutStr, 10);

    return {
        connectedServiceName,
        githubPat,
        adoToken,
        orgUrl,
        project,
        buildId: parseInt(buildIdStr, 10),
        pipelineName,
        buildNumber,
        sourceBranch,
        agentOS,
        maxLogLines: isNaN(maxLogLines) ? 150 : maxLogLines,
        copilotTimeout: isNaN(copilotTimeout) ? 120 : copilotTimeout,
    };
}
