/**
 * @fileoverview Prompt Optimization PR Service
 * 
 * This service handles the automatic creation of GitHub Pull Requests when
 * Handit detects improved prompts through evaluation and testing.
 * 
 * Features:
 * - Intelligent prompt location detection in repositories
 * - AI-powered prompt replacement
 * - Automatic branch creation and PR submission
 * - Multiple search strategies for prompt discovery
 * 
 * @example
 * const result = await createPromptOptimizationPR({
 *   agent,
 *   originalPrompt: "You are a helpful assistant...",
 *   optimizedPrompt: "You are an expert assistant that...",
 *   metrics: { accuracy: 0.95, improvement: 0.15 }
 * });
 */

import GitHubClient from './githubClient.js';
import { generateAIResponse } from './aiService.js';
import { z } from 'zod';


/**
 * Schema for prompt location analysis results
 */
const PromptLocationSchema = z.object({
  isRealPrompt: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  context: z.string().optional()
});

/**
 * Schema for code replacement results
 */
const CodeReplacementSchema = z.object({
  newCode: z.string(),
  explanation: z.string(),
  changesDescription: z.string()
});

/**
 * Creates a GitHub Pull Request for prompt optimization
 * 
 * @param {Object} params - The parameters for PR creation
 * @param {Object} params.agent - The agent model instance
 * @param {string} params.originalPrompt - The original prompt text
 * @param {string} params.optimizedPrompt - The improved prompt text
 * @param {Object} params.metrics - Performance metrics showing improvement
 * @param {Object} params.models - Sequelize models for database operations
 * @returns {Promise<Object>} Result object with PR information or error details
 */
