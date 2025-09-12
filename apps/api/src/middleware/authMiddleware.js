import jwt from 'jsonwebtoken';
import db from '../../models/index.js';
const { User, Company } = db;
import { checkMembership } from '../services/membershipCheckService.js';

export const authenticateJWT = async (req, res, next) => {
  let token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Access denied, no token provided' });
  }

  token = token.replace('Bearer ', '');

  try {
    // First, try to verify the token as a JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      req.userObject = user;
      
      // Skip membership check for /users/me endpoint during OAuth flow
      if (req.originalUrl === '/users/me' && req.method === 'GET') {
        console.log('⏭️ Skipping membership check for /users/me during OAuth flow');
        return next();
      }
      
      // Membership check for user
      try {
        await checkMembership({
          user,
          token,
          endpoint: req.originalUrl,
          method: req.method,
          actionKey: `${req.method}_${req.originalUrl}`,
        });
      } catch (err) {
        console.error('❌ Membership check failed:', err.message);
        return res.status(403).json({ error: err.message || 'Membership check failed' });
      }
      return next();
    } catch (ex) {
      // If JWT verification fails, continue to check if it's a company API token
    }

    // If JWT verification fails, check if it's an API token for a company
    let company = await Company.findOne({ where: { apiToken: token } });

    if (!company) {
      company = await Company.findOne({ where: { stagingApiToken: token } });
    }
    if (!company) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const companyId = company.dataValues?.id || company.id;
    req.company = company.dataValues || company;
    const user = await User.findOne({ where: { companyId: companyId } });
    req.userObject = user;
    req.userId = { userId: user.id };
    // Membership check for company user
    try {
      await checkMembership({
        user,
        token,
        endpoint: req.originalUrl,
        method: req.method,
        actionKey: `${req.method}_${req.originalUrl}`,
      });
    } catch (err) {
      return res.status(403).json({ error: err.message || 'Membership check failed' });
    }
    next();
  } catch (ex) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

export default authenticateJWT;