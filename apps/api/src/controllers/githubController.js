import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import GitHubClient from '../services/githubClient.js';
import db from '../../models/index.js';
const { GitHubIntegration, GitHubPullRequest, Company } = db;

/**
 * Initiate GitHub OAuth flow
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
    
    const apiUrl = process.env.API_URL
    const clientId = process.env.GITHUB_CLIENT_ID
    // Store state in session or cache (for now, we'll include it in the redirect)
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('redirect_uri', `${apiUrl}/api/git/callback`);
    githubAuthUrl.searchParams.set('scope', 'repo,read:user,write:repo_hook');
    githubAuthUrl.searchParams.set('state', `${state}:${companyId}`);

    res.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('Error initiating GitHub auth:', error);
    res.status(500).json({ 
      error: 'Failed to initiate GitHub authentication' 
    });
  }
};

/**
 * Handle GitHub OAuth callback
 */
export const handleGitHubCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ 
        error: 'Missing code or state parameter' 
      });
    }

    // Parse state to get company ID
    const [stateToken, companyId] = state.split(':');
    
    if (!companyId) {
      return res.status(400).json({ 
        error: 'Invalid state parameter' 
      });
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET
    // Exchange code for access token
    const tokenData = await GitHubClient.exchangeCodeForToken(
      code,
      clientId,
      clientSecret
    );

    if (tokenData.error) {
      return res.status(400).json({ 
        error: `GitHub OAuth error: ${tokenData.error_description}` 
      });
    }

    // Get user information
    const githubClient = new GitHubClient(tokenData.access_token);
    const user = await githubClient.getAuthenticatedUser();

    // Create or update GitHub integration
    const [integration, created] = await GitHubIntegration.findOrCreate({
      where: { companyId: parseInt(companyId) },
      defaults: {
        companyId: parseInt(companyId),
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? 
          new Date(Date.now() + tokenData.expires_in * 1000) : null,
        repositoryOwner: user.login,
        repositoryName: '', // Will be set later
        promptFilePath: '', // Will be set later
        active: false, // Inactive until properly configured
      },
    });

    if (!created) {
      // Update existing integration
      await integration.update({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? 
          new Date(Date.now() + tokenData.expires_in * 1000) : null,
        repositoryOwner: user.login,
      });
    }

    // Redirect to dashboard with success message
    const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/github-success?success=true&integration_id=${integration.id}`);
  } catch (error) {
    console.error('Error handling GitHub callback:', error);
    const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/github-success?error=auth_failed`);
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

    // Test GitHub API access
    const githubClient = new GitHubClient(integration.accessToken);

    try {
      // Try to get repository info
      const repo = await githubClient.getRepository(
        integration.repositoryOwner,
        integration.repositoryName
      );

      // Try to get the prompt file
      const file = await githubClient.getContent(
        integration.repositoryOwner,
        integration.repositoryName,
        integration.promptFilePath,
        integration.branchName
      );

      res.status(200).json({
        success: true,
        message: 'Integration test successful',
        repository: {
          name: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch,
        },
        promptFile: {
          path: file.path,
          size: file.size,
          lastModified: file.sha,
        },
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
  
  // Handle GitHub App installation events
  console.log(`GitHub App ${action}:`, installation.id);
  
  // You can update integrations with installation IDs here if needed
} 