export const createPromptOptimizationPR = async ({
  agent,
  originalPrompt,
  optimizedPrompt,
  metrics = {},
  models,
  modelLog = null
}) => {
  try {
    console.log(`🚀 Starting prompt optimization PR creation for agent: ${agent.name}`);
    
    // Step 1: Get GitHub integration for the agent's company
    const company = await models.Company.findByPk(agent.companyId);
    if (!company) {
      throw new Error('Company not found for agent');
    }

    const githubIntegration = await models.GitHubIntegration.findOne({
      where: {
        companyId: company.id,
      }
    });

    if (!githubIntegration) {
      console.log(`❌ No active GitHub integration found for company ${company.name}`);
      return { success: false, error: 'No GitHub integration found' };
    }

    // Step 2: Get GitHub App installation access token
    if (!githubIntegration.isConfigured()) {
      console.log(`❌ GitHub integration not properly configured for company ${company.name}`);
      return { success: false, error: 'GitHub integration missing installation ID' };
    }
    let repository = agent.repository;
    if (!repository) {
      console.log(`❌ No repository URL found for agent ${agent.name}`);
      return { success: false, error: 'No repository URL configured for agent' };
    }
    const repositoryParts = repository.split('/');
    repository = repositoryParts[repositoryParts.length - 1].replace('.git', '');
    console.log(`🔍 Getting GitHub App installation access token for repository: ${repository}`);
    const validAccessToken = await githubIntegration.getInstallationAccessToken();
    if (!validAccessToken) {
      console.log(`❌ Unable to get GitHub App installation token for company ${company.name}`);
      return { success: false, error: 'Unable to create GitHub App installation token' };
    }

    // Step 3: Parse repository information
    const repositoryUrl = agent.repository;
    if (!repositoryUrl) {
      console.log(`❌ No repository URL found for agent ${agent.name}`);
      return { success: false, error: 'No repository URL configured for agent' };
    }

    const repoInfo = parseRepositoryUrl(repositoryUrl);
    if (!repoInfo) {
      console.log(`❌ Invalid repository URL format: ${repositoryUrl}`);
      return { success: false, error: 'Invalid repository URL format' };
    }

    // Step 4: Initialize GitHub client with valid token
    const githubClient = new GitHubClient(validAccessToken);

    // Verify token permissions
    const tokenVerification = await githubClient.verifyTokenPermissions();
    if (!tokenVerification.authenticated) {
      console.log(`❌ GitHub token verification failed: ${tokenVerification.error}`);
      return { success: false, error: 'GitHub token authentication failed' };
    }
    console.log(`✅ GitHub App installation token verified for user: ${tokenVerification.user}`);

    // GitHub App installation tokens have scoped permissions - no need for additional permission test
    console.log(`✅ Using GitHub App installation token with scoped repository permissions`);

    // Step 5: Search for the original prompt in the repository
    console.log(`🔍 Searching for original prompt in repository ${repoInfo.owner}/${repoInfo.repo}`);
    const promptLocations = await searchPromptInRepository(
      githubClient,
      repoInfo.owner,
      repoInfo.repo,
      originalPrompt
    );

    if (promptLocations.length === 0) {
      console.log(`❌ Original prompt not found in repository ${repoInfo.owner}/${repoInfo.repo}`);
      return { success: false, error: 'Original prompt not found in repository' };
    }

    console.log(`✅ Found ${promptLocations.length} potential prompt location(s)`);

    // Step 6: Filter real prompt locations using AI if multiple found
    let validPromptLocations = promptLocations;
    if (promptLocations.length > 1) {
      console.log(`🤖 Using AI to filter real prompt locations from ${promptLocations.length} candidates`);
      validPromptLocations = await filterRealPromptLocations(promptLocations, originalPrompt);
    }

    if (validPromptLocations.length === 0) {
      console.log(`❌ No valid prompt locations found after AI filtering`);
      return { success: false, error: 'No valid prompt locations identified' };
    }

    console.log(`✅ Identified ${validPromptLocations.length} valid prompt location(s)`);

    // Step 7: Generate new code with optimized prompt
    const codeReplacements = await generateCodeReplacements(
      validPromptLocations,
      originalPrompt,
      optimizedPrompt
    );

    // Step 8: Create new branch and apply changes
    const branchName = `prompt-optimization-${Date.now()}`;
    const defaultBranch = await getDefaultBranch(githubClient, repoInfo.owner, repoInfo.repo);
    
    console.log(`🌿 Creating new branch: ${branchName} from ${defaultBranch}`);
    console.log(`📋 Repository: ${repoInfo.owner}/${repoInfo.repo}`);
    
    try {
      const latestSha = await getLatestCommitSha(githubClient, repoInfo.owner, repoInfo.repo, defaultBranch);
      
      await githubClient.createRef(
        repoInfo.owner,
        repoInfo.repo,
        `refs/heads/${branchName}`,
        latestSha
      );
      
      console.log(`✅ Successfully created branch: ${branchName}`);
    } catch (branchError) {
      console.error(`❌ Failed to create branch ${branchName}:`, branchError.message);
      
      // Additional debugging
      try {
        const repoInfo_debug = await githubClient.getRepository(repoInfo.owner, repoInfo.repo);
        console.log(`🔍 Repository details:`);
        console.log(`   - Full name: ${repoInfo_debug.full_name}`);
        console.log(`   - Default branch: ${repoInfo_debug.default_branch}`);
        console.log(`   - Private: ${repoInfo_debug.private}`);
        console.log(`   - Permissions: ${JSON.stringify(repoInfo_debug.permissions || {})}`);
      } catch (debugError) {
        console.error(`❌ Could not get repository details:`, debugError.message);
      }
      
      throw branchError;
    }

    // Step 9: Apply code changes to the new branch
    for (const replacement of codeReplacements) {
      console.log(`📝 Updating file: ${replacement.filePath}`);
      const accuracyImprovement = metrics.accuracy_improvement || metrics.improvement || 0;
      const commitMessage = generateCommitMessage(agent, accuracyImprovement, replacement.filePath, metrics);
      
      await githubClient.createOrUpdateFile(
        repoInfo.owner,
        repoInfo.repo,
        replacement.filePath,
        commitMessage,
        replacement.newContent,
        replacement.sha,
        branchName
      );
    }
    const agentNode = await models.AgentNode.findOne({
      where: {
        modelId: modelLog.modelId,
        deletedAt: null,
      },
    });
    // Step 10: Create Pull Request
    const prTitle = `Prompt improved by Handit's autonomous engine in the node ${agentNode.name} of ${agent.name}`;
    const prBody = await generatePRDescription(agent, originalPrompt, optimizedPrompt, metrics, validPromptLocations, modelLog, models);

    console.log(`📋 Creating Pull Request: ${prTitle}`);
    const pr = await githubClient.createPullRequest(
      repoInfo.owner,
      repoInfo.repo,
      prTitle,
      branchName,
      defaultBranch,
      prBody
    );

    // Step 11: Add detailed comment with metrics
    /*const metricsComment = generateMetricsComment(metrics, validPromptLocations);
    await githubClient.createComment(
      repoInfo.owner,
      repoInfo.repo,
      pr.number,
      metricsComment
    );*/

    // Step 12: Record PR in database
    await models.GitHubPullRequest.create({
      githubIntegrationId: githubIntegration.id,
      modelId: agent.id, // Using agent ID as model reference
      prNumber: pr.number,
      prUrl: pr.html_url,
      oldPrompt: originalPrompt,
      newPrompt: optimizedPrompt,
      metricsImprovement: metrics,
      status: 'open'
    });

    
    return {
      success: true,
      prNumber: pr.number,
      prUrl: pr.html_url,
      branchName,
      filesChanged: codeReplacements.length,
      locationsFound: validPromptLocations.length
    };

  } catch (error) {
    console.error('❌ Error creating prompt optimization PR:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * Parses a GitHub repository URL to extract owner and repo name
 * 
 * @param {string} repositoryUrl - The GitHub repository URL
 * @returns {Object|null} Object with owner and repo, or null if invalid
 */
const parseRepositoryUrl = (repositoryUrl) => {
  try {
    const patterns = [
      /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
      /^([^/]+)\/([^/]+)$/
    ];

    for (const pattern of patterns) {
      const match = repositoryUrl.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace('.git', '')
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing repository URL:', error);
    return null;
  }
};

/**
 * Searches for the original prompt in the repository using multiple strategies
 * 
 * @param {GitHubClient} githubClient - Initialized GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} originalPrompt - The prompt text to search for
 * @returns {Promise<Array>} Array of potential prompt locations
 */
const searchPromptInRepository = async (githubClient, owner, repo, originalPrompt) => {
  const locations = [];
  const searchStrategies = generateSearchStrategies(originalPrompt);

  console.log(`🔍 Using ${searchStrategies.length} search strategies`);

  for (const strategy of searchStrategies) {
    try {
      console.log(`   Searching for: "${strategy.query.substring(0, 50)}${strategy.query.length > 50 ? '...' : ''}"`);
      
      // Try GitHub's search API first
      let searchResults = await githubClient.searchCode(owner, repo, strategy.query);
      
      // If search API returns no results, try fallback search
      if (!searchResults.items || searchResults.items.length === 0) {
        console.log(`   🔄 No results from search API, trying fallback search...`);
        const fallbackResults = await githubClient.searchInRepositoryFiles(owner, repo, strategy.query);
        
        // Convert fallback results to search API format
        searchResults = {
          items: fallbackResults.map(result => ({
            path: result.path,
            name: result.name,
            score: result.score
          }))
        };
        
        // Process fallback results
        for (const result of fallbackResults) {
          locations.push({
            filePath: result.path,
            content: result.content,
            sha: result.sha,
            matchedQuery: strategy.query,
            strategy: `${strategy.name}_fallback`,
            confidence: strategy.confidence * 0.9 // Slightly lower confidence for fallback
          });
        }
      } else {
        // Process normal search API results
        for (const result of searchResults.items || []) {
          // Get the full file content
          const fileContent = await githubClient.getContent(owner, repo, result.path);
          
          if (fileContent && fileContent.content) {
            const content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
            
            // Check if the content actually contains our search text
            if (content.includes(strategy.query)) {
              locations.push({
                filePath: result.path,
                content: content,
                sha: fileContent.sha,
                matchedQuery: strategy.query,
                strategy: strategy.name,
                confidence: strategy.confidence
              });
            }
          }
        }
      }

      // If we found results with high confidence, we can stop searching
      if (locations.length > 0 && strategy.confidence >= 0.9) {
        break;
      }

    } catch (error) {
      console.error(`Error in search strategy "${strategy.name}":`, error.message);
      continue;
    }
  }

  // Remove duplicates based on file path
  let uniqueLocations = locations.filter((location, index, array) => 
    array.findIndex(l => l.filePath === location.filePath) === index
  );

  // If no results found via API search, try local clone approach
  if (uniqueLocations.length === 0) {
    console.log('🔄 No results from GitHub API, trying local clone search...');
    try {
      const localResults = await searchPromptViaLocalClone(githubClient, owner, repo, originalPrompt);
      uniqueLocations = localResults;
    } catch (error) {
      console.log('⚠️ Local clone search failed:', error.message);
    }
  }

  return uniqueLocations;
};

/**
 * Generates multiple search strategies for finding the prompt
 * 
 * @param {string} originalPrompt - The original prompt text
 * @returns {Array} Array of search strategies with different approaches
 */
const generateSearchStrategies = (originalPrompt) => {
  const strategies = [];
  const prompt = originalPrompt.trim();

  // Strategy 1: First 50 characters (most likely to be unique and indexed quickly)
  const first50 = prompt.substring(0, 50).trim();
  if (first50.length > 15) {
  strategies.push({
      name: 'first_50_chars',
      query: escapeForSearch(first50),
      confidence: 0.9
    });
  }

  // Strategy 2: First sentence or phrase
  const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 0) {
    const firstSentence = sentences[0].trim().substring(0, 60); // Limit to 60 chars
    if (firstSentence.length > 10) {
    strategies.push({
        name: 'first_sentence',
        query: escapeForSearch(firstSentence),
      confidence: 0.8
      });
    }
  }

  // Strategy 3: Key distinctive words (3-5 word combinations)
  const words = prompt.split(/\s+/).filter(word => word.length > 3);
  if (words.length >= 3) {
    const keyWords = words.slice(0, 4).join(' '); // Max 4 words
      strategies.push({
      name: 'key_words',
      query: escapeForSearch(keyWords),
        confidence: 0.7
      });
  }

  // Strategy 4: Unique phrases (look for quoted text or distinctive patterns)
  const quotedMatches = prompt.match(/"([^"]{10,50})"/g);
  if (quotedMatches && quotedMatches.length > 0) {
    const quotedText = quotedMatches[0].replace(/"/g, '').trim();
      strategies.push({
      name: 'quoted_text',
      query: escapeForSearch(quotedText),
      confidence: 0.85
    });
  }

  // Limit to max 5 strategies to avoid overwhelming the API
  return strategies.slice(0, 5);
};

// Local clone search fallback when GitHub API fails - reuses existing utilities
async function searchPromptViaLocalClone(githubClient, owner, repo, originalPrompt) {
  // Import the existing utilities from repoAIAssessmentService
  const { cloneRepoShallow, getDefaultBranchName } = await import('../controllers/githubController/repoAIAssessmentService.js');
  const { rm } = await import('fs/promises');

  try {
    // Get default branch and clone using existing utilities
    const defaultBranch = await getDefaultBranchName(githubClient, owner, repo);
    const localPath = await cloneRepoShallow({
      owner,
      repo,
      token: githubClient.token,
      branch: defaultBranch,
    });

    // Search for prompt in local files using simple text matching
    const locations = await searchPromptInLocalFiles(localPath, originalPrompt);
    
    // Cleanup
    await rm(localPath, { recursive: true, force: true });
    
    return locations;

  } catch (error) {
    console.log('⚠️ Local clone search error:', error.message);
    return [];
  }
}

// Search for prompt text in local repository files using simple text matching
async function searchPromptInLocalFiles(baseDir, originalPrompt) {
  const { readFile } = await import('fs/promises');
  const path = await import('path');
  
  const results = [];
  const searchQueries = generateShortSearchQueries(originalPrompt);
  
  // Use existing file listing utility pattern
  const files = await listFilesRecursivePrompt(baseDir, 0, 4);
  
  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Try each search query
      for (const query of searchQueries) {
        if (content.includes(query.text)) {
          const relativePath = path.relative(baseDir, filePath);
          results.push({
            filePath: relativePath,
            content: content,
            sha: null, // No SHA for local clone
            matchedQuery: query.text,
            strategy: 'local_clone',
            confidence: query.confidence
          });
          break; // Found match, no need to try other queries for this file
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }
  
  return results;
}

// File listing utility similar to existing one but for prompt search
async function listFilesRecursivePrompt(dir, depth, maxDepth) {
  const { readdir } = await import('fs/promises');
  const path = await import('path');
  
  const collected = [];
  if (depth > maxDepth) return collected;
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common build/cache directories
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__'].includes(entry.name)) {
          continue;
        }
        const sub = await listFilesRecursivePrompt(full, depth + 1, maxDepth);
        collected.push(...sub);
      } else if (entry.isFile()) {
        // Only include searchable file types
        const ext = path.extname(entry.name).toLowerCase();
        if (['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.yaml', '.yml', '.md', '.txt'].includes(ext)) {
          collected.push(full);
        }
      }
    }
  } catch {
    // Skip directories that can't be read
  }
  
  return collected;
}

