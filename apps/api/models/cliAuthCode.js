'use strict';
import { Model } from 'sequelize';
import crypto from 'crypto';

export default (sequelize, DataTypes) => {
  class CLIAuthCode extends Model {
    static associate(models) {
      CLIAuthCode.belongsTo(models.User, { foreignKey: 'userId' });
      CLIAuthCode.belongsTo(models.Company, { foreignKey: 'companyId' });
    }

    static generateCode() {
      return crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    static async createCode(userId, companyId) {
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      return await this.create({
        code,
        userId,
        companyId,
        expiresAt,
      });
    }

    isExpired() {
      return new Date() > this.expiresAt;
    }

    canBeUsed() {
      return this.status === 'pending' && !this.isExpired();
    }
  }

  CLIAuthCode.init({
    code: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'company_id',
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'expired', 'used'),
      allowNull: false,
      defaultValue: 'pending',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at',
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
    modelName: 'CLIAuthCode',
    tableName: 'CLIAuthCodes',
    timestamps: true,
  });

  return CLIAuthCode;
}; 