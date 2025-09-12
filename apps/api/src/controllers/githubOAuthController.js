import crypto from 'crypto';
import GitHubOAuthService from '../services/githubOAuthService.js';
import db from '../../models/index.js';

const { User, Company, GitHubIntegration } = db;

/**
 * Initiate GitHub OAuth login flow
 * Redirects user to GitHub OAuth authorization page
 */
export const initiateGitHubOAuth = async (req, res) => {
  try {
    const { redirect_uri } = req.query;
    
    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session or cache (for production, use Redis)
    // For now, we'll include redirect_uri in state
    const stateWithRedirect = `${state}:${redirect_uri || ''}`;
    
    // GitHub OAuth parameters
    const githubOAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubOAuthUrl.searchParams.set('client_id', process.env.GITHUB_OAUTH_CLIENT_ID);
    githubOAuthUrl.searchParams.set('redirect_uri', process.env.GITHUB_OAUTH_REDIRECT_URI);
    githubOAuthUrl.searchParams.set('scope', 'read:org user:email read:user');
    githubOAuthUrl.searchParams.set('state', stateWithRedirect);
    githubOAuthUrl.searchParams.set('allow_signup', 'true');

    console.log(`🔗 Redirecting to GitHub OAuth: ${githubOAuthUrl.toString()}`);
    
    res.redirect(githubOAuthUrl.toString());
  } catch (error) {
    console.error('Error initiating GitHub OAuth:', error);
    res.status(500).json({ 
      error: 'Failed to initiate GitHub OAuth',
      message: error.message 
    });
  }
};

/**
 * Handle GitHub OAuth callback
 * Processes the authorization code and completes the OAuth flow
 */
export const handleGitHubOAuthCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error, error_description);
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${dashboardUrl}/auth/signin?error=oauth_error&message=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      console.error('No authorization code received');
      const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${dashboardUrl}/auth/signin?error=no_code`);
    }

    console.log('🔄 Processing GitHub OAuth callback...');

    // Complete the OAuth flow
    const result = await GitHubOAuthService.completeOAuthFlow(code);
    
    if (!result.success) {
      throw new Error('OAuth flow failed');
    }

    const { user, token, installations, githubUser } = result;
    
    // Update last login time
    await user.update({ lastLoginAt: new Date() });

    // Determine redirect based on installations
    const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
    
    if (installations.length === 0) {
      // No installations found - redirect to callback with setup flag
      return res.redirect(`${dashboardUrl}/auth/github/callback?token=${token}&setup=github`);
    } else if (installations.length === 1) {
      // Single installation - auto-select and redirect to callback
      const installation = installations[0];
      if (installation.isNewCompany) {
        // Create company and integration for new installation
        const name = installation.installation.account.login;
        const splitName = name.split(' ');
        let nameShort = name;
        if (splitName.length > 1) {
          nameShort = `${splitName[0]} ${splitName[1]}`;
        }
        const company = await Company.create({
          name: nameShort,
          nationalId: installation.installation.account.login,
        });
        
        await user.update({ companyId: company.id });
        
        await GitHubOAuthService.createGitHubIntegration(
          company.id,
          installation.installation.id,
          installation.installation
        );
      }
      
      return res.redirect(`${dashboardUrl}/auth/github/callback?token=${token}`);
    } else {
      // Multiple installations - redirect to callback with installation data
      const installationData = installations.map(inst => ({
        id: inst.installation.id,
        account: inst.installation.account,
        isNewCompany: inst.isNewCompany,
        company: inst.company,
        integration: inst.integration,
      }));
      
      return res.redirect(`${dashboardUrl}/auth/github/callback?token=${token}&installations=${encodeURIComponent(JSON.stringify(installationData))}`);
    }

  } catch (error) {
    console.error('Error handling GitHub OAuth callback:', error);
    const dashboardUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/auth/signin?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Get user's GitHub installations
 * Returns installations that the authenticated user can access
 */
export const getUserInstallations = async (req, res) => {
  try {
    const { userObject } = req;
    
    if (!userObject.githubUserId) {
      return res.status(400).json({ 
        error: 'User is not linked to GitHub account' 
      });
    }

    // This would require storing the user's access token
    // For now, we'll return installations from existing integrations
    const integrations = await GitHubIntegration.findAll({
      where: {
        companyId: userObject.companyId,
      },
    });

    const installations = integrations.map(integration => ({
      id: integration.githubAppInstallationId,
      company: {
        id: integration.companyId,
        name: integration.repositoryOwner,
      },
      integration: {
        id: integration.id,
        configured: integration.isConfigured(),
        active: integration.active,
      },
    }));

    res.status(200).json({ installations });
  } catch (error) {
    console.error('Error getting user installations:', error);
    res.status(500).json({ 
      error: 'Failed to get user installations',
      message: error.message 
    });
  }
};

/**
 * Link user to a specific company via GitHub installation
 * Used when user selects an organization from the picker
 */
export const linkUserToCompany = async (req, res) => {
  try {
    const { userObject } = req;
    const { installationId } = req.body;
    
    if (!installationId) {
      return res.status(400).json({ 
        error: 'installationId is required' 
      });
    }

    // Find the GitHub integration for this installation
    const integration = await GitHubIntegration.findOne({
      where: {
        githubAppInstallationId: installationId,
      },
      include: [{
        model: Company,
        as: 'Company',
      }],
    });

    if (!integration) {
      return res.status(404).json({ 
        error: 'GitHub installation not found' 
      });
    }

    // Update user's company
    await userObject.update({
      companyId: integration.Company.id,
    });

    // Generate new JWT token
    const token = GitHubOAuthService.generateUserToken(userObject);

    res.status(200).json({
      success: true,
      user: userObject,
      company: integration.Company,
      integration,
      token,
    });
  } catch (error) {
    console.error('Error linking user to company:', error);
    res.status(500).json({ 
      error: 'Failed to link user to company',
      message: error.message 
    });
  }
};

/**
 * Create new company and GitHub integration
 * Used when user wants to set up a new installation
 */
export const createCompanyForInstallation = async (req, res) => {
  try {
    const { userObject } = req;
    const { installationId, companyName } = req.body;
    
    if (!installationId) {
      return res.status(400).json({ 
        error: 'installationId is required' 
      });
    }

    // Get installation details from GitHub API
    const jwt = GitHubIntegration.generateJWT();
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'handit-ai/1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const installationData = await response.json();

    // Create new company
    const company = await Company.create({
      name: companyName || installationData.account.login,
      nationalId: installationData.account.login,
    });

    // Create GitHub integration
    const integration = await GitHubOAuthService.createGitHubIntegration(
      company.id,
      installationId,
      installationData
    );

    // Update user's company
    await userObject.update({
      companyId: company.id,
    });

    // Generate new JWT token
    const token = GitHubOAuthService.generateUserToken(userObject);

    res.status(201).json({
      success: true,
      user: userObject,
      company,
      integration,
      token,
    });
  } catch (error) {
    console.error('Error creating company for installation:', error);
    res.status(500).json({ 
      error: 'Failed to create company for installation',
      message: error.message 
    });
  }
};

/**
 * Get GitHub OAuth configuration
 * Returns OAuth app configuration for frontend
 */
export const getGitHubOAuthConfig = async (req, res) => {
  try {
    res.status(200).json({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
      redirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI,
      scopes: ['read:org', 'user:email', 'read:user'],
    });
  } catch (error) {
    console.error('Error getting GitHub OAuth config:', error);
    res.status(500).json({ 
      error: 'Failed to get OAuth configuration',
      message: error.message 
    });
  }
};
