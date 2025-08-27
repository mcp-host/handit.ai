// models/agent.js
'use strict';
import { Model } from 'sequelize';
import { redisService } from '../src/services/redisService.js';

export default (sequelize, DataTypes) => {
  class Agent extends Model {
    static associate(models) {
      Agent.hasMany(models.AgentNode, { foreignKey: 'agent_id' });
      Agent.hasMany(models.AgentConnection, { foreignKey: 'agent_id' });
      Agent.belongsTo(models.Company, { foreignKey: 'company_id' });
    }

    async getFirstNode() {
      const firstNode = await sequelize.models.AgentNode.findOne({
        where: {
          agentId: this.id,
          initialNode: true
        },
      });
      return firstNode;
    }

    async getMetricsModelsFullDate() {
      const nodes = await sequelize.query(`
        WITH principal_model_metrics AS (
          SELECT 
            m.id as model_id,
            mm.id as model_metric_id,
            EXTRACT(DAY FROM mml.created_at) as day,
            EXTRACT(MONTH FROM mml.created_at) as month,
            EXTRACT(YEAR FROM mml.created_at) as year,
            AVG(mml.value) as value
          FROM "AgentNodes" n
            INNER JOIN "Models" m ON m.id = n.model_id
            LEFT JOIN "ModelMetrics" mm ON mm.model_id = m.id
            LEFT JOIN "ModelMetricLogs" mml ON mml.model_metric_id = mm.id
          WHERE n.agent_id = ${this.id}
          AND n.type = 'model'
          AND n.deleted_at IS NULL
          AND mml.created_at > '${new Date(new Date() - 30 * 24 * 60 * 60 * 1000)}'
          GROUP BY m.id, mm.id, day, month, year
        )

        SELECT * FROM principal_model_metrics
      `);



      return nodes;
    }

    async saveMetricsModelsFullDateInCache() {
      const cacheKey = `metrics-models-full-date:${this.id}`;
      const metrics = await this.getMetricsModelsFullDate();
      await redisService.set(cacheKey, metrics);

      return metrics;
    }

    get firstNode() {
      if (!this._firstNode) {
        return this.getFirstNode();
      }
      return this._firstNode;
    }

    set firstNode(node) {
      this._firstNode = node;
    }
  }

  Agent.init({
    name: DataTypes.STRING,
    description: DataTypes.TEXT,
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique identifier for the agent in camelCase format'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at'
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'company_id'
    },
    autoCapture: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'auto_capture',
      comment: 'Flag to indicate if agent should automatically capture data'
    },
    autoStop: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'auto_stop',
      comment: 'Flag to indicate if agent should automatically stop and close logs when reaching an end node'
    },
    repository: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'repository'
    },
    tourAgent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'tour_agent',
      comment: 'Flag to indicate if agent is a tour/demo agent for onboarding'
    },
    demoAgent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'demo_agent',
      comment: 'Flag to indicate if agent is a demo agent for testing'
    },
    tracingSchema: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'tracing_schema'
    }
  }, {
    sequelize,
    modelName: 'Agent',
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeValidate: async (agent) => {
        if (agent.name && !agent.slug) {
          // Convert name to camelCase for slug
          let slug = agent.name
            // Replace special characters with space
            .replace(/[^\w\s]/g, ' ')
            // Split into words
            .split(/\s+/)
            // Convert to camelCase
            .map((word, index) => {
              if (index === 0) {
                return word.toLowerCase();
              }
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join('');

          // Add random suffix if needed
          const randomSuffix = Math.random().toString(36).substring(2, 4);
          agent.slug = `${slug.slice(0, 10)}${randomSuffix}`;
        }
      }
    }
  });

  return Agent;
};