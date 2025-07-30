import jwt from 'jsonwebtoken';
import db from '../../models/index.js';
const { CLIAuthCode, User, Company } = db;

// Generate a new CLI authentication code
export const generateCLICode = async (req, res) => {
  try {
    const { userId, companyId } = req.body;

    if (!userId || !companyId) {
      return res.status(400).json({ 
        error: 'userId and companyId are required' 
      });
    }

    // Verify user and company exist
    const user = await User.findByPk(userId);
    const company = await Company.findByPk(companyId);

    if (!user || !company) {
      return res.status(404).json({ 
        error: 'User or company not found' 
      });
    }

    // Create a new CLI auth code
    const cliCode = await CLIAuthCode.createCode(userId, companyId);

    res.status(201).json({
      code: cliCode.code,
      expiresAt: cliCode.expiresAt,
      message: 'CLI authentication code generated successfully'
    });
  } catch (error) {
    console.error('Error generating CLI code:', error);
    res.status(500).json({ 
      error: 'Failed to generate CLI authentication code' 
    });
  }
};

// Check the status of a CLI authentication code
export const checkCLIStatus = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        error: 'Code is required' 
      });
    }

    const cliCode = await CLIAuthCode.findOne({
      where: { code },
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'firstName', 'lastName']
        },
        {
          model: Company,
          attributes: ['id', 'name', 'apiToken', 'stagingApiToken']
        }
      ]
    });

    if (!cliCode) {
      return res.status(404).json({ 
        error: 'Invalid authentication code' 
      });
    }

    // Check if code is expired
    if (cliCode.isExpired()) {
      await cliCode.update({ status: 'expired' });
      return res.status(400).json({ 
        error: 'Authentication code has expired' 
      });
    }

    // Check if code is already used
    if (cliCode.status === 'used') {
      return res.status(400).json({ 
        error: 'Authentication code has already been used' 
      });
    }

    // Auto-approve and generate tokens immediately
    const authToken = jwt.sign(
      { userId: cliCode.userId }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1y' }
    );

    // Mark code as used
    await cliCode.update({ 
      status: 'used', 
      usedAt: new Date() 
    });

    return res.status(200).json({
      status: 'success',
      authToken,
      apiToken: cliCode.Company.apiToken,
      stagingApiToken: cliCode.Company.stagingApiToken,
      user: cliCode.User,
      company: {
        id: cliCode.Company.id,
        name: cliCode.Company.name
      }
    });
  } catch (error) {
    console.error('Error checking CLI status:', error);
    res.status(500).json({ 
      error: 'Failed to check CLI authentication status' 
    });
  }
};

// Approve a CLI authentication code (called from dashboard)
export const approveCLICode = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId } = req.user; // From JWT token

    const cliCode = await CLIAuthCode.findOne({
      where: { code },
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'firstName', 'lastName']
        },
        {
          model: Company,
          attributes: ['id', 'name']
        }
      ]
    });

    if (!cliCode) {
      return res.status(404).json({ 
        error: 'Invalid authentication code' 
      });
    }

    // Verify the user is approving their own code
    if (cliCode.userId !== userId) {
      return res.status(403).json({ 
        error: 'You can only approve your own CLI authentication codes' 
      });
    }

    // Check if code is expired
    if (cliCode.isExpired()) {
      await cliCode.update({ status: 'expired' });
      return res.status(400).json({ 
        error: 'Authentication code has expired' 
      });
    }

    // Check if code is already used
    if (cliCode.status === 'used') {
      return res.status(400).json({ 
        error: 'Authentication code has already been used' 
      });
    }

    // Approve the code
    await cliCode.update({ status: 'approved' });

    res.status(200).json({
      message: 'CLI authentication code approved successfully',
      code: cliCode.code,
      user: cliCode.User,
      company: cliCode.Company
    });
  } catch (error) {
    console.error('Error approving CLI code:', error);
    res.status(500).json({ 
      error: 'Failed to approve CLI authentication code' 
    });
  }
};

// Get pending CLI codes for a user
export const getPendingCLICodes = async (req, res) => {
  try {
    const { userId } = req.user; // From JWT token

    const pendingCodes = await CLIAuthCode.findAll({
      where: { 
        userId,
        status: 'pending'
      },
      include: [
        {
          model: Company,
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Filter out expired codes
    const validCodes = pendingCodes.filter(code => !code.isExpired());

    res.status(200).json({
      codes: validCodes.map(code => ({
        code: code.code,
        company: code.Company,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting pending CLI codes:', error);
    res.status(500).json({ 
      error: 'Failed to get pending CLI codes' 
    });
  }
};

// Clean up expired codes (can be called by a cron job)
export const cleanupExpiredCodes = async (req, res) => {
  try {
    const expiredCodes = await CLIAuthCode.findAll({
      where: {
        status: 'pending',
        expiresAt: {
          [db.Sequelize.Op.lt]: new Date()
        }
      }
    });

    for (const code of expiredCodes) {
      await code.update({ status: 'expired' });
    }

    res.status(200).json({
      message: `Marked ${expiredCodes.length} expired codes`,
      count: expiredCodes.length
    });
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup expired codes' 
    });
  }
}; 