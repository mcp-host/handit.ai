import axios from 'axios';
import crypto from 'crypto';
import db from '../../models/index.js';
import jwt from 'jsonwebtoken';

const { User, Company, GitHubIntegration } = db;

/**
 * GitHub OAuth User Authentication Service
 * Handles GitHub OAuth flow for user authentication and installation discovery
 */
class GitHubOAuthService {
  /**
   * Exchange OAuth authorization code for user access token
   * @param {string} code - Authorization code from GitHub
   * @returns {Promise<Object>} Token response with access_token, refresh_token, etc.
   */
  static async exchangeCodeForUserToken(code) {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.error) {
        throw new Error(`GitHub OAuth error: ${response.data.error_description || response.data.error}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      if (error.response) {
        throw new Error(`GitHub OAuth error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get GitHub user profile using access token
   * @param {string} accessToken - GitHub user access token
   * @returns {Promise<Object>} GitHub user profile
   */
  static async getUserProfile(accessToken) {
    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'handit-ai/1.0.0',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      if (error.response) {
        throw new Error(`GitHub API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Generate GitHub App JWT for API authentication
   * @returns {string} JWT token for GitHub App
   */
  static generateGitHubAppJWT() {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY environment variables are required');
    }

    // Format the private key (handle both raw and base64 encoded keys)
    let formattedPrivateKey = privateKey;
    if (!privateKey.includes('-----BEGIN')) {
      // If it's base64 encoded, decode it
      formattedPrivateKey = Buffer.from(privateKey, 'base64').toString('utf8');
    }

    // JWT payload
    const payload = {
      iat: Math.floor(Date.now() / 1000) - 60, // Issued at time (60 seconds ago to account for clock skew)
      exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expires in 10 minutes
      iss: parseInt(appId) // GitHub App ID
    };

    // Generate JWT
    return jwt.sign(payload, formattedPrivateKey, { algorithm: 'RS256' });
  }

  /**
   * Get user's accessible GitHub App installations
   * @param {string} accessToken - GitHub user access token
   * @returns {Promise<Array>} Array of installations the user can access
   */
  static async getUserInstallations(accessToken) {
    try {
      // First, try to get user's organizations
      const orgsResponse = await axios.get('https://api.github.com/user/orgs', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'handit-ai/1.0.0',
        },
      });

      const userOrgs = orgsResponse.data;
      console.log(`✅ Found ${userOrgs.length} organizations for user`);

      // Get user's own account info
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'handit-ai/1.0.0',
        },
      });

      const userAccount = userResponse.data;
      
      // Check which organizations have our GitHub App installed using App JWT
      const handitAppId = parseInt(process.env.GITHUB_APP_ID);
      const installations = [];

      // Generate GitHub App JWT for installation checks
      const appJWT = this.generateGitHubAppJWT();

      // Check user's own account
      try {
        const userInstallationResponse = await axios.get(`https://api.github.com/orgs/${userAccount.login}/installation`, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${appJWT}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'handit-ai/1.0.0',
          },
        });
        
        if (userInstallationResponse.data && userInstallationResponse.data.app_id === handitAppId) {
          installations.push(userInstallationResponse.data);
        }
      } catch (error) {
        // User account doesn't have the app installed, continue
        console.log(`App not installed on user account: ${userAccount.login}`);
      }

      // Check each organization
      for (const org of userOrgs) {
        try {
          const orgInstallationResponse = await axios.get(`https://api.github.com/orgs/${org.login}/installation`, {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${appJWT}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'handit-ai/1.0.0',
            },
          });
          
          if (orgInstallationResponse.data && orgInstallationResponse.data.app_id === handitAppId) {
            installations.push(orgInstallationResponse.data);
          }
        } catch (error) {
          // Organization doesn't have the app installed, continue
          console.log(`App not installed on organization: ${org.login}`);
        }
      }