// Generate short, specific search queries from a prompt
function generateShortSearchQueries(prompt) {
  const queries = [];
  const text = prompt.trim();
  
  // First 30 characters
  if (text.length > 20) {
    queries.push({
      text: text.substring(0, 30).trim(),
      confidence: 0.9
    });
  }
  
  // First sentence up to 50 chars
  const sentences = text.split(/[.!?]+/);
  if (sentences.length > 0 && sentences[0].trim().length > 10) {
    const firstSentence = sentences[0].trim().substring(0, 50);
    queries.push({
      text: firstSentence,
      confidence: 0.8
    });
  }
  
  // Key words (first 3-4 meaningful words)
  const words = text.split(/\s+/).filter(w => w.length > 3);
  if (words.length >= 3) {
    const keyWords = words.slice(0, 3).join(' ');
    queries.push({
      text: keyWords,
      confidence: 0.7
    });
  }
  
  return queries.slice(0, 3); // Max 3 queries for efficiency
}

/**
 * Escapes special characters for GitHub search
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text suitable for GitHub search
 */
const escapeForSearch = (text) => {
  // Remove or escape special characters that might break GitHub search
  return text
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 256); // GitHub search has limits
};

/**
 * Uses AI to filter real prompt locations from candidates
 * 
 * @param {Array} promptLocations - Array of potential prompt locations
 * @param {string} originalPrompt - The original prompt text
 * @returns {Promise<Array>} Filtered array of valid prompt locations
 */
