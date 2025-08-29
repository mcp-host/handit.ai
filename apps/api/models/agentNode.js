'use strict';
import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class AgentNode extends Model {
    static associate(models) {
      AgentNode.belongsTo(models.Agent, { foreignKey: 'agent_id' });
      AgentNode.belongsTo(models.Model, { 
        foreignKey: 'model_id',
        as: 'Model'
      });
      AgentNode.hasMany(models.AgentConnection, { 
        foreignKey: 'from_node_id',
        as: 'outgoingConnections'
      });
      AgentNode.hasMany(models.AgentConnection, { 
        foreignKey: 'to_node_id',
        as: 'incomingConnections'
      });
    }
  }

  AgentNode.init({
    agentId: {
      type: DataTypes.INTEGER,
      field: 'agent_id'
    },
    name: DataTypes.STRING,
    type: DataTypes.ENUM('model', 'tool'),
    config: DataTypes.JSON,
    modelId: {
      type: DataTypes.INTEGER,
      field: 'model_id'
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional identifier for the node, primarily used for tool types'
    },
    group: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Group identifier for the node'
    },
    initialNode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'initial_node',
      comment: 'Flag to indicate if this is the initial/starting node in the agent flow'
    },
    endNode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'end_node',
      comment: 'Flag to indicate if this is the final/end node in the agent flow'
    },
    mappingNodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'mapping_node_id',
      comment: 'Reference to another AgentNode for mapping purposes'
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
    }
  }, {
    sequelize,
    modelName: 'AgentNode',
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeValidate: async (agentNode) => {
        // Only generate slug for tool type nodes and if name is present and slug is not set
        if (agentNode.type === 'tool' && agentNode.name && !agentNode.slug) {
          // Convert name to camelCase for slug
          let slug = agentNode.name
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

          // Add 'tool' prefix and random suffix
          const randomSuffix = Math.random().toString(36).substring(2, 4);
          agentNode.slug = `tool${slug.slice(0, 10)}${randomSuffix}`;
        }
      }
    }
  });

  return AgentNode;
};
