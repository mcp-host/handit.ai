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
          if (company.optimizationTokenId === null) {
            company.optimizationTokenId = integrationToken.id;
            await company.save();
          }
        }
      },
    },
  });
  return IntegrationToken;
}; 