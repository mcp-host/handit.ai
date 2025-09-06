import axios from 'axios';

/**
 * Simple GitHub API client using axios
 * Avoids the octokit dependency issues with Node.js module resolution
 */

class GitHubClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://api.github.com';
    this.headers = {
      'Authorization': `Bearer ${token}`,
    };
    
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: options.method ? options.method : 'GET',
      headers: {
        ...this.headers,
        ...options.headers
      },
      data: options.body,
      ...options,
    };

    // Debug headers (hide sensitive token)
    const debugHeaders = { ...config.headers };
    if (debugHeaders.Authorization) {
      const authValue = debugHeaders.Authorization;
      if (authValue.startsWith('Bearer ')) {
        const token = authValue.substring(7);
        debugHeaders.Authorization = token.length > 8 ? 
          `Bearer ${token.substring(0, 4)}...${token.substring(token.length - 4)}` : 
          'Bearer ***';
      } else if (authValue.startsWith('token ')) {
        const token = authValue.substring(6);
        debugHeaders.Authorization = token.length > 8 ? 
          `Bearer ${token.substring(0, 4)}...${token.substring(token.length - 4)}` : 
          'Bearer ***';
      }
    }

    try {
      const response = await axios(url, config);
      return response.data;
    } catch (error) {
      // More detailed error logging
      if (error.response) {
        console.log(`❌ URL:`, url);
        console.log(`❌ HTTP ${error.response.status} Error:`, error.response.data);
        console.log(`❌ Response headers:`, error.response.headers);
      }
      
      if (error.response) {
        throw new Error(`GitHub API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // User operations
  async getAuthenticatedUser() {
    return this.request('/user');
  }

  // Repository operations
  async getRepository(owner, repo) {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async listInstallationRepos() {
    // Requires an installation access token
    return this.request(`/installation/repositories`);
  }

  async getContent(owner, repo, path, ref = null) {
    const params = ref ? `?ref=${ref}` : '';
    return this.request(`/repos/${owner}/${repo}/contents/${path}${params}`);
  }

  async createOrUpdateFile(owner, repo, path, message, content, sha = null, branch = null) {
    const body = {
      message,
      content: Buffer.from(content).toString('base64')
    };

    if (sha) body.sha = sha;
    if (branch) body.branch = branch;

    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // Git operations
  async getRef(owner, repo, ref) {
    return this.request(`/repos/${owner}/${repo}/git/ref/${ref}`);
  }

  // Get all branches for a repository (with pagination support)
  async getBranches(owner, repo) {
    const allBranches = [];
    let page = 1;
    const perPage = 100; // Maximum per page
    
    while (true) {
      const branches = await this.request(`/repos/${owner}/${repo}/branches?page=${page}&per_page=${perPage}`);
      
      if (!branches || branches.length === 0) {
        break;
      }
      
      allBranches.push(...branches);
      
      // If we got fewer than perPage results, we've reached the end
      if (branches.length < perPage) {
        break;
      }
      
      page++;
    }
    
    console.log(`🔍 GitHub API returned ${allBranches.length} total branches`);
    return allBranches;
  }

  // Get repository tree (much faster than recursive content calls)
  async getTree(owner, repo, sha, recursive = true) {
    const params = recursive ? '?recursive=1' : '';
    return this.request(`/repos/${owner}/${repo}/git/trees/${sha}${params}`);
  }

  async createRef(owner, repo, ref, sha) {
    
    // Validate inputs
    if (!ref || !sha) {
      throw new Error(`Invalid ref or sha: ref=${ref}, sha=${sha}`);
    }
    
    // Ensure ref starts with refs/
    if (!ref.startsWith('refs/')) {
      throw new Error(`Ref must start with 'refs/': ${ref}`);
    }
    
    try {
      const result = await this.request(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: {
          ref,
          sha,
        },
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to create ref ${ref}:`, error.message);
      
      
      throw error;
    }
  }

  // Pull request operations
  async createPullRequest(owner, repo, title, head, base, body) {
    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        head,
        base,
        body,
      }),
    });
  }

  async createComment(owner, repo, issueNumber, body) {
    return this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  // Search operations
  async searchCode(owner, repo, query) {
    try {
      // GitHub's code search API endpoint with authentication
      
      // First verify we can access the repository
      try {
        await this.getRepository(owner, repo);
      } catch (repoError) {
        console.error(`❌ Cannot access repository ${owner}/${repo}:`, repoError.message);
        return { items: [] };
      }
      
      const searchQuery = `repo:${owner}/${repo} ${query}`;
      
      // GitHub search API has rate limits and specific requirements
      // Wait a bit to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use authenticated request to access private repositories
      const result = await this.request(`/search/code?q=${encodeURIComponent(searchQuery)}`);
      
      
      return result;
    } catch (error) {
      console.error(`❌ Error searching code in ${owner}/${repo}:`, error.message);
      if (error.response.message.startsWith('API rate limit excee')) {
        setTimeout(() => {
          return { items: [] };
        }, 1000);
      }
      
      // Check for specific GitHub API errors
      if (error.message.includes('403')) {
        console.error('🔒 Access denied - check if the token has proper repository access');
        console.error('💡 Required scopes: repo (for private repos) or public_repo (for public repos)');
      } else if (error.message.includes('422')) {
        console.error('🔍 Search query validation failed - the query might be too complex or invalid');
        console.error('💡 Try simplifying the search query or check GitHub search syntax');
      } else if (error.message.includes('404')) {
        console.error('📁 Repository not found or not accessible with current token');
      } else if (error.message.includes('429')) {
        console.error('⏰ Rate limit exceeded - GitHub search API has strict rate limits');
        console.error('💡 Wait before retrying or use a different search strategy');
      }
      
      // Return empty results if search fails
      return { items: [] };
    }
  }

  // Verify token permissions
  async verifyTokenPermissions() {
    try {
      const user = await this.getAuthenticatedUser();
      
      // Check token scopes (if available in response headers)
      return {
        authenticated: true,
        user: user.login,
        userType: user.type
      };
    } catch (error) {
      console.error('❌ Token verification failed:', error.message);
      return {
        authenticated: false,
        error: error.message
      };
    }
  }

  // Check specific repository permissions
  async checkRepositoryPermissions(owner, repo) {
    try {
      
      // Try to get repository details
      const repository = await this.getRepository(owner, repo);

      // Check if we have push permissions by trying to get a ref
      let defaultRef;
      try {
        defaultRef = await this.getRef(owner, repo, `heads/${repository.default_branch}`);
      } catch (refError) {
        console.error(`❌ Cannot read refs:`, refError.message);
        return {
          accessible: true,
          canRead: false,
          canWrite: false,
          error: `Cannot read refs: ${refError.message}`
        };
      }

      // Test if we can create a ref by trying to create a test branch (then delete it)
      try {
        const testBranchName = `test-permissions-${Date.now()}`;
        const testRef = `refs/heads/${testBranchName}`;
        
        
        // Try to create the test branch
        await this.createRef(owner, repo, testRef, defaultRef.object.sha);
        
        // Immediately delete the test branch
        try {
          await this.deleteRef(owner, repo, `heads/${testBranchName}`);
        } catch (deleteError) {
          console.log(`⚠️  Could not delete test branch (but creation worked): ${deleteError.message}`);
        }
        
        return {
          accessible: true,
          canRead: true,
          canWrite: true,
          repository: {
            fullName: repository.full_name,
            private: repository.private,
            defaultBranch: repository.default_branch,
            permissions: repository.permissions || {}
          }
        };
      } catch (writeError) {
        console.error(`❌ Cannot write to repository:`, writeError.message);
        return {
          accessible: true,
          canRead: true,
          canWrite: false,
          error: `Cannot write to repository: ${writeError.message}`,
          repository: {
            fullName: repository.full_name,
            private: repository.private,
            defaultBranch: repository.default_branch,
            permissions: repository.permissions || {}
          }
        };
      }
    } catch (error) {
      console.error(`❌ Repository permission check failed:`, error.message);
      return {
        accessible: false,
        canRead: false,
        canWrite: false,
        error: error.message
      };
    }
  }

  // Delete a ref
  async deleteRef(owner, repo, ref) {
    return this.request(`/repos/${owner}/${repo}/git/refs/${ref}`, {
      method: 'DELETE',
    });
  }

  // Alternative search method that recursively searches through repository files
  // This is a fallback when the search API fails or has limitations
  async searchInRepositoryFiles(owner, repo, query, path = '') {
    try {
      
      const contents = await this.getContent(owner, repo, path);
      const results = [];

      if (Array.isArray(contents)) {
        // Directory listing
        for (const item of contents) {
          if (item.type === 'file' && this.isSearchableFile(item.name)) {
            try {
              const fileContent = await this.getContent(owner, repo, item.path);
              if (fileContent.content) {
                const decodedContent = Buffer.from(fileContent.content, 'base64').toString('utf-8');
                if (decodedContent.includes(query)) {
                  results.push({
                    path: item.path,
                    name: item.name,
                    sha: fileContent.sha,
                    content: decodedContent,
                    score: this.calculateMatchScore(decodedContent, query)
                  });
                }
              }
            } catch (fileError) {
              console.log(`⚠️ Could not read file ${item.path}: ${fileError.message}`);
            }
          } else if (item.type === 'dir' && this.isSearchableDirectory(item.name)) {
            // Recursively search subdirectories (limit depth to avoid infinite loops)
            const pathDepth = item.path.split('/').length;
            if (pathDepth < 5) { // Limit to 5 levels deep
              const subResults = await this.searchInRepositoryFiles(owner, repo, query, item.path);
              results.push(...subResults);
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error(`❌ Error in fallback search for ${owner}/${repo}:`, error.message);
      return [];
    }
  }

  // Helper to determine if a file should be searched
  isSearchableFile(filename) {
    const searchableExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.php', '.rb', '.cs', '.cpp', '.c', '.h', '.json', '.yaml', '.yml', '.md', '.txt'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return searchableExtensions.includes(extension);
  }

  // Helper to determine if a directory should be searched
  isSearchableDirectory(dirname) {
    const skipDirectories = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__', 'vendor'];
    return !skipDirectories.includes(dirname.toLowerCase());
  }

  // Calculate a simple match score for search results
  calculateMatchScore(content, query) {
    const matches = (content.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    const contentLength = content.length;
    return matches / Math.max(contentLength / 1000, 1); // Normalize by content length
  }

  // OAuth operations
  static async exchangeCodeForToken(code, clientId, clientSecret) {
    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`OAuth error: ${error.response.status} - ${error.response.data}`);
      }
      throw error;
    }
  }
}

export default GitHubClient; 