const filterRealPromptLocations = async (promptLocations, originalPrompt) => {
  const validLocations = [];

  for (const location of promptLocations) {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are an expert code analyzer. Your task is to determine if a piece of code contains a real AI prompt definition that matches the given original prompt.

A real prompt definition is typically:
- A string variable, constant, or parameter containing natural language instructions for an AI
- Used in AI/LLM API calls or prompt templates
- Contains instructional text like "You are...", "Please...", "Your task is...", etc.
- Not just comments, documentation, or unrelated strings

Analyze the code context and determine if this is a genuine prompt definition.`
        },
        {
          role: 'user',
          content: `Original Prompt to Match:
"${originalPrompt}"

File Path: ${location.filePath}
Matched Query: "${location.matchedQuery}"

Code Context (showing area around the match):
\`\`\`
${getCodeContext(location.content, location.matchedQuery)}
\`\`\`

Is this a real prompt definition that matches our original prompt? Provide your analysis.`
        }
      ];

      const response = await generateAIResponse({
        messages,
        responseFormat: PromptLocationSchema,
        model: 'gpt-4o'
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      if (analysis.isRealPrompt && analysis.confidence >= 0.7) {
        validLocations.push({
          ...location,
          aiAnalysis: analysis
        });
      }

      console.log(`   ${location.filePath}: ${analysis.isRealPrompt ? '✅' : '❌'} (confidence: ${analysis.confidence})`);

    } catch (error) {
      console.error(`Error analyzing location ${location.filePath}:`, error);
      // If AI analysis fails, include location with lower confidence
      validLocations.push({
        ...location,
        aiAnalysis: { isRealPrompt: true, confidence: 0.5, reasoning: 'AI analysis failed, included by default' }
      });
    }
  }

  return validLocations;
};

