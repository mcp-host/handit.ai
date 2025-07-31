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
  models
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

    // Check if token is expired
    if (githubIntegration.isTokenExpired()) {
      console.log(`❌ GitHub token expired for company ${company.name}`);
      return { success: false, error: 'GitHub token expired' };
    }

    // Step 2: Parse repository information
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

    // Step 3: Initialize GitHub client
    const githubClient = new GitHubClient(githubIntegration.accessToken);

    // Verify token permissions
    const tokenVerification = await githubClient.verifyTokenPermissions();
    if (!tokenVerification.authenticated) {
      console.log(`❌ GitHub token verification failed: ${tokenVerification.error}`);
      return { success: false, error: 'GitHub token authentication failed' };
    }
    console.log(`✅ GitHub token verified for user: ${tokenVerification.user}`);

    // Skip permission test for now - GitHub Apps have different permission model
    console.log(`⚠️  Skipping permission test - proceeding with GitHub App token`);

    // Step 4: Search for the original prompt in the repository
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

    // Step 5: Filter real prompt locations using AI if multiple found
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

    // Step 6: Generate new code with optimized prompt
    const codeReplacements = await generateCodeReplacements(
      validPromptLocations,
      originalPrompt,
      optimizedPrompt
    );

    console.log(codeReplacements);

    // Step 7: Create new branch and apply changes
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

    // Step 8: Apply code changes to the new branch
    for (const replacement of codeReplacements) {
      console.log(`📝 Updating file: ${replacement.filePath}`);
      await githubClient.createOrUpdateFile(
        repoInfo.owner,
        repoInfo.repo,
        replacement.filePath,
        `Optimize prompt in ${replacement.filePath}\n\nImproved prompt performance based on Handit evaluation metrics.`,
        replacement.newContent,
        replacement.sha,
        branchName
      );
    }

    // Step 9: Create Pull Request
    const prTitle = `🚀 Optimize AI Prompt - Improved Performance by ${formatPercentage(metrics.improvement || 0)}`;
    const prBody = generatePRDescription(originalPrompt, optimizedPrompt, metrics, validPromptLocations);

    console.log(`📋 Creating Pull Request: ${prTitle}`);
    const pr = await githubClient.createPullRequest(
      repoInfo.owner,
      repoInfo.repo,
      prTitle,
      branchName,
      defaultBranch,
      prBody
    );

    // Step 10: Add detailed comment with metrics
    const metricsComment = generateMetricsComment(metrics, validPromptLocations);
    await githubClient.createComment(
      repoInfo.owner,
      repoInfo.repo,
      pr.number,
      metricsComment
    );

    // Step 11: Record PR in database
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
      /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
      /^([^\/]+)\/([^\/]+)$/
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
  const uniqueLocations = locations.filter((location, index, array) => 
    array.findIndex(l => l.filePath === location.filePath) === index
  );

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

  // Strategy 1: Full prompt (highest confidence)
  strategies.push({
    name: 'full_prompt',
    query: escapeForSearch(prompt),
    confidence: 1.0
  });

  // Strategy 2: First half of prompt
  const firstHalf = prompt.substring(0, Math.floor(prompt.length / 2));
  if (firstHalf.length > 20) {
    strategies.push({
      name: 'first_half',
      query: escapeForSearch(firstHalf),
      confidence: 0.8
    });
  }

  // Strategy 3: Last half of prompt
  const lastHalf = prompt.substring(Math.floor(prompt.length / 2));
  if (lastHalf.length > 20) {
    strategies.push({
      name: 'last_half',
      query: escapeForSearch(lastHalf),
      confidence: 0.8
    });
  }

  // Strategy 4: First quarter (for very long prompts)
  if (prompt.length > 200) {
    const firstQuarter = prompt.substring(0, Math.floor(prompt.length / 4));
    if (firstQuarter.length > 30) {
      strategies.push({
        name: 'first_quarter',
        query: escapeForSearch(firstQuarter),
        confidence: 0.6
      });
    }
  }

  // Strategy 5: Key phrases (extract meaningful sentences)
  const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length > 0) {
    const keyPhrase = sentences[0].trim();
    if (keyPhrase.length > 15) {
      strategies.push({
        name: 'key_phrase',
        query: escapeForSearch(keyPhrase),
        confidence: 0.7
      });
    }
  }

  return strategies;
};

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
          content: `You are an expert code editor. Your task is to replace an AI prompt in code with an optimized version while preserving all code structure, formatting, and functionality.

Rules:
1. Only replace the specific prompt text, not variable names, function calls, or code structure
2. Maintain exact indentation and formatting
3. Preserve string delimiters (quotes, backticks, etc.)
4. Keep all surrounding code exactly as is
5. If the prompt spans multiple lines, maintain the line structure
6. Ensure the replacement fits naturally in the existing code context

Provide the complete new file content with only the prompt text replaced.`
        },
        {
          role: 'user',
          content: `File: ${location.filePath}

Original Prompt to Replace:
"${originalPrompt}"

New Optimized Prompt:
"${optimizedPrompt}"

Current File Content:
\`\`\`
${location.content}
\`\`\`

Please provide the updated file content with the prompt replaced. Also explain what changes were made.`
        }
      ];
      const token = process.env.OPENAI_API_KEY
      const response = await generateAIResponse({
        messages,
        responseFormat: CodeReplacementSchema,
        model: 'gpt-4o-mini',
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
      // Fallback: simple string replacement
      const newContent = location.content.replace(originalPrompt, optimizedPrompt);
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
 * Generates the Pull Request description
 * 
 * @param {string} originalPrompt - Original prompt text
 * @param {string} optimizedPrompt - Optimized prompt text
 * @param {Object} metrics - Performance metrics
 * @param {Array} locations - Prompt locations found
 * @returns {string} PR description markdown
 */
const generatePRDescription = (originalPrompt, optimizedPrompt, metrics, locations) => {
  const improvement = metrics.improvement || 0;
  const accuracy = metrics.accuracy || 0;

  return `## 🚀 Automated Prompt Optimization by Handit

This Pull Request contains an optimized AI prompt that has been automatically tested and validated to improve performance.

### 📊 Performance Improvements

- **Overall Improvement**: ${formatPercentage(improvement)}
- **Current Accuracy**: ${formatPercentage(accuracy)}
- **Files Modified**: ${locations.length}

### 🔍 Changes Made

${locations.map(loc => `- \`${loc.filePath}\``).join('\n')}

### 📝 Prompt Changes

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

### 🤖 About This Optimization

This prompt optimization was automatically generated by Handit's AI evaluation system. The new prompt has been:

1. ✅ **Tested** against real production data
2. ✅ **Validated** by multiple evaluation metrics  
3. ✅ **Verified** to improve performance
4. ✅ **Applied** with precision to maintain code integrity

### 🔗 Learn More

- [Handit Documentation](https://docs.handit.ai)
- [Prompt Optimization Guide](https://docs.handit.ai/prompt-optimization)

---

*This PR was automatically created by [Handit](https://handit.ai) - AI-powered prompt optimization platform.*`;
};

/**
 * Generates a detailed metrics comment for the PR
 * 
 * @param {Object} metrics - Performance metrics object
 * @param {Array} locations - Array of prompt locations
 * @returns {string} Formatted metrics comment
 */
const generateMetricsComment = (metrics, locations) => {
  const metricsEntries = Object.entries(metrics)
    .filter(([key, value]) => typeof value === 'number')
    .map(([key, value]) => `- **${key.charAt(0).toUpperCase() + key.slice(1)}**: ${formatMetricValue(key, value)}`)
    .join('\n');

  return `## 📈 Detailed Performance Metrics

${metricsEntries}

### 🎯 Optimization Details

- **Prompt Locations Found**: ${locations.length}
- **Search Strategies Used**: ${[...new Set(locations.map(l => l.strategy))].join(', ')}
- **AI Analysis Confidence**: ${Math.round(locations.reduce((sum, l) => sum + (l.aiAnalysis?.confidence || 0), 0) / locations.length * 100)}%

### 📋 Files Modified

${locations.map(loc => `
**${loc.filePath}**
- Strategy: ${loc.strategy}
- Confidence: ${Math.round((loc.aiAnalysis?.confidence || 0) * 100)}%
- Analysis: ${loc.aiAnalysis?.reasoning || 'N/A'}
`).join('\n')}

---

*Metrics calculated from ${metrics.totalEvaluations || 'multiple'} evaluations using Handit's evaluation framework.*`;
};

/**
 * Formats a percentage value for display
 * 
 * @param {number} value - Decimal value (e.g., 0.15 for 15%)
 * @returns {string} Formatted percentage
 */
const formatPercentage = (value) => {
  return `${Math.round(value * 100)}%`;
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