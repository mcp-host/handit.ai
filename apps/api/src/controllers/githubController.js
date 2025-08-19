import crypto from 'crypto';
import axios from 'axios';
import GitHubClient from '../services/githubClient.js';
import db from '../../models/index.js';
import { assessRepositoryAI, buildAssessmentFromFilesMarkdown } from '../services/repoAIAssessmentService.js';
const { GitHubIntegration, GitHubPullRequest, Company, User } = db;

/**
 * Initiate GitHub App installation flow
 */
export const initiateGitHubAuth = async (req, res) => {
  try {
    const { state: stateParam } = req.query;
    const companyId = stateParam;
    if (!companyId) {
      return res.status(400).json({ 
        error: 'companyId is required' 
      });
    }

    // Verify company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ 
        error: 'Company not found' 
      });
    }

    // Generate state parameter for security
    const state = crypto.randomBytes(32).toString('hex');
    
    const apiUrl = process.env.API_URL;
    const appId = process.env.GITHUB_APP_ID;
    
    if (!appId) {
      return res.status(500).json({
        error: 'GitHub App ID not configured'
      });
    }
    
    if (!apiUrl) {
      return res.status(500).json({
        error: 'API_URL not configured'
      });
    }
    
    // Redirect to GitHub App installation page with state parameter
    // The callback URL is configured in the GitHub App settings, not as a parameter
    const githubAppInstallUrl = new URL(`https://github.com/apps/handit-ai/installations/new`);
    githubAppInstallUrl.searchParams.set('state', `${state}:${companyId}`);

    console.log(`🔗 Redirecting to GitHub App installation: ${githubAppInstallUrl.toString()}`);
    res.redirect(githubAppInstallUrl.toString());
  } catch (error) {
    console.error('Error initiating GitHub App installation:', error);
    res.status(500).json({ 
      error: 'Failed to initiate GitHub App installation' 
    });
  }
};