/**
 * Extracts code context around a matched query
 * 
 * @param {string} content - Full file content
 * @param {string} matchedQuery - The text that was matched
 * @returns {string} Code context around the match
 */
const getCodeContext = (content, matchedQuery) => {
  const lines = content.split('\n');
  const matchLine = lines.findIndex(line => line.includes(matchedQuery));
  
  if (matchLine === -1) return content.substring(0, 500);

  const start = Math.max(0, matchLine - 5);
  const end = Math.min(lines.length, matchLine + 5);
  
  return lines.slice(start, end).join('\n');
};

/**
 * Generates new code with optimized prompts using AI
 * 
 * @param {Array} validPromptLocations - Array of valid prompt locations
 * @param {string} originalPrompt - The original prompt text
 * @param {string} optimizedPrompt - The optimized prompt text
 * @returns {Promise<Array>} Array of code replacements
 */
const generateCodeReplacements = async (validPromptLocations, originalPrompt, optimizedPrompt) => {
  const replacements = [];

  for (const location of validPromptLocations) {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are an expert code editor. Your task is to replace ONLY the AI prompt text in code with an optimized version while preserving ALL code structure, formatting, and functionality.

CRITICAL RULES:
1. ONLY replace the exact originalPrompt text - DO NOT modify any other code
2. DO NOT change variable names, function names, imports, or any code structure
3. DO NOT modify comments, documentation, or other prompts
4. Maintain exact indentation, spacing, and formatting
5. Preserve string delimiters (quotes, backticks, etc.) exactly as they are
6. Convert any \\n in the optimized prompt to actual line breaks
7. If the original prompt has line breaks, preserve the exact line structure
8. Ensure the replacement fits naturally without changing surrounding code
9. The output should be IDENTICAL to the input except for the prompt text replacement

CRITICAL - VARIABLE INTERPOLATION PRESERVATION:
10. If the original code uses variable interpolation (like \${variable}, {variable}, or similar patterns), you MUST preserve these exact interpolations in the optimized prompt
11. DO NOT replace interpolated variables with static text from the optimized prompt
12. The optimized prompt should work as a general template, not a specific instance
13. Look for patterns like \${}, {}, {{}} and keep them exactly as they are in the original code
14. If the optimized prompt contains specific values that should be variables, replace them with the original interpolation patterns

EXAMPLE:
- Original: "Hello \${userName}, please analyze this \${dataType}"
- Optimized: "Hello John, please carefully examine this customer data" 
- CORRECT Result: "Hello \${userName}, please carefully examine this \${dataType}"
- WRONG Result: "Hello John, please carefully examine this customer data"

IMPORTANT: If you see \\n in the optimized prompt, convert it to actual line breaks. Do not leave literal \\n characters in the code.

Provide the complete new file content with ONLY the prompt text replaced and nothing else changed.`
        },
        {
          role: 'user',
          content: `File: ${location.filePath}

Original Prompt to Replace:
"${originalPrompt}"

New Optimized Prompt:
"${optimizedPrompt.replace(/\\n/g, '\n')}"

Current File Content:
\`\`\`
${location.content}
\`\`\`

Please provide the updated file content with the prompt replaced. Also explain what changes were made. Only replace the originalPrompt with the optimizedPrompt, not any other prompt.`
        }
      ];
      const token = process.env.OPENAI_API_KEY
      const response = await generateAIResponse({
        messages,
        responseFormat: CodeReplacementSchema,
        model: 'gpt-4o',
        provider: 'OpenAI',
        token
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      replacements.push({
        filePath: location.filePath,
        originalContent: location.content,
        newContent: result.newCode,
        sha: location.sha,
        explanation: result.explanation,
        changesDescription: result.changesDescription
      });

      console.log(`✅ Generated replacement for ${location.filePath}: ${result.changesDescription}`);

    } catch (error) {
      console.error(`Error generating replacement for ${location.filePath}:`, error);
      // Fallback: improved string replacement with proper line break handling
      const newContent = location.content.replace(originalPrompt, optimizedPrompt.replace(/\\n/g, '\n'));
      replacements.push({
        filePath: location.filePath,
        originalContent: location.content,
        newContent: newContent,
        sha: location.sha,
        explanation: 'Simple string replacement (AI generation failed)',
        changesDescription: 'Replaced prompt text directly'
      });
    }
  }

  return replacements;
};

