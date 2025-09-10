import crypto from 'crypto';
import axios from 'axios';
import GitHubClient from '../../services/githubClient.js';
import db from '../../../models/index.js';
import { assessRepositoryAI, buildAssessmentFromFilesMarkdown, generatePromptBestPracticesAssessmentMarkdown } from './repoAIAssessmentService.js';
import { generateAIResponse } from '../../services/aiService.js';
import { z } from 'zod';
const { GitHubIntegration, GitHubPullRequest, Company, User } = db;

/**
 * Schema for handit integration code results
 */
const HanditIntegrationSchema = z.object({
  modifiedCode: z.string().describe('The complete modified file content'),
  explanation: z.string().describe('Explanation of what was added'),
  changes: z.array(z.string()).describe('List of specific changes made')
});

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

// Public endpoint: get repository branches
export const getRepositoryBranches = async (req, res) => {
  try {
    const { integrationId, installationId, repositoryFullName } = req.query;
    
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

    if (!repositoryFullName) {
      return res.status(400).json({ success: false, error: 'repositoryFullName is required' });
    }

    const [owner, repo] = repositoryFullName.split('/');
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Invalid repositoryFullName format. Expected: owner/repo' });
    }

    const github = new GitHubClient(token);
    
    // Get repository info to determine default branch
    const repoInfo = await github.getRepository(owner, repo);
    const defaultBranch = repoInfo.default_branch || 'main';
    console.log(`🔍 Repository default branch: ${defaultBranch}`);
    
    // Get all branches
    const branches = await github.getBranches(owner, repo);
    console.log(`🔍 Found ${branches.length} branches:`, branches.map(b => b.name));
    
    // Format branches with default branch indicator
    const formattedBranches = branches.map(branch => ({
      name: branch.name,
      isDefault: branch.name === defaultBranch,
      defaultBranch: branch.name === defaultBranch,
      sha: branch.commit.sha,
      protected: branch.protected || false
    }));
    
    console.log(`🔍 Formatted branches:`, formattedBranches.map(b => ({ name: b.name, isDefault: b.isDefault })));

    // Check if default branch was found in the branches list
    const defaultBranchFound = formattedBranches.some(branch => branch.isDefault);
    if (!defaultBranchFound) {
      console.log(`⚠️ Default branch '${defaultBranch}' not found in branches list. Adding it manually.`);
      
      // Try to get the default branch reference manually
      try {
        const defaultBranchRef = await github.getRef(owner, repo, `heads/${defaultBranch}`);
        formattedBranches.unshift({
          name: defaultBranch,
          isDefault: true,
          defaultBranch: true,
          sha: defaultBranchRef.object.sha,
          protected: false
        });
        console.log(`✅ Added default branch '${defaultBranch}' manually`);
      } catch (refError) {
        console.log(`❌ Could not get default branch reference: ${refError.message}`);
      }
    }

    // Sort branches with default branch first
    formattedBranches.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({ 
      success: true, 
      branches: formattedBranches,
      defaultBranch,
      repository: { owner, name: repo, fullName: repositoryFullName }
    });
  } catch (error) {
    console.error('Error getting repository branches:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Public endpoint: get repository files and directories for file selection
export const getRepositoryFiles = async (req, res) => {
  try {
    const { integrationId, installationId, repositoryFullName, path = '', maxDepth = 5, branch } = req.query;
    
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

    if (!repositoryFullName) {
      return res.status(400).json({ success: false, error: 'repositoryFullName is required' });
    }

    const [owner, repo] = repositoryFullName.split('/');
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Invalid repositoryFullName format. Expected: owner/repo' });
    }

    const github = new GitHubClient(token);
    
    // Get repository files using fast Tree API
    console.log(`🔍 Fetching files for ${repositoryFullName} using Tree API${branch ? ` (branch: ${branch})` : ' (default branch)'}`);
    const files = await getRepositoryFilesTree(github, owner, repo, Number(maxDepth), branch);
    console.log(`🔍 Raw files found: ${files.length}`);
    
    // Filter and organize files for better UX
    const organizedFiles = organizeRepositoryFiles(files);
    console.log(`🔍 Organized files:`, {
      sourceFiles: organizedFiles.sourceFiles?.length || 0,
      configFiles: organizedFiles.configFiles?.length || 0,
      directories: organizedFiles.directories?.length || 0,
      otherFiles: organizedFiles.otherFiles?.length || 0
    });
    
    return res.status(200).json({ 
      success: true, 
      files: organizedFiles,
      repository: { owner, name: repo, fullName: repositoryFullName },
      path: path || '/',
      branch: branch || 'default',
      debug: {
        totalFiles: files.length,
        maxDepth: Number(maxDepth),
        branch: branch || 'default',
        breakdown: {
          sourceFiles: organizedFiles.sourceFiles?.length || 0,
          configFiles: organizedFiles.configFiles?.length || 0,
          directories: organizedFiles.directories?.length || 0,
          otherFiles: organizedFiles.otherFiles?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting repository files:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Public endpoint: redirect by email to assessment or GitHub App install
export const redirectToAssessmentByEmail = async (req, res) => {
  try {

    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    const installUrl = 'https://github.com/apps/handit-ai/installations/new?state=' + email;

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
    let slug = null;
    if (state) {
      const stateParts = state.split(':');
      if (stateParts.length === 2) {
        slug = stateParts[1];
      } else {
        slug = state;
      }
    }

    if (!slug) {
      // If no company ID in state, redirect to dashboard to select company
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${dashboardUrl}/github-success?installation_id=${installation_id}&needs_company=true`);
    }

    // Verify company exists
    let companyId = null;
    if (slug.includes('@')) {
      const user = await User.findOne({ where: { email: slug } });
      if (user) {
        companyId = user.companyId;
      } else {
        const company = await Company.create({
          name: slug,
          nationalId: slug,
        });
        await User.create({
          email: slug,
          role: 'user',
          password: crypto.randomBytes(16).toString('hex'),
          firstName: 'Handit',
          lastName: 'User',
          companyId: company.id,
          membershipId: 1,
        });

        companyId = company.id;
      }
    } else {
      companyId = slug;
    }
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
 * Public endpoint: Assess repository and setup handit integration with hints
 * Body: { integrationId: number, repoUrl: string, agentFile: string, agentFunction: string, agentName: string, branch?: string }
 * - Uses the GitHub App installation to access the repo
 * - Runs hints-based assessment using the specified file and function
 * - Sets up handit monitoring decorators on the agent function
 * - Creates a PR with both assessment and handit integration setup
 */
export const assessRepoAndSetupHandit = async (req, res) => {
  try {
    const { integrationId, repoUrl, agentFile, agentFunction, agentName, branch } = req.body || {};
    const { userId } = req.user; // Get user from JWT token
    
    if (!integrationId || !repoUrl || !agentFile || !agentFunction) {
      return res.status(400).json({ 
        success: false, 
        error: 'integrationId, repoUrl, agentFile, and agentFunction are required' 
      });
    }
    console.log('🤖 Setting up handit integration:', { integrationId, repoUrl, agentFile, agentFunction, agentName, branch, userId });

    // Get user's company
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const integration = await GitHubIntegration.findOne({
      where: { 
        id: Number(integrationId),
        companyId: user.companyId,
      },
    });
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
    
    // Parse repository info from URL
    const repoUrlParts = repoUrl.replace('https://github.com/', '').split('/');
    const owner = repoUrlParts[0];
    const repo = repoUrlParts[1];

    console.log('🚀 Starting parallel GitHub operations and file fetching');
    
    // Parallelize initial GitHub operations
    const [repoInfo, originalFile] = await Promise.all([
      github.getRepository(owner, repo),
      github.getContent(owner, repo, agentFile, branch || 'main').catch(async () => {
        // Fallback to default branch if specified branch fails
        const repoData = await github.getRepository(owner, repo);
        return github.getContent(owner, repo, agentFile, repoData.default_branch || 'main');
      })
    ]);

    // Use provided branch as target, fallback to default branch
    const targetBranch = branch || repoInfo.default_branch || 'main';
    const baseBranch = targetBranch;
    console.log(`🎯 Using branch '${targetBranch}' as target for PR (${branch ? 'user-specified' : 'default'})`);
    const originalContent = Buffer.from(originalFile.content, 'base64').toString('utf-8');

    // Create branch early in parallel with heavy operations
    const headBranch = `handit-autonomous-engineer-setup-${Date.now()}`;
    
    console.log('🚀 Starting mega-parallel processing: assessment + code modification + branch creation + dependencies');
    
    // Run everything possible in parallel
    const [assessment, modifiedContent, dependencyInfo] = await Promise.all([
      // Assessment process (includes clone and analysis)
      assessRepositoryAI({
        repoUrl,
        companyId: integration.companyId,
        models: db,
        branch: branch || null,
        preferLocalClone: true,
        hintFilePath: agentFile,
        hintFunctionName: agentFunction,
        executionTree: null,
        useHintsFlow: true, // Enable hints-based flow
      }),
      
      // Code modification process
      addHanditIntegrationToFile(originalContent, agentFile, agentFunction, agentName),
      
      // Find and update dependency files
      findAndUpdateDependencyFiles(github, owner, repo, agentFile, targetBranch)
    ]);

    // Create branch after parallel processing completes
    console.log('🌿 Creating GitHub branch');
    const baseRef = await github.getRef(owner, repo, `heads/${baseBranch}`);
    await github.createRef(owner, repo, `refs/heads/${headBranch}`, baseRef.object.sha);
    
    console.log('🚀 Parallel processing completed');
    
    if (!assessment.success) {
      return res.status(400).json({ success: false, error: assessment.error || 'Assessment failed' });
    }

    // Generate assessment markdown
    console.log('📝 Generating assessment markdown');
    const hasPrompts = Array.isArray(assessment.promptsSelected) && assessment.promptsSelected.length > 0;
    const assessmentMd = hasPrompts
      ? await generatePromptBestPracticesAssessmentMarkdown({
          promptsSelected: assessment.promptsSelected,
        })
      : await buildAssessmentFromFilesMarkdown({
          repoOwner: owner,
          repoName: repo,
          providersDetected: assessment.providersDetected || [],
          frameworksDetected: assessment.frameworksDetected || [],
          files: assessment.selectedFiles || [],
        });

    console.log('🚀 Committing code changes, assessment, and dependencies in parallel');
    
    // Prepare commit message with dependency info
    let commitMessage = `feat: add handit.ai autonomous engineer monitoring to ${agentFunction}

- Added handit.ai monitoring to ${agentFile}:${agentFunction}
- Agent name: ${agentName || agentFunction}
- Enables automatic optimization and issue detection
- Includes AI assessment of repository`;

    if (dependencyInfo.updated) {
      const depTypes = dependencyInfo.files.map(f => f.type).join(', ');
      commitMessage += `\n- Updated dependencies (${depTypes})`;
    }
    
    commitMessage += '\n- Generated by handit.ai Autonomous Engineer Setup';

    // Commit files sequentially to avoid SHA conflicts, but still fast
    console.log('📝 Committing modified agent file...');
    await github.createOrUpdateFile(
      owner, 
      repo, 
      agentFile, 
      commitMessage, 
      modifiedContent, 
      originalFile.sha, 
      headBranch
    );

    console.log('📝 Committing assessment file...');
    // await upsertFile(github, owner, repo, 'docs/ai-assessment.md', assessmentMd, headBranch);

    // Commit dependency files if any were updated
    if (dependencyInfo.updated) {
      console.log(`📦 Committing ${dependencyInfo.files.length} dependency file(s)...`);
      for (const depFile of dependencyInfo.files) {
        await github.createOrUpdateFile(
          owner,
          repo,
          depFile.path,
          `deps: add handit-ai package to ${depFile.path}

- Added handit-ai dependency for autonomous engineer monitoring
- Required for ${agentFile}:${agentFunction} monitoring`,
          depFile.newContent,
          depFile.sha,
          headBranch
        );
        console.log(`✅ Updated ${depFile.path}`);
      }
    }
    
    console.log('🚀 All commits completed');

    // Create PR with handit setup
    const prTitle = `🤖 Setup handit.ai Autonomous Engineer for ${agentName || agentFunction}`;
    const prBody = `## 🤖 Autonomous Engineer Setup Complete!

This PR sets up handit.ai monitoring on your \`${agentFunction}\` function in \`${agentFile}\`.

### What was added:
- **Monitoring decorators** on \`${agentFunction}\` function
- **Agent name**: ${agentName || agentFunction}
- **Automatic issue detection** and optimization
- **AI assessment** of your codebase${dependencyInfo.updated ? `\n- **Dependencies**: Added handit-ai package to ${dependencyInfo.files.map(f => f.path).join(', ')}` : ''}

### What happens next:
1. **Get your API key** from [dashboard.handit.ai/settings/integrations](https://dashboard.handit.ai/settings/integrations)
2. **Set the environment variable** \`HANDIT_API_KEY\` with your API key
3. **Merge this PR** to activate monitoring
4. **Run your agent** - traces will appear in [dashboard.handit.ai](https://dashboard.handit.ai)
5. **Get automatic optimizations** - your engineer will create PRs when issues are detected

### 🔑 API Key Setup:
Your handit.ai API key is required for monitoring to work. You can find it at:
**[https://dashboard.handit.ai/settings/integrations](https://dashboard.handit.ai/settings/integrations)**

Set it as an environment variable:
\`\`\`bash
export HANDIT_API_KEY=your_api_key_here
\`\`\`

### Assessment Results:
${assessmentMd}

---
*This PR was automatically generated by handit.ai Autonomous Engineer Setup*`;

    const pr = await github.createPullRequest(owner, repo, prTitle, headBranch, targetBranch, prBody);

    // Save PR record
    await GitHubPullRequest.create({
      companyId: integration.companyId,
      repoUrl: repoUrl,
      githubIntegrationId: integration.id,
      type: 'handit_setup',
      prNumber: pr.number,
      prUrl: pr.html_url,
      branch: headBranch,
    });

    return res.status(200).json({ 
      success: true, 
      prNumber: pr.number, 
      prUrl: pr.html_url, 
      branch: headBranch,
      agentFile,
      agentFunction,
      agentName: agentName || agentFunction,
      summary: { 
        providersDetected: assessment.providersDetected || [], 
        frameworksDetected: assessment.frameworksDetected || [], 
        promptsFound: assessment.promptsSelected?.length || 0
      }
    });
  } catch (error) {
    console.error('Error in assessRepoAndSetupHandit:', error);
    return res.status(500).json({ success: false, error: error.message });
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

    // Use provided branch as target, fallback to default branch
    const repoInfo = await github.getRepository(owner, repo);
    const targetBranch = branch || repoInfo.default_branch || 'main';
    console.log(`🎯 Using branch '${targetBranch}' as target for assessment PR (${branch ? 'user-specified' : 'default'})`);

    // Create branch
    const headBranch = `ai-assessment-${Date.now()}`;
    const baseRef = await github.getRef(owner, repo, `heads/${targetBranch}`);
    await github.createRef(owner, repo, `refs/heads/${headBranch}`, baseRef.object.sha);

    // Prepare docs content
    const { providersDetected = [], frameworksDetected = [], candidates = [], selectedFiles = [] } = assessment;
    const files = [];
    if (Array.isArray(selectedFiles) && selectedFiles.length > 0) {
      // Use the hints-selected files with content captured from local scan
      for (const f of selectedFiles.slice(0, 10)) {
        if (f && f.path && typeof f.content === 'string') {
          files.push({ path: f.path, content: f.content });
        }
      }
    } else {
      // Fallback: Fetch exact file contents for top candidates to perform deeper prompt extraction
      const topForContent = candidates.slice(0, 15);
      for (const c of topForContent) {
        try {
          if (c.content) {
            files.push({ path: c.filePath, content: c.content });
          } else {  
          const file = await github.getContent(owner, repo, c.filePath, headBranch);
          if (file && file.content) {
              const content = Buffer.from(file.content, 'base64').toString('utf-8');
              files.push({ path: c.filePath, content });
            }
          }
        } catch (err) {
          console.log(`⚠️  Could not read candidate file ${c.filePath}: ${err.message}`);
        }
      }
    }

    // Generate assessment markdown - use structured format for prompts, file-based for general
    const hasPrompts = Array.isArray(assessment.promptsSelected) && assessment.promptsSelected.length > 0;
    
    const assessmentMd = hasPrompts
      ? await generatePromptBestPracticesAssessmentMarkdown({
          promptsSelected: assessment.promptsSelected,
        })
      : await buildAssessmentFromFilesMarkdown({
          repoOwner: owner,
          repoName: repo,
          providersDetected,
          frameworksDetected,
          files,
        });

    // Create the assessment file to ensure there are commits for the PR
    await upsertFile(github, owner, repo, 'docs/ai-assessment.md', assessmentMd, headBranch);

    // Create PR with assessment as description
    const prTitle = `AI assessment by handit.ai for ${owner}/${repo}`;
    
    // Use the assessment markdown directly as the PR description
    const prBody = assessmentMd;

    const pr = await github.createPullRequest(owner, repo, prTitle, headBranch, targetBranch, prBody);

    await GitHubPullRequest.create({
      companyId: integration.companyId,
      repoUrl: repoUrl,
      githubIntegrationId: integration.id,
      type: 'repo_assessment',
      prNumber: pr.number,
      prUrl: pr.html_url,
      branch: headBranch,
    });
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

/**
 * Generate handit integration code based on file type
 */
function generateHanditIntegrationCode(filePath, functionName, agentName) {
  const fileExtension = filePath.split('.').pop().toLowerCase();
  const agentNameForCode = agentName || functionName;
  
  if (['py'].includes(fileExtension)) {
    return {
      imports: `# ADD THESE IMPORTS at the top of your file
from handit_ai import configure, tracing
import os

# ADD THIS CONFIGURATION at the top of your file
configure(HANDIT_API_KEY=os.getenv("HANDIT_API_KEY"))`,
      decorator: `@tracing(agent="${agentNameForCode}")`
    };
  } else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
    return {
      imports: `// ADD THESE IMPORTS at the top of your file
import { configure, startTracing, endTracing } from '@handit.ai/handit-ai';

// ADD THIS CONFIGURATION at the top of your file
configure({ HANDIT_API_KEY: process.env.HANDIT_API_KEY });`,
      startTracing: `  startTracing({ agent: "${agentNameForCode}" });  // ADD THIS LINE`,
      endTracing: `    endTracing();  // ADD THIS LINE`
    };
  }
  
  return null;
}

/**
 * Add handit integration to file content using AI-powered code modification
 */
async function addHanditIntegrationToFile(content, filePath, functionName, agentName) {
  const fileExtension = filePath.split('.').pop().toLowerCase();
  
  if (!['py', 'js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
    throw new Error(`Unsupported file type: ${fileExtension}`);
  }

  const isPython = fileExtension === 'py';
  const agentNameForCode = agentName || functionName;

  // Use AI to properly integrate handit monitoring
  const messages = [
    {
      role: 'system',
      content: `You are an expert code editor. Your task is to add Handit.ai monitoring to a specific function in a ${isPython ? 'Python' : 'JavaScript/TypeScript'} file.

CRITICAL: You must return the COMPLETE modified file with the actual code changes integrated, NOT comments or instructions.

${isPython ? `
FOR PYTHON FILES:
1. Add these imports after existing imports (with proper spacing):
   from handit_ai import configure, tracing
   import os

2. Add configuration call after imports:
   configure(HANDIT_API_KEY=os.getenv("HANDIT_API_KEY"))  # Get API key from https://dashboard.handit.ai/settings/integrations

3. Add @tracing decorator directly before the target function:
   @tracing(agent="${agentNameForCode}")

IMPORTANT FOR FASTAPI/FLASK: If the function has route decorators like @app.post(), @app.get(), @router.post(), etc., 
the @tracing decorator must go AFTER the route decorator and BEFORE the function definition.

EXAMPLE TRANSFORMATION:
BEFORE:
import requests
from typing import Dict

def process_data(input_data):
    result = analyze(input_data)
    return result

AFTER:
import requests
from typing import Dict
from handit_ai import configure, tracing
import os

configure(HANDIT_API_KEY=os.getenv("HANDIT_API_KEY"))  # Get your API key from https://dashboard.handit.ai/settings/integrations

@tracing(agent="${agentNameForCode}")
def process_data(input_data):
    result = analyze(input_data)
    return result

FASTAPI EXAMPLE:
BEFORE:
from fastapi import FastAPI
app = FastAPI()

@app.post("/bulk-unstructured-to-structured")
def process_bulk_data(data):
    result = analyze(data)
    return result

AFTER:
from fastapi import FastAPI
from handit_ai import configure, tracing
import os

configure(HANDIT_API_KEY=os.getenv("HANDIT_API_KEY"))  # Get your API key from https://dashboard.handit.ai/settings/integrations

app = FastAPI()

@app.post("/bulk-unstructured-to-structured")
@tracing(agent="${agentNameForCode}")
def process_bulk_data(data):
    result = analyze(data)
    return result
` : `
FOR JAVASCRIPT/TYPESCRIPT FILES:
1. Add import after existing imports:
   import { configure, startTracing, endTracing } from '@handit.ai/handit-ai';

2. Add configuration after imports:
   configure({ HANDIT_API_KEY: process.env.HANDIT_API_KEY }); // Get API key from https://dashboard.handit.ai/settings/integrations

3. Modify the target function to include tracing:
   - Add startTracing({ agent: "${agentNameForCode}" }); at function start
   - Wrap existing code in try/finally with endTracing()

EXAMPLE TRANSFORMATION:
BEFORE:
import express from 'express';

const processRequest = async (data) => {
  const result = await analyze(data);
  return result;
};

AFTER:
import express from 'express';
import { configure, startTracing, endTracing } from '@handit.ai/handit-ai';

configure({ HANDIT_API_KEY: process.env.HANDIT_API_KEY }); // Get your API key from https://dashboard.handit.ai/settings/integrations

const processRequest = async (data) => {
  startTracing({ agent: "${agentNameForCode}" });
  try {
    const result = await analyze(data);
    return result;
  } finally {
    endTracing();
  }
};

EXPRESS.JS EXAMPLE:
BEFORE:
import express from 'express';
const app = express();

app.post('/api/process', async (req, res) => {
  const result = await processData(req.body);
  res.json(result);
});

AFTER:
import express from 'express';
import { configure, startTracing, endTracing } from '@handit.ai/handit-ai';

configure({ HANDIT_API_KEY: process.env.HANDIT_API_KEY }); // Get your API key from https://dashboard.handit.ai/settings/integrations

const app = express();

app.post('/api/process', async (req, res) => {
  startTracing({ agent: "${agentNameForCode}" });
  try {
    const result = await processData(req.body);
    res.json(result);
  } finally {
    endTracing();
  }
});
`}

CRITICAL RULES - DO NOT VIOLATE:
- Return the COMPLETE file with ONLY the monitoring code added
- NEVER change existing code logic, variable names, function signatures, or any existing functionality
- NEVER modify existing imports, comments, or documentation
- NEVER change indentation or formatting of existing code
- NEVER add, remove, or modify any existing function parameters
- NEVER change return statements or existing code flow
- ONLY add the handit monitoring imports, configuration, and decorators/tracing
- Find the function "${functionName}" and add monitoring to it WITHOUT changing the function itself
- Don't add comments like "ADD THIS" - add the actual code
- If imports already exist, don't duplicate them
- CRITICAL: For Python functions with route decorators (@app.post, @router.get, etc.), place @tracing decorator AFTER the route decorator and BEFORE the function definition
- CRITICAL: For JavaScript route handlers, add startTracing/endTracing INSIDE the function body, not as decorators
- ABSOLUTELY PRESERVE: All existing variable names, function names, class names, method names, and any existing logic`
    },
    {
      role: 'user',
      content: `File: ${filePath}
Function to monitor: ${functionName}
Agent name: ${agentNameForCode}

Current file content:
\`\`\`
${content}
\`\`\`

Please add Handit.ai monitoring to the "${functionName}" function following the requirements above.`
    }
  ];

  try {
    const response = await generateAIResponse({
      messages,
      responseFormat: HanditIntegrationSchema,
      model: 'gpt-4o-mini',
      provider: 'OpenAI',
      token: process.env.OPENAI_API_KEY
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`✅ AI-generated handit integration for ${filePath}:`, result.explanation);
    console.log(`📝 Changes made:`, result.changes);
    
    return result.modifiedCode;
  } catch (error) {
    console.error('Error using AI for code modification, falling back to simple replacement:', error);
    // Fallback to the original simple method
    return addHanditIntegrationToFileSimple(content, filePath, functionName, agentName);
  }
}

/**
 * Simple fallback method for adding handit integration
 */
function addHanditIntegrationToFileSimple(content, filePath, functionName, agentName) {
  const fileExtension = filePath.split('.').pop().toLowerCase();
  const integrationCode = generateHanditIntegrationCode(filePath, functionName, agentName);
  
  if (!integrationCode) {
    throw new Error(`Unsupported file type: ${fileExtension}`);
  }
  
  if (['py'].includes(fileExtension)) {
    return addPythonHanditIntegration(content, functionName, integrationCode);
  } else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
    return addJavaScriptHanditIntegration(content, functionName, integrationCode);
  }
  
  throw new Error(`Unsupported file type: ${fileExtension}`);
}

/**
 * Add handit integration to Python file
 */
function addPythonHanditIntegration(content, functionName, integrationCode) {
  const lines = content.split('\n');
  const modifiedLines = [...lines];
  
  // Add imports at the top (after existing imports)
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('from ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    modifiedLines.splice(lastImportIndex + 1, 0, '', integrationCode.imports);
  } else {
    modifiedLines.unshift(integrationCode.imports, '');
  }
  
  // Add decorator before the function
  for (let i = 0; i < modifiedLines.length; i++) {
    const line = modifiedLines[i].trim();
    if (line.startsWith(`def ${functionName}(`) || line.startsWith(`async def ${functionName}(`)) {
      modifiedLines.splice(i, 0, integrationCode.decorator);
      break;
    }
  }
  
  return modifiedLines.join('\n');
}

/**
 * Add handit integration to JavaScript/TypeScript file
 */
function addJavaScriptHanditIntegration(content, functionName, integrationCode) {
  const lines = content.split('\n');
  const modifiedLines = [...lines];
  
  // Add imports at the top (after existing imports)
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('const ') && lines[i].includes('require(')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    modifiedLines.splice(lastImportIndex + 1, 0, '', integrationCode.imports);
  } else {
    modifiedLines.unshift(integrationCode.imports, '');
  }
  
  // Find the function and add tracing
  for (let i = 0; i < modifiedLines.length; i++) {
    const line = modifiedLines[i].trim();
    
    // Look for function definition patterns
    const functionPatterns = [
      `function ${functionName}(`,
      `async function ${functionName}(`,
      `const ${functionName} = `,
      `export const ${functionName} = `,
      `export function ${functionName}(`,
      `export async function ${functionName}(`
    ];
    
    if (functionPatterns.some(pattern => line.includes(pattern))) {
      // Find the opening brace and add startTracing after it
      let braceIndex = i;
      while (braceIndex < modifiedLines.length && !modifiedLines[braceIndex].includes('{')) {
        braceIndex++;
      }
      
      if (braceIndex < modifiedLines.length) {
        modifiedLines.splice(braceIndex + 1, 0, integrationCode.startTracing);
        
        // Find the return statement or end of function and add try/finally
        for (let j = braceIndex + 2; j < modifiedLines.length; j++) {
          const returnLine = modifiedLines[j].trim();
          if (returnLine.startsWith('return ')) {
            modifiedLines.splice(j, 0, '  try {');
            modifiedLines.splice(j + 2, 0, '  } finally {', integrationCode.endTracing, '  }');
            break;
          }
        }
      }
      break;
    }
  }
  
  return modifiedLines.join('\n');
}

/**
 * Find and update dependency files (package.json, requirements.txt) for the specific project
 */
async function findAndUpdateDependencyFiles(github, owner, repo, agentFilePath, branch) {
  try {
    console.log(`🔍 Looking for dependency files near ${agentFilePath}`);
    
    // Get the directory of the agent file
    const agentDir = agentFilePath.includes('/') ? 
      agentFilePath.substring(0, agentFilePath.lastIndexOf('/')) : '';
    
    // Search for dependency files in the agent's directory and parent directories
    const dependencyFiles = [];
    const searchPaths = [
      agentDir,                    // Same directory as agent file
      agentDir.split('/').slice(0, -1).join('/'), // Parent directory
      '',                          // Root directory
    ].filter(path => path !== undefined);

    for (const searchPath of searchPaths) {
      try {
        const contents = await github.getContent(owner, repo, searchPath, branch);
        
        if (Array.isArray(contents)) {
          for (const item of contents) {
            if (item.type === 'file') {
              if (item.name === 'package.json' && agentFilePath.match(/\.(js|ts|jsx|tsx)$/)) {
                dependencyFiles.push({ 
                  path: item.path, 
                  type: 'npm',
                  file: item
                });
                break; // Found package.json for JS project
              } else if (item.name === 'requirements.txt' && agentFilePath.match(/\.py$/)) {
                dependencyFiles.push({ 
                  path: item.path, 
                  type: 'pip',
                  file: item
                });
                break; // Found requirements.txt for Python project
              }
            }
          }
        }
        
        // Stop searching if we found a dependency file
        if (dependencyFiles.length > 0) break;
      } catch (error) {
        console.log(`⚠️ Could not read directory ${searchPath}:`, error.message);
      }
    }

    if (dependencyFiles.length === 0) {
      console.log('📦 No dependency files found near agent file');
      return { updated: false, files: [] };
    }

    // Update dependency files
    const updatedFiles = [];
    
    for (const depFile of dependencyFiles) {
      try {
        const fileContent = await github.getContent(owner, repo, depFile.path, branch);
        const content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        
        let updatedContent = null;
        
        if (depFile.type === 'npm') {
          updatedContent = await addNpmDependency(content);
        } else if (depFile.type === 'pip') {
          updatedContent = await addPipDependency(content);
        }
        
        if (updatedContent && updatedContent !== content) {
          updatedFiles.push({
            path: depFile.path,
            type: depFile.type,
            originalContent: content,
            newContent: updatedContent,
            sha: fileContent.sha
          });
          console.log(`✅ Updated dependency file: ${depFile.path}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${depFile.path}:`, error.message);
      }
    }

    return { updated: updatedFiles.length > 0, files: updatedFiles };
  } catch (error) {
    console.error('Error in findAndUpdateDependencyFiles:', error);
    return { updated: false, files: [] };
  }
}

/**
 * Add handit-ai package to package.json
 */
async function addNpmDependency(content) {
  try {
    const packageJson = JSON.parse(content);
    
    // Check if handit-ai is already in dependencies
    if (packageJson.dependencies && packageJson.dependencies['@handit.ai/handit-ai']) {
      console.log('📦 @handit.ai/handit-ai already exists in package.json');
      return content;
    }
    
    // Add handit-ai to dependencies
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    packageJson.dependencies['@handit.ai/handit-ai'] = '^1.0.0';
    
    // Return formatted JSON with proper indentation
    return JSON.stringify(packageJson, null, 2);
  } catch (error) {
    console.error('Error parsing package.json:', error);
    return content;
  }
}

/**
 * Add handit-ai package to requirements.txt
 */
async function addPipDependency(content) {
  try {
    const lines = content.split('\n');
    
    // Check if handit-ai is already in requirements
    const hasHanditAI = lines.some(line => 
      line.trim().startsWith('handit-ai') || 
      line.trim().startsWith('handit_ai')
    );
    
    if (hasHanditAI) {
      console.log('📦 handit-ai already exists in requirements.txt');
      return content;
    }
    
    // Add handit-ai to requirements
    lines.push('handit-ai>=1.0.0');
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error updating requirements.txt:', error);
    return content;
  }
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
 * Get repository files using Tree API (much faster than recursive calls)
 */
async function getRepositoryFilesTree(github, owner, repo, maxDepth = 5, branch = null) {
  try {
    // Determine which branch to use
    let targetBranch = branch;
    if (!targetBranch) {
      // Get repository info to get default branch
      const repoInfo = await github.getRepository(owner, repo);
      targetBranch = repoInfo.default_branch || 'main';
      console.log(`🔍 Using default branch: ${targetBranch}`);
    } else {
      console.log(`🔍 Using specified branch: ${targetBranch}`);
    }
    
    // Get the latest commit SHA for the target branch
    const branchRef = await github.getRef(owner, repo, `heads/${targetBranch}`);
    const commitSha = branchRef.object.sha;
    
    // Get the entire repository tree in one API call (recursive=true)
    console.log(`🚀 Fetching complete repository tree for ${owner}/${repo}`);
    const tree = await github.getTree(owner, repo, commitSha, true);
    
    console.log(`📁 Tree API returned ${tree.tree.length} items`);
    
    // Convert tree items to our file format
    const files = [];
    
    for (const item of tree.tree) {
      // Skip if path is too deep
      const pathDepth = item.path.split('/').length - 1;
      if (pathDepth > maxDepth) continue;
      
      if (item.type === 'blob') { // blob = file
        // Skip files in non-searchable directories
        const pathParts = item.path.split('/');
        const isInSkippedDir = pathParts.some(part => !isSearchableDirectory(part));
        if (isInSkippedDir) continue;
        
        const fileName = pathParts[pathParts.length - 1];
        
        files.push({
          type: 'file',
          name: fileName,
          path: item.path,
          size: item.size || 0,
          extension: getFileExtension(fileName),
          isExecutable: isExecutableFile(fileName),
          isSourceCode: isSourceCodeFile(fileName),
          sha: item.sha
        });
      } else if (item.type === 'tree') { // tree = directory
        const dirName = item.path.split('/').pop();
        if (isSearchableDirectory(dirName)) {
          files.push({
            type: 'dir',
            name: dirName,
            path: item.path,
            hasChildren: true,
          });
        }
      }
    }
    
    console.log(`✅ Processed ${files.length} files and directories`);
    return files;
  } catch (error) {
    console.error(`❌ Error using Tree API, falling back to recursive method:`, error.message);
    // Fallback to the original recursive method
    return await getRepositoryFilesRecursive(github, owner, repo, '', 0, maxDepth, branch);
  }
}

/**
 * Recursively get repository files with depth limit (fallback method)
 */
async function getRepositoryFilesRecursive(github, owner, repo, path = '', currentDepth = 0, maxDepth = 5, branch = null) {
  if (currentDepth >= maxDepth) {
    console.log(`🔍 Reached maxDepth ${maxDepth} at path: ${path}`);
    return [];
  }

  try {
    const contents = await github.getContent(owner, repo, path, branch);
    const files = [];
    console.log(`🔍 Processing path: ${path || 'root'} (depth ${currentDepth}), found ${Array.isArray(contents) ? contents.length : 1} items`);

    if (Array.isArray(contents)) {
      // Directory listing
      for (const item of contents) {
        if (item.type === 'file') {
          // Add file to results
          files.push({
            type: 'file',
            name: item.name,
            path: item.path,
            size: item.size,
            extension: getFileExtension(item.name),
            isExecutable: isExecutableFile(item.name),
            isSourceCode: isSourceCodeFile(item.name),
          });
        } else if (item.type === 'dir') {
          if (isSearchableDirectory(item.name)) {
            // Add directory info
            files.push({
              type: 'dir',
              name: item.name,
              path: item.path,
              hasChildren: true,
            });

            // Recursively get files from subdirectory
            const subFiles = await getRepositoryFilesRecursive(
              github, 
              owner, 
              repo, 
              item.path, 
              currentDepth + 1, 
              maxDepth,
              branch
            );
            console.log(`🔍 Subdirectory ${item.path} returned ${subFiles.length} files`);
            files.push(...subFiles);
          } else {
            console.log(`🔍 Skipping directory: ${item.name} (not searchable)`);
          }
        }
      }
    } else if (contents.type === 'file') {
      // Single file
      files.push({
        type: 'file',
        name: contents.name,
        path: contents.path,
        size: contents.size,
        extension: getFileExtension(contents.name),
        isExecutable: isExecutableFile(contents.name),
        isSourceCode: isSourceCodeFile(contents.name),
      });
    }

    return files;
  } catch (error) {
    console.error(`Error getting files for ${path}:`, error.message);
    return [];
  }
}

/**
 * Organize files for better UX (group by type, sort by relevance)
 */
function organizeRepositoryFiles(files) {
  const organized = {
    sourceFiles: [],
    configFiles: [],
    directories: [],
    otherFiles: [],
  };

  files.forEach(file => {
    if (file.type === 'dir') {
      organized.directories.push(file);
    } else if (file.isSourceCode) {
      organized.sourceFiles.push(file);
    } else if (isConfigFile(file.name)) {
      organized.configFiles.push(file);
    } else {
      organized.otherFiles.push(file);
    }
  });

  // Sort each category
  Object.keys(organized).forEach(category => {
    organized[category].sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
  });

  return organized;
}

/**
 * Get file extension
 */
function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

/**
 * Check if file is executable/main file
 */
function isExecutableFile(filename) {
  const executableNames = ['main.py', 'main.js', 'index.js', 'index.ts', 'app.py', 'app.js', 'server.js', 'server.py', 'run.py', 'start.js'];
  const executablePatterns = [/^main\./i, /^index\./i, /^app\./i, /^server\./i, /^run\./i, /^start\./i];
  
  return executableNames.includes(filename.toLowerCase()) || 
         executablePatterns.some(pattern => pattern.test(filename));
}

/**
 * Check if file is source code
 */
function isSourceCodeFile(filename) {
  const sourceExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'php', 'rb', 'cs', 'cpp', 'c', 'h', 'rs', 'kt', 'swift', 'dart'];
  const extension = getFileExtension(filename);
  return sourceExtensions.includes(extension);
}

/**
 * Check if file is configuration file
 */
function isConfigFile(filename) {
  const configExtensions = ['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'];
  const configPatterns = [/package\.json$/i, /requirements\.txt$/i, /Dockerfile$/i, /docker-compose/i, /\.env/i, /config\./i];
  
  const extension = getFileExtension(filename);
  return configExtensions.includes(extension) || 
         configPatterns.some(pattern => pattern.test(filename));
}

/**
 * Check if directory should be searched
 */
function isSearchableDirectory(dirname) {
  const skipDirectories = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__', 'vendor', '.vscode', '.idea', 'logs', 'tmp', 'temp'];
  return !skipDirectories.includes(dirname.toLowerCase());
}

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

/**
 * Get pull requests for the authenticated user
 */
export const getUserPullRequests = async (req, res) => {
  try {
    const userObj = req.userObject;
    const userId = userObj.id;
    const type = req.query.type || 'handit_setup';
    
    // Get user's company
    const user = await User.findByPk(userId, {
      include: [{
        model: Company,
      }]
    });
    
    if (!user || !user.companyId) {
      return res.status(404).json({
        error: 'User or company not found'
      });
    }
    
    console.log('user', user);
    console.log('user.companyId', user.companyId);
    // Get all GitHub integrations for the company
    const integrations = await GitHubIntegration.findAll({
      where: {
        companyId: user.companyId,
      }
    });
    console.log('integrations', integrations);
    
    if (integrations.length === 0) {
      return res.json({
        success: true,
        pullRequests: []
      });
    }
    
    // Get pull requests for all integrations
    const pullRequests = await GitHubPullRequest.findAll({
      where: {
        githubIntegrationId: integrations.map(integration => integration.id),
        type: type,
      },
      order: [['createdAt', 'DESC']],
      limit: 50 // Limit to recent 50 PRs
    });
    
    // Format the response
    const formattedPRs = pullRequests.map(pr => ({
      id: pr.id,
      prNumber: pr.prNumber,
      prUrl: pr.prUrl,
      type: pr.type,
      status: pr.status,
      metricsImprovement: pr.metricsImprovement,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt
    }));
    
    res.json({
      success: true,
      pullRequests: formattedPRs
    });
    
  } catch (error) {
    console.error('Error fetching user pull requests:', error);
    res.status(500).json({
      error: 'Failed to fetch pull requests',
      details: error.message
    });
  }
}; 