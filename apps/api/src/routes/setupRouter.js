import express from 'express';
import db from '../../models/index.js';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePersonalizedSetup, testConnection, testConnectionCLI } from '../controllers/onboardingController.js';
import authenticateJWT from '../middleware/authMiddleware.js';

const { Agent, AgentNode, AgentConnection } = db;

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to convert name to camelCase
const toCamelCase = (str) => {
  return str
    .replace(/[^\w\s]/g, '') // Remove special characters
    .split(/\s+/) // Split by spaces
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
};

// Helper function to generate handit.config.json content
const generateHanditConfig = (agent) => {
  const nodes = agent.AgentNodes
    .filter(node => {
      console.log(node);
      // Include nodes that either have a slug (tool nodes) or have a model with a slug (model nodes)
      return node.slug || (node.type === 'model' && node.Model?.dataValues?.slug);
    })
    .map(node => {
      // Get outgoing connections for this node
      const outgoingConnections = node.outgoingConnections || [];
      
      // Use model's slug for model nodes, node's slug for tool nodes
      const nodeSlug = node.type === 'model' ? node.Model.dataValues?.slug : node.slug;
      
      const nodeConfig = {
        name: toCamelCase(node.name),
        slug: `${agent.slug}-${nodeSlug}`,
        description: node.description || '',
        type: node.type,
        problem_type: node.problemType,
        next_nodes: outgoingConnections
          .filter(conn => {
            // Include connections to nodes that either have a slug (tool nodes) or have a model with a slug (model nodes)
            return conn.toNode.slug || (conn.toNode.type === 'model' && conn.toNode.Model?.dataValues?.slug);
          })
          .map(conn => {
            // Use model's slug for model nodes, node's slug for tool nodes
            const toNodeSlug = conn.toNode.type === 'model' ? conn.toNode.Model.dataValues?.slug : conn.toNode.slug;
            return {
              slug: `${agent.slug}-${toNodeSlug}`,
              input_name: conn.inputName,
              output_name: conn.outputName
            };
          })
      };

      // Add model-specific configuration if it's a model node

      return nodeConfig;
    });

  return {
    agent: {
      name: agent.name,
      slug: agent.slug,
      description: agent.description || ''
    },
    nodes
  };
};

// Helper function to generate config mapping
const generateConfigMapping = (agent) => {
  const mapping = {};
  mapping[agent.name] = {};
  
  agent.AgentNodes
    .filter(node => {
      // Include nodes that either have a slug (tool nodes) or have a model with a slug (model nodes)
      return node.slug || (node.type === 'model' && node.Model?.dataValues?.slug);
    })
    .forEach(node => {
      // Use model's slug for model nodes, node's slug for tool nodes
      const nodeSlug = node.type === 'model' ? node.Model.dataValues?.slug : node.slug;
      mapping[agent.name][toCamelCase(node.name)] = `${agent.slug}-${nodeSlug}`;
    });

  return mapping;
};

// Download MCP server data
router.get('/mcp/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const agent = await Agent.findByPk(agentId, {
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: db.Model,
              as: 'Model'
            },
            {
              model: AgentConnection,
              as: 'outgoingConnections',
              include: [
                {
                  model: AgentNode,
                  as: 'toNode'
                }
              ]
            }
          ]
        }
      ]
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Create a zip file
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${agent.slug}-mcp.zip`);
    archive.pipe(res);

    // Generate and add handit.config.json to zip
    const handitConfig = generateHanditConfig(agent);
    archive.append(JSON.stringify(handitConfig, null, 2), { name: '.handit/handit.config.json' });

    // Add template files to zip
    const templateFiles = [
      'llms.js.txt',
      'llms.python.txt',
      'cursor_rules-python.json',
      'cursor_rules-js.json',
      'mcp.js'
    ];

    // Ensure templates directory exists
    const templatesDir = path.join(__dirname, '../templates');
    
    for (const file of templateFiles) {
      const sourcePath = path.join(templatesDir, file);
      if (fs.existsSync(sourcePath)) {
        const fileContent = fs.readFileSync(sourcePath, 'utf8');
        archive.append(fileContent, { name: `.handit/${file}` });
      } else {
        console.error(`Template file not found: ${sourcePath}`);
      }
    }

    // Generate and add mcp.json to zip
    const mcpConfig = {
      "mcpServers": {
        "handit": {
          "command": "node",
          "args": ["./.handit/mcp.js"],
          "stdio": "pipe"
        }
      }
    }
    archive.append(JSON.stringify(mcpConfig, null, 2), { name: '.cursor/mcp.json' });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Error creating zip file' });
    });

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('Error downloading MCP server data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download context data
router.get('/context/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const agent = await Agent.findByPk(agentId, {
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: db.Model,
              as: 'Model'
            },
            {
              model: AgentConnection,
              as: 'outgoingConnections',
              include: [
                {
                  model: AgentNode,
                  as: 'toNode'
                }
              ]
            }
          ]
        }
      ]
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Create a zip file
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${agent.slug}-context.zip`);
    archive.pipe(res);

    // Add files to zip
    const handitConfig = generateHanditConfig(agent);
    archive.append(JSON.stringify(handitConfig, null, 2), { name: 'handit.config.json' });

    const templateFiles = [
      'llms.js.txt',
      'llms.python.txt',
      'cursor_rules-python.json',
      'cursor_rules-js.json'
    ];

    for (const file of templateFiles) {
      const sourcePath = path.join(__dirname, '../templates', file);
      archive.file(sourcePath, { name: file });
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error downloading context data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download config file
router.get('/config/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const agent = await Agent.findByPk(agentId, {
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: db.Model,
              as: 'Model'
            },
            {
              model: AgentConnection,
              as: 'outgoingConnections',
              include: [
                {
                  model: AgentNode,
                  as: 'toNode'
                }
              ]
            }
          ]
        }
      ]
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const configMapping = generateConfigMapping(agent);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${agent.slug}-config.json`);
    res.json(configMapping);
  } catch (error) {
    console.error('Error downloading config file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate personalized setup instructions
router.post('/generate-personalized', generatePersonalizedSetup);

// Test connection by checking if company has agents (requires authentication)
router.post('/test-connection', authenticateJWT, testConnection);
router.post('/test-connection-cli', authenticateJWT, testConnectionCLI);

export default router; 