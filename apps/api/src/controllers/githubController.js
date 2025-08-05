import crypto from 'crypto';
import GitHubClient from '../services/githubClient.js';
import db from '../../models/index.js';
const { GitHubIntegration, GitHubPullRequest, Company } = db;

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
    
    // Redirect to GitHub App installation page
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
      const response = await fetch(`https://api.github.com/app/installations/${installation_id}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${jwt}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'handit-ai/1.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get installation details: ${response.status}`);
      }

      const installationData = await response.json();
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