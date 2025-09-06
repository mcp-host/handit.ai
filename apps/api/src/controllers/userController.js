import db from '../../models/index.js';

const { User } = db;
import bcrypt from 'bcryptjs';

export const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.update(req.body);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateMe = async (req, res) => {
  const { user } = req;
  const { userId } = user;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update(req.body);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const updateOnboardingProgress = async (req, res) => {
  const { user } = req;
  const { userId } = user;
  const { onboardingCurrentTour } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (onboardingCurrentTour === 'autonomous-engineer-setup' && user.onboardingCurrentTour && user.onboardingCurrentTour !== 'welcome-concept-walkthrough') {
      return res.status(200).json({ message: 'You must complete the welcome concept walkthrough first' });
      
    }

    await user.update({
      onboardingCurrentTour: onboardingCurrentTour
    });

    res.status(200).json({
      message: 'Onboarding progress updated successfully',
      onboardingCurrentTour: user.onboardingCurrentTour
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    res.status(204).json();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const me = async (req, res) => {
  const { user } = req;
  const { userId } = user;

  try {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    const company = await user.getCompany();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({...user.dataValues, company});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const updatePassword = async (req, res) => {
  const { user } = req;
  const { userId } = user;
  const { newPassword } = req.body;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }


    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const checkUserOptimizations = async (req, res) => {
  const { user } = req;
  const { userId } = user;

  try {
    const userRecord = await User.findByPk(userId);
    if (!userRecord) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the company associated with the user
    const company = await userRecord.getCompany();
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const modelGroups = await db.ModelGroup.findAll({
      where: {
        companyId: company.id
      }
    });

    const modelIds = modelGroups.map(group => group.id);
    // Find all optimized models for these agents
    const optimizedModels = await db.Model.findAll({
      where: {
        isOptimized: true,
        modelGroupId: {
          [db.Sequelize.Op.in]: modelIds
        }
      }
    });

    if (optimizedModels.length === 0) {
      return res.status(200).json({ 
        hasOptimizations: true,
        message: 'No optimized models found'
      });
    }

    // Check if any of these optimized models have versions
    const optimizedModelIds = optimizedModels.map(model => model.id);
    
    const modelVersions = await db.ModelVersions.findAll({
      where: {
        modelId: {
          [db.Sequelize.Op.in]: optimizedModelIds
        }
      }
    });

    const hasOptimizations = modelVersions.length > 0;

    const integrations = await db.GitHubIntegration.findAll({
      where: {
        companyId: company.id
      }
    });

    let optimizationPRs = [];
    if (integrations && integrations.length > 0) {
      // Check for optimization PRs
      optimizationPRs = await db.GitHubPullRequest.findAll({
        where: {
          type: 'prompt_optimization',
          githubIntegrationId: {
            [db.Sequelize.Op.in]: integrations.map(integration => integration.id)
          }
        },
        order: [['createdAt', 'DESC']],
        limit: 5
      });
    }

    res.status(200).json({
      hasOptimizations: true,
      optimizedModelsCount: optimizedModels.length,
      modelVersionsCount: modelVersions.length,
      optimizedModels: optimizedModels.map(model => ({
        id: model.id,
        name: model.name,
        isOptimized: model.isOptimized,
        createdAt: model.createdAt
      })),
      optimizationPRs: optimizationPRs.map(pr => ({
        id: pr.id,
        prNumber: pr.prNumber,
        prUrl: pr.prUrl,
        status: pr.status,
        metricsImprovement: pr.metricsImprovement,
        createdAt: pr.createdAt
      })),
      hasOptimizationPRs: optimizationPRs.length > 0,
      message: hasOptimizations 
        ? 'User has optimizations with versions' 
        : 'User has optimized models but no versions yet'
    });

  } catch (error) {
    console.error('Error checking user optimizations:', error);
    res.status(500).json({ error: error.message });
  }
}