      console.log(`✅ Found ${installations.length} Handit installations`);
      return installations;
    } catch (error) {
      console.error('Error getting user installations:', error);
      if (error.response) {
        throw new Error(`GitHub API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get repositories accessible to a specific installation
   * @param {string} accessToken - GitHub user access token
   * @param {number} installationId - GitHub App installation ID
   * @returns {Promise<Array>} Array of repositories
   */
  static async getInstallationRepositories(accessToken, installationId) {
    try {
      const response = await axios.get(
        `https://api.github.com/user/installations/${installationId}/repositories`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'handit-ai/1.0.0',
          },
        }
      );

      return response.data.repositories;
    } catch (error) {
      console.error('Error getting installation repositories:', error);
      if (error.response) {
        throw new Error(`GitHub API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Find or create a Handit user from GitHub profile
   * @param {Object} githubUser - GitHub user profile
   * @param {Array} installations - User's accessible installations
   * @returns {Promise<Object>} Handit user object
   */
  static async findOrCreateHanditUser(githubUser, installations) {
    try {
      // Try to find existing user by GitHub ID or email
      let user = await User.findOne({
        where: {
          githubUserId: githubUser.id.toString(),
        },
      });

      if (!user && githubUser.email) {
        user = await User.findOne({
          where: {
            email: githubUser.email,
          },
        });
      }

      if (user) {
        // Update existing user with GitHub info
        let firstName = githubUser.name ? githubUser.name.split(' ')[0] : user.firstName;
        let lastName = githubUser.name ? githubUser.name.split(' ').slice(1).join(' ') : user.lastName
        if (githubUser.name && githubUser.name.split(' ').length > 1) {
          // get last two names
          lastName = githubUser.name.split(' ').slice(-2).join(' ');
        }
        await user.update({
          githubUserId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          firstName: firstName,
          lastName: lastName,
          oauthProvider: 'github',
        });
      } else {
        // Create new user
        const nameParts = githubUser.name ? githubUser.name.split(' ') : [githubUser.login, ''];
        const firstName = nameParts[0] || githubUser.login;
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create a temporary company for the user (will be updated when they select an installation)
        const tempCompany = await Company.create({
          name: `${firstName} ${lastName}`,
          nationalId: githubUser.email || `github_${githubUser.id}`,
        });

        user = await User.create({
          email: githubUser.email || `github_${githubUser.id}@handit.ai`,
          password: crypto.randomBytes(32).toString('hex'), // Random password for OAuth users
          firstName,
          lastName,
          role: 'user',
          companyId: tempCompany.id,
          membershipId: 1,
          githubUserId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          oauthProvider: 'github',
        });
      }

      return user;
    } catch (error) {
      console.error('Error finding/creating Handit user:', error);
      throw error;
    }
  }

  /**
   * Link user to existing company based on GitHub installation
   * @param {Object} user - Handit user object
   * @param {number} installationId - GitHub App installation ID
   * @returns {Promise<Object>} Updated user and company info
   */
  static async linkUserToCompanyByInstallation(user, installationId) {
    try {
      // Find existing GitHub integration for this installation
      const integration = await GitHubIntegration.findOne({
        where: {
          githubAppInstallationId: installationId,
        },
        include: [{
          model: Company,
          as: 'Company',
        }],
      });

      if (integration && integration.Company) {
        // Link user to existing company
        await user.update({
          companyId: integration.Company.id,
        });

        return {
          user,
          company: integration.Company,
          integration,
          isNewCompany: false,
        };
      }

      // No existing integration found
      return {
        user,
        company: null,
        integration: null,
        isNewCompany: true,
      };
    } catch (error) {
      console.error('Error linking user to company:', error);
      throw error;
    }
  }

  /**
   * Create GitHub integration for installation
   * @param {number} companyId - Company ID
   * @param {number} installationId - GitHub App installation ID
   * @param {Object} installationData - Installation data from GitHub API
   * @returns {Promise<Object>} Created integration
   */
  static async createGitHubIntegration(companyId, installationId, installationData) {
    try {
      const integration = await GitHubIntegration.create({
        companyId,
        githubAppInstallationId: installationId,
        repositoryOwner: installationData.account.login,
        repositoryName: '', // Will be set later by user
        promptFilePath: '', // Will be set later by user
        branchName: 'main',
        active: false, // Inactive until properly configured
      });

      return integration;
    } catch (error) {
      console.error('Error creating GitHub integration:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for authenticated user
   * @param {Object} user - Handit user object
   * @returns {string} JWT token
   */
  static generateUserToken(user) {
    return jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1y' }
    );
  }

  /**
   * Complete GitHub OAuth flow
   * @param {string} code - OAuth authorization code
   * @returns {Promise<Object>} Authentication result
   */
  static async completeOAuthFlow(code) {
    try {
      console.log('🔄 Starting GitHub OAuth flow...');

      // Step 1: Exchange code for token
      const tokenData = await this.exchangeCodeForUserToken(code);
      console.log('✅ Exchanged code for token');

      // Step 2: Get user profile
      const githubUser = await this.getUserProfile(tokenData.access_token);
      console.log(`✅ Got user profile: ${githubUser.login} (${githubUser.email})`);

      // Step 3: Get user's installations
      const installations = await this.getUserInstallations(tokenData.access_token);
      console.log(`✅ Found ${installations.length} Handit installations`);

      // Step 4: Find or create Handit user
      const user = await this.findOrCreateHanditUser(githubUser, installations);
      console.log(`✅ User ${user.id} ready`);

      // Step 5: Process installations
      const installationResults = [];
      for (const installation of installations) {
        const result = await this.linkUserToCompanyByInstallation(user, installation.id);
        installationResults.push({
          installation,
          ...result,
        });
      }

      // Step 6: Generate JWT token
      const token = this.generateUserToken(user);

      console.log('✅ GitHub OAuth flow completed successfully');

      return {
        success: true,
        user,
        token,
        installations: installationResults,
        githubUser,
      };
    } catch (error) {
      console.error('❌ GitHub OAuth flow failed:', error);
      throw error;
    }
  }
}

export default GitHubOAuthService;
