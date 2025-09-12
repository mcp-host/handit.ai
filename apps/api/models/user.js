'use strict';
import { Model } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sendWelcomeHanditEmail } from '../src/services/emailService.js';

export default (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Company, { foreignKey: 'company_id' });
      User.belongsTo(models.Membership, { foreignKey: 'membershipId' });

    }

    async comparePassword(candidatePassword) {
      const isMatch = await bcrypt.compare(candidatePassword, this.password);

      return isMatch;
    }
  }
  User.init({
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name'
    },
    testMode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'test_mode'
    },
    userType: {
      type: DataTypes.ENUM('regular', 'testing', 'admin'),
      allowNull: false,
      defaultValue: 'regular',
      field: 'user_type'
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'phone_number'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ssoLogin: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'sso_login'
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'company_id'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    },
    membershipId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'membership_id',
      references: {
        model: 'Memberships',
        key: 'id'
      }
    },
    onboardingCurrentTour: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'onboarding_current_tour'
    },
    githubUserId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'github_user_id'
    },
    githubUsername: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'github_username'
    },
    oauthProvider: {
      type: DataTypes.ENUM('github', 'google', 'microsoft'),
      allowNull: true,
      field: 'oauth_provider'
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
    modelName: 'User',
    timestamps: true,
    paranoid: true,
    hooks: {
      afterCreate: async (user, options) => {
        try {
          // Get the Email and User models from the sequelize instance
          const { Email, User } = sequelize.models;
          
          // Send welcome email
          await sendWelcomeHanditEmail({
            recipientEmail: user.email,
            firstName: user.firstName,
            Email,
            User,
            notificationSource: 'user_creation',
            sourceId: user.id
          });
          
          console.log(`Welcome email sent to ${user.email} after user creation`);
        } catch (error) {
          console.error('Error sending welcome email after user creation:', error);
          // Don't throw the error to avoid breaking the user creation process
        }
      }
    }
  });
  return User;
};
