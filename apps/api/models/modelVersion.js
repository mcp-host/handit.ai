'use strict';
import { Model } from 'sequelize';
export default (sequelize, DataTypes) => {
  class ModelVersion extends Model {
    static associate(models) {
      // Define associations here
      ModelVersion.belongsTo(models.Model, {
        foreignKey: 'model_id',
      });
    }
  }
  ModelVersion.init(
    {
      modelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Models',
          key: 'id',
        },
        field: 'model_id',
      },
      version: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: false,
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
      activeVersion: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'active_version',
      },
    },
    {
      sequelize,
      modelName: 'ModelVersions',
      timestamps: true,
      paranoid: true,
    }
  );
  return ModelVersion;
};