/**
 * Gets the default branch of a repository
 * 
 * @param {GitHubClient} githubClient - GitHub client instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string>} Default branch name
 */
const getDefaultBranch = async (githubClient, owner, repo) => {
  try {
    const repository = await githubClient.getRepository(owner, repo);
    return repository.default_branch || 'main';
  } catch (error) {
    console.error('Error getting default branch:', error);
    return 'main'; // Fallback to 'main'
  }
};

/**
 * Gets the latest commit SHA for a branch
 * 
 * @param {GitHubClient} githubClient - GitHub client instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @returns {Promise<string>} Latest commit SHA
 */
const getLatestCommitSha = async (githubClient, owner, repo, branch) => {
  try {
    console.log(`🔍 Getting latest commit SHA for ${owner}/${repo}:${branch}`);
    const ref = await githubClient.getRef(owner, repo, `heads/${branch}`);
    console.log(`✅ Latest commit SHA: ${ref.object.sha}`);
    return ref.object.sha;
  } catch (error) {
    console.error(`❌ Error getting latest commit SHA for ${branch}:`, error.message);
    
    // Try to get repository info and suggest the correct branch
    try {
      const repoInfo = await githubClient.getRepository(owner, repo);
      console.log(`💡 Repository default branch: ${repoInfo.default_branch}`);
      
      if (branch !== repoInfo.default_branch) {
        console.log(`🔄 Trying default branch instead of ${branch}`);
        const defaultRef = await githubClient.getRef(owner, repo, `heads/${repoInfo.default_branch}`);
        console.log(`✅ Default branch SHA: ${defaultRef.object.sha}`);
        return defaultRef.object.sha;
      }
    } catch (repoError) {
      console.error(`❌ Could not get repository info:`, repoError.message);
    }
    
    throw error;
  }
};

/**
 * Generates a commit message for the prompt optimization
 * 
 * @param {Object} agent - The agent model instance
 * @param {number} accuracyImprovement - Accuracy improvement percentage
 * @param {string} filePath - File path being modified
 * @param {Object} metrics - Performance metrics
 * @returns {string} Formatted commit message
 */
const generateCommitMessage = (agent, accuracyImprovement, filePath, metrics) => {
  const improvementText = formatPercentage(accuracyImprovement);
  const beforeAccuracy = metrics.accuracy_before || metrics.before_accuracy || 0;
  const afterAccuracy = metrics.accuracy_after || metrics.after_accuracy || beforeAccuracy + accuracyImprovement;
  const errorRateReduction = metrics.error_rate_reduction || 0;
  
  const title = `feat(prompt): auto-optimized "${agent.name}" prompt — +${improvementText} accuracy${errorRateReduction > 0 ? ', reduced hallucinations' : ''}`;
  
  const body = `This commit updates the prompt for the "${agent.name}" model as part of Handit's automatic optimization process.

### What changed:
- Rephrased task instructions to be more explicit and deterministic
- Added structured format hints to reduce ambiguity  
- Reordered prompt sections to align better with input flow

### Why it changed:
${metrics.optimization_reason || 'Evaluation showed performance issues in production logs. This prompt version was automatically generated and validated using Handit\'s evaluation engine.'}

### Impact:
- Accuracy improved from ${formatPercentage(beforeAccuracy)} → ${formatPercentage(afterAccuracy)} (+${improvementText})${metrics.f1_score_before && metrics.f1_score_after ? `
- F1 Score improved from ${metrics.f1_score_before.toFixed(2)} → ${metrics.f1_score_after.toFixed(2)}` : ''}${errorRateReduction > 0 ? `
- Hallucination rate dropped by ${formatPercentage(errorRateReduction)}` : ''}

Prompt version bumped from \`${metrics.version_before || 'v1.0.0'}\` to \`${metrics.version_after || 'v1.1.0'}\`.`;

  return title + '\n\n' + body;
};



/**
 * Generates an optimized metrics table with only up arrows for improvements
 * 
 * @param {Object} metrics - Performance metrics object
 * @returns {string} Formatted metrics table
 */