// Public endpoint: list repositories for a GitHub App installation (via integrationId)
export const listInstallationRepositories = async (req, res) => {
  try {
    const { integrationId, installationId } = req.query;
    let integration = null;
    if (integrationId) {
      integration = await GitHubIntegration.findByPk(Number(integrationId));
    } else if (installationId) {
      integration = await GitHubIntegration.findOne({ where: { githubAppInstallationId: Number(installationId) } });
    }

    if (!integration) {
      return res.status(404).json({ success: false, error: 'GitHubIntegration not found' });
    }
    if (!integration.isConfigured()) {
      return res.status(400).json({ success: false, error: 'GitHub integration is not configured' });
    }

    const token = await integration.getInstallationAccessToken();
    if (!token) {
      return res.status(400).json({ success: false, error: 'Unable to obtain installation token' });
    }

    const github = new GitHubClient(token);
    const data = await github.listInstallationRepos();
    const repos = (data?.repositories || []).map(r => ({
      id: r.id,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner?.login,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
    return res.status(200).json({ success: true, repositories: repos, integrationRecordId: integration.id, installationId: integration.githubAppInstallationId });
  } catch (error) {
    console.error('Error listing installation repositories:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Public endpoint: redirect by email to assessment or GitHub App install
export const redirectToAssessmentByEmail = async (req, res) => {
  try {
    const installUrl = 'https://github.com/apps/handit-ai';

    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    let integration = await GitHubIntegration.findOne({ where: { email } });
    if (!integration) {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.redirect(302, installUrl);
      }
      const company = await Company.findOne({ where: { id: user.companyId } });
      if (!company) {
        return res.redirect(302, installUrl);
      }
      integration = await GitHubIntegration.findOne({ where: { companyId: company.id } });
      if (!integration) {
        return res.redirect(302, installUrl);
      }
    }

    const frontendBase = process.env.FRONTEND_BASE_URL || process.env.DASHBOARD_URL || 'https://dashboard.handit.ai';

    if (!integration || !integration.githubAppInstallationId) {
      return res.redirect(302, installUrl);
    }

    const url = new URL('/assessment', frontendBase);
    url.searchParams.set('installationId', String(integration.githubAppInstallationId));
    return res.redirect(302, url.toString());
  } catch (error) {
    console.error('Error redirecting to assessment by email:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Handle GitHub App installation callback
 */
export const handleGitHubCallback = async (req, res) => {
  try {
    const { installation_id, setup_action, state } = req.query;

    if (!installation_id || setup_action !== 'install') {
      return res.status(400).json({ 
        error: 'Invalid GitHub App installation parameters' 
      });
    }

    // Parse state to get company ID (if provided)
    let companyId = null;
    if (state) {
      const stateParts = state.split(':');
      if (stateParts.length === 2) {
        companyId = stateParts[1];
      } else {
        companyId = state;
      }
    }

    if (!companyId) {
      // If no company ID in state, redirect to dashboard to select company
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${dashboardUrl}/github-success?installation_id=${installation_id}&needs_company=true`);
    }

    // Verify company exists
    const company = await Company.findByPk(parseInt(companyId));
    if (!company) {
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${dashboardUrl}/github-success?error=company_not_found`);
    }

    // Get installation details using GitHub App authentication
    try {
      const jwt = GitHubIntegration.generateJWT();
      const response = await axios.get(`https://api.github.com/app/installations/${installation_id}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${jwt}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'handit-ai/1.0.0',
        },
      });

      const installationData = response.data;
      console.log('📋 GitHub App installation data:', {
        id: installationData.id,
        account: installationData.account.login,
        permissions: installationData.permissions,
        repositories: installationData.repository_selection
      });

      // Create or update GitHub integration with installation ID
      const [integration, created] = await GitHubIntegration.findOrCreate({
        where: { companyId: parseInt(companyId) },
        defaults: {
          companyId: parseInt(companyId),
          githubAppInstallationId: parseInt(installation_id),
          repositoryOwner: installationData.account.login,
          repositoryName: '', // Will be set later by user
          promptFilePath: '', // Will be set later by user
          branchName: 'main',
          active: false, // Inactive until properly configured
        },
      });

      if (!created) {
        // Update existing integration with installation ID
        await integration.update({
          githubAppInstallationId: parseInt(installation_id),
          repositoryOwner: installationData.account.login,
        });
      }

      console.log(`✅ GitHub App integration ${created ? 'created' : 'updated'} for company ${company.name}`);
      console.log(`   - Installation ID: ${installation_id}`);
      console.log(`   - Account: ${installationData.account.login}`);

      // Redirect to dashboard with success message
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      res.redirect(`${dashboardUrl}/github-success?success=true&integration_id=${integration.id}&installation_id=${installation_id}`);
    } catch (apiError) {
      console.error('Error getting GitHub App installation details:', apiError);
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      res.redirect(`${dashboardUrl}/github-success?error=installation_failed`);
    }
  } catch (error) {
    console.error('Error handling GitHub App installation callback:', error);
    const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/github-success?error=callback_failed`);
  }
};

/**
 * Handle GitHub webhooks
 */
export const handleGitHubWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyGitHubWebhook(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    const data = req.body;

    switch (event) {
      case 'pull_request':
        await handlePullRequestEvent(data);
        break;
      case 'installation':
        await handleInstallationEvent(data);
        break;
      default:
        console.log(`Unhandled GitHub webhook event: ${event}`);
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error handling GitHub webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
};

/**
 * Public endpoint: Assess a repository and create a documentation PR
 * Body: { integrationId: number, repoUrl: string, branch?: string }
 * - Uses the GitHub App installation linked to the integration to access the repo
 * - Runs heuristic assessment to detect prompts/providers
 * - Creates a branch and commits docs: docs/ai-assessment.md and docs/prompt-inventory.md
 * - Opens a PR to the default branch
 */
export const assessRepoAndCreatePR = async (req, res) => {
  try {
    const { integrationId, repoUrl, branch, preferLocalClone, hintFilePath, hintFunctionName, executionTree, useHintsFlow } = req.body || {};
    if (!integrationId || !repoUrl) {
      return res.status(400).json({ success: false, error: 'integrationId and repoUrl are required' });
    }
    console.log('🔍 Integration ID:', integrationId);

    const integration = await GitHubIntegration.findByPk(Number(integrationId));
    console.log('🔍 Integration:', integration);
    if (!integration) {
      return res.status(404).json({ success: false, error: 'GitHubIntegration not found' });
    }
    if (!integration.isConfigured()) {
      return res.status(400).json({ success: false, error: 'GitHub integration is not configured' });
    }

    const token = await integration.getInstallationAccessToken();
    if (!token) {
      return res.status(400).json({ success: false, error: 'Unable to obtain installation token' });
    }

    // Run assessment (supports hints-driven flow)
    const assessment = await assessRepositoryAI({
      repoUrl,
      companyId: integration.companyId,
      models: db,
      branch: branch || null,
      preferLocalClone: Boolean(preferLocalClone ?? true),
      hintFilePath: hintFilePath || null,
      hintFunctionName: hintFunctionName || null,
      executionTree: executionTree || null,
      useHintsFlow: useHintsFlow !== false,
    });
    if (!assessment.success) {
      return res.status(400).json({ success: false, error: assessment.error || 'Assessment failed' });
    }

    const github = new GitHubClient(token);
    const { owner, repo } = assessment.repo;

    // Determine default branch
    const repoInfo = await github.getRepository(owner, repo);
    const baseBranch = repoInfo.default_branch || 'main';

    // Create branch
    const headBranch = `ai-assessment-${Date.now()}`;
    const baseRef = await github.getRef(owner, repo, `heads/${baseBranch}`);
    await github.createRef(owner, repo, `refs/heads/${headBranch}`, baseRef.object.sha);

    // Prepare docs content
    const { providersDetected = [], frameworksDetected = [], candidates = [], selectedFiles = [] } = assessment;
    const files = [];
    if (Array.isArray(selectedFiles) && selectedFiles.length > 0) {
      // Use the hints-selected files with content captured from local scan
      for (const f of selectedFiles.slice(0, 2)) {
        if (f && f.path && typeof f.content === 'string') {
          files.push({ path: f.path, content: f.content });
        }
      }
    } else {
      // Fallback: Fetch exact file contents for top candidates to perform deeper prompt extraction
      const topForContent = candidates.slice(0, 15);
      for (const c of topForContent) {
        try {
          const file = await github.getContent(owner, repo, c.filePath, headBranch);
          if (file && file.content) {
            const content = Buffer.from(file.content, 'base64').toString('utf-8');
            files.push({ path: c.filePath, content });
          }
        } catch (err) {
          console.log(`⚠️  Could not read candidate file ${c.filePath}: ${err.message}`);
        }
      }
    }

    // If hints flow produced concrete prompts, build a prompt-only best practices assessment; else do file-based assessment
    const assessmentMd = (Array.isArray(assessment.promptsSelected) && assessment.promptsSelected.length > 0)
      ? await (async () => {
          const { generatePromptBestPracticesAssessmentMarkdown } = await import('../services/repoAIAssessmentService.js');
          return generatePromptBestPracticesAssessmentMarkdown({
            promptsSelected: assessment.promptsSelected,
          });
        })()
      : await buildAssessmentFromFilesMarkdown({
          repoOwner: owner,
          repoName: repo,
          providersDetected,
          frameworksDetected,
          files,
        });

    // Upsert files on the new branch
    await upsertFile(github, owner, repo, 'docs/ai-assessment.md', assessmentMd, headBranch);

    // Create PR
    const prTitle = `AI assessment by handit.ai for ${owner}/${repo}`;
    const isPromptOnly = Array.isArray(assessment.promptsSelected) && assessment.promptsSelected.length > 0;
    const strategies = Array.isArray(assessment?.meta?.strategiesUsed) ? assessment.meta.strategiesUsed : [];
    const usedHints = strategies.includes('hints-flow');
    const topFiles = (Array.isArray(candidates) ? candidates.slice(0, 3) : []).map(c => c.filePath).filter(Boolean);
    const topFilesLine = topFiles.length > 0 ? `\n- Top candidates: ${topFiles.join(', ')}` : '';
    const satLine = isPromptOnly ? `\n- Includes Prompt Best Practices Assessment for 1–2 key prompts (Original, Alignment, Gaps & risks, Next steps)` : '';
    const modeLine = usedHints ? '- Mode: Hints-driven analysis' : '- Mode: Heuristic repository scan';
    const prBody = [
      'This PR introduces AI assessment documentation generated by handit.ai.',
      '',
      '- Findings:',
      `  - Providers: ${providersDetected.join(', ') || 'none'}`,
      `  - Frameworks: ${frameworksDetected.join(', ') || 'none'}`,
      `  - Prompt candidates: ${candidates.length}` + topFilesLine,
      satLine,
      '',
      '- Artifacts:',
      '  - docs/ai-assessment.md (assessment + prompt inventory)',
      '',
      '- Details:',
      `  ${modeLine}`,
      '',
      '- Suggested next steps:',
      isPromptOnly
        ? '  - Review the Suggested prompt(s) in SAT Summary and consider adopting improvements.'
        : '  - Review docs/ai-assessment.md and shortlist prompts to refine; re-run hints-driven analysis if needed.',
    ].filter(Boolean).join('\n');

    const pr = await github.createPullRequest(owner, repo, prTitle, headBranch, baseBranch, prBody);

    return res.status(200).json({ success: true, prNumber: pr.number, prUrl: pr.html_url, branch: headBranch, summary: { providersDetected, frameworksDetected, candidates: candidates.length } });
  } catch (error) {
    console.error('Error in assessRepoAndCreatePR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

async function upsertFile(github, owner, repo, path, content, branch) {
  let sha = null;
  try {
    const existing = await github.getContent(owner, repo, path, branch);
    if (existing && existing.sha) sha = existing.sha;
  } catch {
    // File likely does not exist; proceed with create
  }
  const message = `docs(assessment): add/update ${path}`;
  await github.createOrUpdateFile(owner, repo, path, message, content, sha, branch);
}

// Deprecated local builders removed in favor of AI-generated assessment

/**
 * Get GitHub integrations for a company
 */
export const getGitHubIntegrations = async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Get user's company
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const integrations = await GitHubIntegration.findAll({
      where: { companyId: user.companyId },
      include: [
        {
          model: GitHubPullRequest,
          limit: 5,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({ integrations });
  } catch (error) {
    console.error('Error getting GitHub integrations:', error);
    res.status(500).json({ error: 'Failed to get GitHub integrations' });
  }
};

/**
 * Update GitHub integration configuration
 */
export const updateGitHubIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const { repositoryName, promptFilePath, branchName, active } = req.body;
    const { userId } = req.user;

    // Get user's company
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const integration = await GitHubIntegration.findOne({
      where: { 
        id: parseInt(id),
        companyId: user.companyId,
      },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Update integration
    await integration.update({
      repositoryName: repositoryName || integration.repositoryName,
      promptFilePath: promptFilePath || integration.promptFilePath,
      branchName: branchName || integration.branchName,
      active: active !== undefined ? active : integration.active,
    });

    res.status(200).json({ 
      message: 'Integration updated successfully',
      integration,
    });
  } catch (error) {
    console.error('Error updating GitHub integration:', error);
    res.status(500).json({ error: 'Failed to update GitHub integration' });
  }
};

/**
 * Test GitHub integration
 */
export const testGitHubIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    // Get user's company
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const integration = await GitHubIntegration.findOne({
      where: { 
        id: parseInt(id),
        companyId: user.companyId,
      },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (!integration.isConfigured()) {
      return res.status(400).json({ 
        error: 'Integration is not properly configured' 
      });
    }

    // Test GitHub App installation access
    const installationToken = await integration.getInstallationAccessToken();
    if (!installationToken) {
      return res.status(400).json({
        success: false,
        error: 'Failed to get GitHub App installation access token'
      });
    }

    const githubClient = new GitHubClient(installationToken);

    try {
      // Try to get repository info
      const repo = await githubClient.getRepository(
        integration.repositoryOwner,
        integration.repositoryName
      );

      // Try to get the prompt file if configured
      let promptFile = null;
      if (integration.promptFilePath) {
        try {
          const file = await githubClient.getContent(
            integration.repositoryOwner,
            integration.repositoryName,
            integration.promptFilePath,
            integration.branchName
          );
          promptFile = {
            path: file.path,
            size: file.size,
            lastModified: file.sha,
          };
        } catch (fileError) {
          console.log(`⚠️  Could not access prompt file: ${fileError.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: 'GitHub App integration test successful',
        installation: {
          id: integration.githubAppInstallationId,
          owner: integration.repositoryOwner,
        },
        repository: {
          name: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch,
        },
        promptFile,
      });
    } catch (apiError) {
      res.status(400).json({
        success: false,
        error: `GitHub API error: ${apiError.message}`,
      });
    }
  } catch (error) {
    console.error('Error testing GitHub integration:', error);
    res.status(500).json({ error: 'Failed to test GitHub integration' });
  }
};

/**
 * Delete GitHub integration
 */
export const deleteGitHubIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    // Get user's company
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const integration = await GitHubIntegration.findOne({
      where: { 
        id: parseInt(id),
        companyId: user.companyId,
      },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await integration.destroy();

    res.status(200).json({ 
      message: 'Integration deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting GitHub integration:', error);
    res.status(500).json({ error: 'Failed to delete GitHub integration' });
  }
};

// Helper functions

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubWebhook(payload, signature) {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle pull request webhook events
 */
async function handlePullRequestEvent(data) {
  const { action, pull_request, repository } = data;

  if (!['closed', 'merged'].includes(action)) {
    return;
  }

  // Find the PR in our database
  const pr = await GitHubPullRequest.findOne({
    where: {
      prNumber: pull_request.number,
    },
    include: [
      {
        model: GitHubIntegration,
        where: {
          repositoryOwner: repository.owner.login,
          repositoryName: repository.name,
        },
      },
    ],
  });

  if (pr) {
    await pr.update({
      status: pull_request.merged ? 'merged' : 'closed',
    });
  }
}

/**
 * Handle installation webhook events
 */
async function handleInstallationEvent(data) {
  const { action, installation } = data;
  
  console.log(`📡 GitHub App installation webhook - ${action}:`, {
    installationId: installation.id,
    account: installation.account.login,
    repositorySelection: installation.repository_selection
  });
  
  if (action === 'created') {
    // New installation - this will be handled by the callback URL
    console.log(`✅ New GitHub App installation created: ${installation.id}`);
  } else if (action === 'deleted') {
    // Installation deleted - deactivate integrations
    console.log(`❌ GitHub App installation deleted: ${installation.id}`);
    
    const integrations = await GitHubIntegration.findAll({
      where: {
        githubAppInstallationId: installation.id,
        active: true
      }
    });
    
    for (const integration of integrations) {
      await integration.update({
        active: false,
        githubAppInstallationId: null // Clear the installation ID
      });
      console.log(`   - Deactivated integration ${integration.id} for company ${integration.companyId}`);
    }
  } else if (action === 'suspend') {
    // Installation suspended - deactivate integrations
    console.log(`⏸️  GitHub App installation suspended: ${installation.id}`);
    
    await GitHubIntegration.update(
      { active: false },
      {
        where: {
          githubAppInstallationId: installation.id,
          active: true
        }
      }
    );
  } else if (action === 'unsuspend') {
    // Installation unsuspended - reactivate integrations
    console.log(`▶️  GitHub App installation unsuspended: ${installation.id}`);
    
    await GitHubIntegration.update(
      { active: true },
      {
        where: {
          githubAppInstallationId: installation.id,
          active: false
        }
      }
    );
  }
} 