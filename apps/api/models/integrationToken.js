'use strict';

import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class IntegrationToken extends Model {
    static associate(models) {
      IntegrationToken.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });
      IntegrationToken.belongsTo(models.Provider, { foreignKey: 'providerId', as: 'provider' });
    }
  }
  IntegrationToken.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'company_id',
    },
    providerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'provider_id',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
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
    modelName: 'IntegrationToken',
    tableName: 'IntegrationTokens',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['company_id', 'provider_id', 'type'],
        name: 'unique_company_provider_type',
      },
    ],
    hooks: {
      afterCreate: async (integrationToken) => {
        const company = await sequelize.models.Company.findByPk(integrationToken.companyId);
        if (company) {
          // Set as optimization token if none exists
          if (company.optimizationTokenId === null) {
            company.optimizationTokenId = integrationToken.id;
            await company.save();
          }
        }

        // Set default model based on provider
        const provider = await sequelize.models.Provider.findByPk(integrationToken.providerId);
        if (provider) {
          let defaultModel;
          switch (provider.name.toLowerCase()) {
            case 'togetherai':
              defaultModel = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
              break;
            case 'openai':
              defaultModel = 'gpt-4o-mini';
              break;
            case 'googleai':
              defaultModel = 'gemini-2.5-flash';
              break;
            case 'awsbedrock':
              defaultModel = 'anthropic.claude-3-haiku-20240307-v1:0';
              break;
            default:
              console.warn(`No default model defined for provider: ${provider.name}`);
              return;
          }

          // Update integration token with default model
          integrationToken.data = {
            ...integrationToken.data,
            defaultModel: defaultModel
          };
          await integrationToken.save();

          // Find all evaluation prompts for this company that don't have a default integration token
          const evaluationPrompts = await sequelize.models.EvaluationPrompt.findAll({
            where: {
              companyId: integrationToken.companyId,
              defaultIntegrationTokenId: null
            }
          });

          // Assign this integration token to evaluation prompts that don't have one
          for (const prompt of evaluationPrompts) {
            prompt.defaultIntegrationTokenId = integrationToken.id;
            prompt.defaultProviderModel = defaultModel;
            await prompt.save();
          }

          console.log(`Assigned integration token ${integrationToken.id} to ${evaluationPrompts.length} evaluation prompts for company ${integrationToken.companyId}`);
        }
      },
    },
  });
  return IntegrationToken;
}; 