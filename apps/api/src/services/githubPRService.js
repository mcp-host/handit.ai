import GitHubClient from './githubClient.js';
import db from '../../models/index.js';
const { GitHubIntegration, GitHubPullRequest } = db;

/**
 * Create a GitHub pull request for prompt improvement
 */
export const createPromptImprovementPR = async ({
  modelId,
  oldPrompt,
  newPrompt,
  metricsImprovement,
  companyId
}) => {
  try {
    // Find active GitHub integration for the company
    const integration = await GitHubIntegration.findOne({
      where: {
        companyId,
        active: true,
      },
    });

    if (!integration || !integration.isConfigured()) {
      console.log('No active GitHub integration found for company:', companyId);
      return null;
    }

    // Check if token is expired
    if (integration.isTokenExpired()) {
      console.log('GitHub token expired for integration:', integration.id);
      return null;
    }

    const githubClient = new GitHubClient(integration.accessToken);

    // Create a new branch for the PR
    const branchName = `prompt-optimization-${Date.now()}`;
    
    // Get the current file content and SHA
    const currentFile = await githubClient.getContent(
      integration.repositoryOwner,
      integration.repositoryName,
      integration.promptFilePath,
      integration.branchName
    );

    // Get the base branch reference
    const baseRef = await githubClient.getRef(
      integration.repositoryOwner,
      integration.repositoryName,
      `heads/${integration.branchName}`
    );

    // Create new branch
    await githubClient.createRef(
      integration.repositoryOwner,
      integration.repositoryName,
      `refs/heads/${branchName}`,
      baseRef.object.sha
    );

    // Update the prompt file with new content
    await githubClient.createOrUpdateFile(
      integration.repositoryOwner,
      integration.repositoryName,
      integration.promptFilePath,
      newPrompt,
      '🚀 Optimize prompt based on handit.ai evaluation data',
      currentFile.sha,
      branchName
    );

    // Calculate improvement percentage
    const improvementPercentage = calculateOverallImprovement(metricsImprovement);

    // Create pull request
    const pr = await githubClient.createPullRequest(
      integration.repositoryOwner,
      integration.repositoryName,
      `🚀 Prompt Optimization by handit.ai (+${improvementPercentage.toFixed(1)}% improvement)`,
      branchName,
      integration.branchName,
      generatePRDescription({
        oldPrompt,
        newPrompt,
        metricsImprovement,
        improvementPercentage,
        promptFilePath: integration.promptFilePath,
      })
    );

    // Add a comment with detailed metrics
    await githubClient.createComment(
      integration.repositoryOwner,
      integration.repositoryName,
      pr.number,
      generateMetricsComment(metricsImprovement)
    );

    // Store PR information in database
    const githubPR = await GitHubPullRequest.create({
      githubIntegrationId: integration.id,
      modelId,
      prNumber: pr.number,
      prUrl: pr.html_url,
      oldPrompt,
      newPrompt,
      metricsImprovement,
      status: 'open',
    });

    console.log(`Created GitHub PR #${pr.number} for model ${modelId}`);
    
    return {
      pr,
      githubPR,
      integration,
    };
  } catch (error) {
    console.error('Error creating GitHub PR:', error);
    throw error;
  }
};

/**
 * Generate PR description
 */
function generatePRDescription({
  oldPrompt,
  newPrompt,
  metricsImprovement,
  improvementPercentage,
  promptFilePath,
}) {
  const { before, after, improvement } = metricsImprovement;
  
  let description = `# 🚀 Prompt Optimization by handit.ai

## Summary
This PR contains an optimized prompt that improves model performance by **${improvementPercentage.toFixed(1)}%** based on real evaluation data from handit.ai.

## Changes
- **File**: \`${promptFilePath}\`
- **Improvement**: +${improvementPercentage.toFixed(1)}% overall performance
- **Evaluation Method**: Automated testing with multiple evaluators

## Metrics Improvement

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|`;

  Object.keys(improvement || {}).forEach(metric => {
    const beforeVal = before?.[metric] || 0;
    const afterVal = after?.[metric] || 0;
    const improvementVal = improvement[metric] || 0;
    
    description += `\n| ${metric} | ${beforeVal.toFixed(2)} | ${afterVal.toFixed(2)} | ${improvementVal > 0 ? '+' : ''}${improvementVal.toFixed(2)}% |`;
  });

  description += `

## How it works
handit.ai continuously evaluates your prompts using multiple AI evaluators and automatically generates improvements when better performance is detected. This optimization was generated based on comprehensive evaluation data.

## What's Changed
The prompt has been refined to:
- Improve accuracy and relevance
- Enhance response coherence
- Better align with evaluation criteria
- Maintain the original intent while optimizing performance

## Testing
This optimization has been validated through handit.ai's evaluation pipeline with statistically significant improvements across multiple metrics.

---
*Generated by [handit.ai](https://handit.ai) - AI-powered prompt optimization*`;

  return description;
}

/**
 * Generate metrics comment for the PR
 */
function generateMetricsComment(metricsImprovement) {
  const { before, after, improvement } = metricsImprovement;
  
  let comment = `## 📊 Detailed Metrics Analysis

### Performance Comparison

`;

  Object.keys(improvement || {}).forEach(metric => {
    const beforeVal = before?.[metric] || 0;
    const afterVal = after?.[metric] || 0;
    const improvementVal = improvement[metric] || 0;
    
    comment += `**${metric.charAt(0).toUpperCase() + metric.slice(1)}**
- Before: ${beforeVal.toFixed(3)}
- After: ${afterVal.toFixed(3)}
- Change: ${improvementVal > 0 ? '+' : ''}${improvementVal.toFixed(3)}%

`;
  });

  comment += `### Evaluation Process
This optimization was generated using handit.ai's comprehensive evaluation system:
1. **Multiple Evaluators**: Various AI evaluators assess different aspects of prompt performance
2. **Real Data**: Evaluations are based on actual usage patterns and responses
3. **Statistical Validation**: Improvements are validated for statistical significance
4. **Continuous Learning**: The system learns from each evaluation to improve future optimizations

### Next Steps
- Review the changes and metrics above
- Test the new prompt in your development environment
- Merge when satisfied with the improvements
- handit.ai will continue monitoring and optimizing your prompts

---
*This analysis was generated automatically by handit.ai's evaluation system.*`;

  return comment;
}

/**
 * Calculate overall improvement percentage
 */
function calculateOverallImprovement(metricsImprovement) {
  if (!metricsImprovement?.improvement) return 0;
  
  const improvements = Object.values(metricsImprovement.improvement);
  const validImprovements = improvements.filter(val => typeof val === 'number');
  
  if (validImprovements.length === 0) return 0;
  
  return validImprovements.reduce((sum, val) => sum + val, 0) / validImprovements.length;
}

/**
 * Get GitHub integration for a company
 */
export const getGitHubIntegrationForCompany = async (companyId) => {
  return await GitHubIntegration.findOne({
    where: {
      companyId,
      active: true,
    },
  });
};

/**
 * Update PR status when webhook is received
 */
export const updatePRStatus = async (prNumber, repositoryFullName, status) => {
  const [owner, repo] = repositoryFullName.split('/');
  
  const pr = await GitHubPullRequest.findOne({
    where: { prNumber },
    include: [
      {
        model: GitHubIntegration,
        where: {
          repositoryOwner: owner,
          repositoryName: repo,
        },
      },
    ],
  });

  if (pr) {
    await pr.update({ status });
    console.log(`Updated PR #${prNumber} status to: ${status}`);
  }

  return pr;
}; 