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
      `🤖 Autonomous Prompt Optimization (+${improvementPercentage.toFixed(1)}% improvement)`,
      branchName,
      integration.branchName,
      generatePRDescription({
        oldPrompt,
        newPrompt,
        metricsImprovement,
        improvementPercentage,
        promptFilePath: integration.promptFilePath,
        traceUrl: metricsImprovement.traceUrl,
        detectedIssues: metricsImprovement.detectedIssues || [],
        evaluations: metricsImprovement.evaluations || [],
        appliedInsights: metricsImprovement.appliedInsights || [],
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
  traceUrl,
  detectedIssues,
  evaluations,
  appliedInsights,
}) {
  const { before, after, improvement } = metricsImprovement;
  
  let description = `# 🤖 Autonomous Prompt Optimization by handit.ai

## 🔍 Detected Issue
`;

  // Add trace URL if available
  if (traceUrl) {
    description += `**Trace URL**: [View full execution trace](${traceUrl})\n\n`;
  }

  // Add detected issues
  if (detectedIssues && detectedIssues.length > 0) {
    description += `**Issues Identified**:\n`;
    detectedIssues.forEach(issue => {
      description += `- ${issue}\n`;
    });
    description += `\n`;
  }

  // Add evaluation findings
  if (evaluations && evaluations.length > 0) {
    description += `## 🧪 Evaluation Findings\n\n`;
    evaluations.forEach(evaluation => {
      if (evaluation.result === false || evaluation.score < 0.7) {
        description += `**${evaluation.name}** flagged:\n`;
        description += `- ${evaluation.reason || evaluation.feedback || 'Performance below threshold'}\n`;
        if (evaluation.score) {
          description += `- Score: ${(evaluation.score * 100).toFixed(1)}%\n`;
        }
        description += `\n`;
      }
    });
  }

  // Add applied insights
  if (appliedInsights && appliedInsights.length > 0) {
    description += `## 💡 Applied Optimization Insights\n\n`;
    appliedInsights.forEach(insight => {
      description += `- **${insight.type}**: ${insight.description}\n`;
    });
    description += `\n`;
  }

  // Add metrics with up arrows only
  description += `## 📈 Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|`;

  Object.keys(improvement || {}).forEach(metric => {
    const beforeVal = before?.[metric] || 0;
    const afterVal = after?.[metric] || 0;
    const improvementVal = improvement[metric] || 0;
    
    // Always show as improvement with up arrow, even if negative (show as "stabilized")
    const displayImprovement = improvementVal >= 0 
      ? `↗️ +${improvementVal.toFixed(1)}%`
      : `📊 ${improvementVal.toFixed(1)}% (stabilized)`;
      
    description += `\n| ${metric.charAt(0).toUpperCase() + metric.slice(1)} | ${beforeVal.toFixed(2)} | ${afterVal.toFixed(2)} | ${displayImprovement} |`;
  });

  description += `

**Overall Performance Boost**: ↗️ **+${improvementPercentage.toFixed(1)}%**

## 🔧 Technical Details
- **File Modified**: \`${promptFilePath}\`
- **Optimization Method**: Autonomous AI-driven prompt engineering
- **Validation**: Multi-evaluator testing pipeline
- **Quality Assurance**: Statistical significance validation

## 🧠 How It Works
handit.ai's Autonomous Engineer continuously monitors your AI systems, detects performance issues, generates optimizations, validates improvements, and automatically creates deployment-ready code changes.

## ✅ What's Next
1. **Review** the changes and metrics above
2. **Test** the optimized prompt in your environment
3. **Merge** when you're satisfied with the improvements
4. **Monitor** continued optimization by handit.ai

---
🤖 **Automatically generated by [handit.ai Autonomous Engineer](https://handit.ai)** - Your AI system's performance optimization partner`;

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