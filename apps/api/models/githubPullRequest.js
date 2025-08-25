'use strict';
import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class GitHubPullRequest extends Model {
    static associate(models) {
      GitHubPullRequest.belongsTo(models.GitHubIntegration, { foreignKey: 'githubIntegrationId' });
      GitHubPullRequest.belongsTo(models.Model, { foreignKey: 'modelId' });
    }

    /**
     * Check if PR is still open
     */
    isOpen() {
      return this.status === 'open';
    }

    /**
     * Check if PR was merged
     */
    isMerged() {
      return this.status === 'merged';
    }

    /**
     * Get improvement percentage
     */
    getImprovementPercentage() {
      if (!this.metricsImprovement?.improvement) return 0;
      
      const improvement = this.metricsImprovement.improvement;
      // Calculate average improvement across all metrics
      const metrics = Object.values(improvement);
      const validMetrics = metrics.filter(m => typeof m === 'number');
      
      if (validMetrics.length === 0) return 0;
      
      return validMetrics.reduce((sum, val) => sum + val, 0) / validMetrics.length;
    }

    /**
     * Format metrics for display
     */
    formatMetricsForDisplay() {
      if (!this.metricsImprovement) return 'No metrics available';
      
      const { before, after, improvement } = this.metricsImprovement;
      let display = '## Metrics Improvement\n\n';
      
      Object.keys(improvement || {}).forEach(metric => {
        const beforeVal = before?.[metric] || 0;
        const afterVal = after?.[metric] || 0;
        const improvementVal = improvement[metric] || 0;
        
        display += `**${metric}**: ${beforeVal.toFixed(2)} → ${afterVal.toFixed(2)} `;
        display += `(${improvementVal > 0 ? '+' : ''}${improvementVal.toFixed(2)}%)\n`;
      });
      
      return display;
    }
  }

  GitHubPullRequest.init({
    githubIntegrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'github_integration_id',
    },
    modelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'model_id',
    },
    prNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pr_number',
    },
    prUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'pr_url',
    },
    type: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'prompt_optimization',
    },
    assessmentResult: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'assessment_result',
    },
    oldPrompt: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'old_prompt',
    },
    newPrompt: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'new_prompt',
    },
    metricsImprovement: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'metrics_improvement',
    },
    status: {
      type: DataTypes.ENUM('open', 'merged', 'closed'),
      allowNull: true,
      defaultValue: 'open',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  }, {
    sequelize,
    modelName: 'GitHubPullRequest',
    tableName: 'GitHubPullRequests',
    timestamps: true,
  });

  return GitHubPullRequest;
}; 