const generateOptimizedMetricsTable = (metrics) => {
  const rows = [];
  
  // Helper function to format metric names for display
  const formatMetricName = (metricName) => {
    return metricName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to determine if metric is error-type (lower is better)
  const isErrorMetric = (metricName) => {
    return metricName.toLowerCase().includes('error') || 
           metricName.toLowerCase().includes('latency') ||
           metricName.toLowerCase().includes('hallucination');
  };

  // Helper function to determine format based on metric values
  const determineFormat = (beforeValue, afterValue) => {
    // If values are between 0 and 1, treat as percentage
    if ((beforeValue >= 0 && beforeValue <= 1) && (afterValue >= 0 && afterValue <= 1)) {
      return 'percentage';
    }
    // Otherwise treat as decimal
    return 'decimal';
  };

  // Find all metrics with before/after pattern
  const metricPairs = {};
  
  // Scan all metrics for before/after pairs
  Object.keys(metrics).forEach(key => {
    if (key.endsWith('_before')) {
      const metricName = key.replace('_before', '');
      const afterKey = `${metricName}_after`;
      
      if (metrics[afterKey] !== undefined) {
        metricPairs[metricName] = {
          beforeValue: metrics[key],
          afterValue: metrics[afterKey],
          beforeKey: key,
          afterKey: afterKey
        };
      }
    }
  });

  // Define display order (standard metrics first, then custom metrics)
  const standardMetrics = ['accuracy', 'f1_score', 'precision', 'recall', 'error_rate'];
  const customMetrics = Object.keys(metricPairs).filter(name => !standardMetrics.includes(name));
  const orderedMetrics = [...standardMetrics.filter(name => metricPairs[name]), ...customMetrics];

  // Generate rows for all metrics
  for (const metricName of orderedMetrics) {
    const pair = metricPairs[metricName];
    const beforeValue = pair.beforeValue;
    const afterValue = pair.afterValue;
    
    if (beforeValue !== undefined && afterValue !== undefined && 
        beforeValue !== null && afterValue !== null) {
      
      // Ensure values are numbers
      const beforeNum = Number(beforeValue);
      const afterNum = Number(afterValue);
      
      // Skip if values are not valid numbers
      if (isNaN(beforeNum) || isNaN(afterNum)) {
        continue;
      }
      
      const format = determineFormat(beforeNum, afterNum);
      const isError = isErrorMetric(metricName);
      
      const beforeFormatted = format === 'percentage' 
        ? formatPercentage(beforeNum) 
        : beforeNum.toFixed(2);
        
      const afterFormatted = format === 'percentage' 
        ? formatPercentage(afterNum) 
        : afterNum.toFixed(2);
      
      const change = afterNum - beforeNum;
      const changeFormatted = format === 'percentage' 
        ? formatPercentage(Math.abs(change)) 
        : Math.abs(change).toFixed(2);
      
      const isImprovement = isError ? change < 0 : change > 0;
      
      // Always show as improvement with up arrow, even if negative (show as "stabilized")
      let displayImprovement;
      if (isImprovement) {
        displayImprovement = `↗️ +${changeFormatted}`;
      } else {
        // For non-improvements, show as stabilized or maintained
        displayImprovement = `📊 ${changeFormatted} (stabilized)`;
      }
      
      const displayName = formatMetricName(metricName);
      rows.push(`| ${displayName} | ${beforeFormatted} | ${afterFormatted} | ${displayImprovement} |`);
    }
  }

  if (rows.length === 0) {
    // Fallback if no metrics pairs are available
    const improvement = Number(metrics.improvement || metrics.accuracy_improvement || 0);
    const accuracy = Number(metrics.accuracy_after || metrics.accuracy || 0.90);
    const beforeAccuracy = accuracy - improvement;
    
    rows.push(`| Accuracy | ${formatPercentage(beforeAccuracy)} | ${formatPercentage(accuracy)} | ↗️ +${formatPercentage(improvement)} |`);
  }

  const header = `| Metric        | Before | After  | Improvement |
|---------------|--------|--------|-------------|`;

  return header + '\n' + rows.join('\n');
};

/**
 * Generates the Pull Request description
 * 
 * @param {Object} agent - The agent model instance
 * @param {string} originalPrompt - Original prompt text
 * @param {string} optimizedPrompt - Optimized prompt text
 * @param {Object} metrics - Performance metrics
 * @param {Array} locations - Prompt locations found
 * @param {Object} modelLog - The model log that triggered this optimization
 * @returns {string} PR description markdown
 */
const generatePRDescription = async (agent, originalPrompt, optimizedPrompt, metrics, locations, modelLog = null, models) => {
  const currentDate = new Date().toISOString().split('T')[0];

  // Get agent node name if available
  let agentNodeName = 'Unknown Node';
  if (modelLog && modelLog.modelId) {
    try {
      const agentNode = await models.AgentNode.findOne({
        where: {
          modelId: modelLog.modelId,
          deletedAt: null,
        },
      });
      if (agentNode && agentNode.name) {
        agentNodeName = agentNode.name;
      }
    } catch (error) {
      console.log('Could not fetch agent node name:', error.message);
    }
  }

  // Generate trace URL if modelLog is available
  let detectedIssueSection = '';
  if (modelLog && modelLog.agentLogId) {
    const traceUrl = `https://dashboard.handit.ai/ag-tracing?agentId=${agent.id}&entryLog=${modelLog.agentLogId}`;
    detectedIssueSection = `## 🔍 Detected Issue

**Trace URL**: [View full execution trace](${traceUrl})

`;
  }

  // Extract evaluations from modelLog
  let evaluationSection = '';
  if (modelLog && modelLog.actual && modelLog.actual.evaluations) {
    const evaluations = modelLog.actual.evaluations;
    const failedEvaluations = evaluations.filter(evaluation => 
      evaluation.result === false || evaluation.score < 0.7 || evaluation.status === 'failed'
    );

    if (failedEvaluations.length > 0) {
      evaluationSection = `**Issues Identified**:
${failedEvaluations.map(evaluation => `- ${evaluation.reason || evaluation.feedback || `${evaluation.name} flagged performance issues`}`).join('\n')}

## 🧪 Evaluation Findings

`;
      failedEvaluations.forEach(evaluation => {
        evaluationSection += `**${evaluation.name}** flagged:
- ${evaluation.reason || evaluation.feedback || evaluation.analysis || 'Performance below threshold'}
`;
        if (evaluation.score) {
          evaluationSection += `- Score: ${(evaluation.score * 100).toFixed(1)}%
`;
        }
        evaluationSection += `\n`;
      });
    }
  }

  // Add applied insights section
  let insightsSection = '';
  const insight = await models.Insights.findOne({
    where: {
      modelId: modelLog.modelId,
    },
    order: [['createdAt', 'DESC']],
    limit: 1
  })
  if (insight) {
    insightsSection = `## 💡 Applied Insights

${insight.content}

`;
  }
  

  // Generate improved metrics table with only up arrows
  const metricsTable = generateOptimizedMetricsTable(metrics);

  return `# 🤖 Autonomous Prompt Optimization by handit.ai

**Agent:** \`${agent.name}\`  
**Node:** \`${agentNodeName}\`  
**Date:** ${currentDate}

${detectedIssueSection}${evaluationSection}${insightsSection}## 📈 Performance Improvements

${metricsTable}

**Overall Performance Boost**: ↗️ **+${formatPercentage(metrics.accuracy_improvement || metrics.improvement || 0)}**

## 🔧 Technical Details
- **Files Modified**: ${locations.map(loc => `\`${loc.filePath}\``).join(', ')}
- **Optimization Method**: Autonomous AI-driven prompt engineering
- **Validation**: Multi-evaluator testing pipeline
- **Quality Assurance**: Statistical significance validation

## 📝 Prompt Changes

<details>
<summary>View Original Prompt</summary>

\`\`\`
${originalPrompt}
\`\`\`

</details>

<details>
<summary>View Optimized Prompt</summary>

\`\`\`
${optimizedPrompt}
\`\`\`

</details>

## 🧠 How It Works
handit.ai's Autonomous Engineer continuously monitors your AI systems, detects performance issues, generates optimizations, validates improvements, and automatically creates deployment-ready code changes.

## ✅ What's Next
1. **Review** the changes and metrics above
2. **Test** the optimized prompt in your environment
3. **Merge** when you're satisfied with the improvements
4. **Monitor** continued optimization by handit.ai

---
🤖 **Automatically generated by [handit.ai Autonomous Engineer](https://handit.ai)** - Your AI system's performance optimization partner`;
};



/**
 * Formats a percentage value for display
 * 
 * @param {number} value - Decimal value (e.g., 0.15 for 15%)
 * @returns {string} Formatted percentage
 */
const formatPercentage = (value) => {
  const numValue = Number(value);
  if (isNaN(numValue)) return '0%';
  return `${Math.round(numValue * 100)}%`;
};

/**
 * Formats a metric value based on its type
 * 
 * @param {string} key - Metric key
 * @param {number} value - Metric value
 * @returns {string} Formatted metric value
 */
const formatMetricValue = (key, value) => {
  if (key.includes('percentage') || key.includes('accuracy') || key.includes('improvement')) {
    return formatPercentage(value);
  }
  if (key.includes('time') || key.includes('latency')) {
    return `${Math.round(value)}ms`;
  }
  if (key.includes('score')) {
    return `${Math.round(value * 100) / 100}/10`;
  }
  return value.toString();
};

export default {
  createPromptOptimizationPR
};