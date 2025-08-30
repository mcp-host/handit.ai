import db from '../../models/index.js';
import { executeTrack, executeToolTrack } from '../services/trackService.js';
import { Op } from 'sequelize';
import { createAgentFromConfig } from '../services/agentCreationService.js';
import { generateSlug } from '../utils/slugGenerator.js';
import {
  findOrCreateAgentNode,
  repositionAgentNodes,
} from '../services/agentNodeService.js';

const {
  Model,
  ModelGroup,
  ModelLog,
  AgentLog,
  AgentNodeLog,
  Company,
  AgentNode,
  Agent,
} = db;

export const bulkTrack = async (req, res) => {
  try {
    // Get the token from the request headers
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    // Validate token and get environment
    const companyAuth = await Company.validateApiToken(token);
    if (!companyAuth) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { environment, company } = companyAuth;
    const agentName = req.body.agentName;
    const agentSlug = agentName ? generateSlug(agentName) : null;
    let agent = await Agent.findOne({
      where: { slug: agentSlug, companyId: company.id },
    });
    if (!agent) {
      agent = await createAgentFromConfig(
        {
          agent: {
            name: agentName,
            description: 'Automatically created agent from tracking request',
            slug: agentSlug,
          },
          nodes: [],
        },
        company.id
      );
    }

    // Only process workflowData
    if (!req.body.workflowData || !Array.isArray(req.body.workflowData)) {
      return res
        .status(400)
        .json({ error: 'Request body must have workflowData as an array' });
    }
    const items = req.body.workflowData;
    const openaiToken = req.body.openAI?.token;
    const evaluationModel = req.body.openAI?.model;

    const log = await AgentLog.create({
      agentId: agent.id,
      input: 'processing',
      environment,
      status: 'processing',
    });

    let executionId = log.dataValues.id;
    // Process each item sequentially to preserve order
    let newNodeCreated = false;

    const results = [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      try {
        // Use item.id as the node slug
        const nodeName = item.nodeName || item.slug;
        let modelId = item.input?.params?.modelId || nodeName;
        const slug = nodeName;
        const camelCaseSlug = camelize(slug);
        const lowerCaseSlug = slug.toLowerCase();
        const lowerCamelSlug = camelize(lowerCaseSlug);

        let model = await Model.findOne({
          where: {
            slug: {
              [Op.in]: [
                slug,
                modelId,
                camelCaseSlug,
                lowerCaseSlug,
                lowerCamelSlug,
              ],
            },
          },
        });

        // For each agent, find or create the node
        const { agentNode, newNode } = await findOrCreateAgentNode({
          agent,
          nodeType: item.nodeType || 'model',
          model,
          nodeId: modelId,
          nodeName: model?.name || nodeName,
          toolType: item.toolType || 'HTTP',
          description: model?.description || 'Automatically created node',
          agentLogId: executionId,
          group: item.group || null,
        });

        console.log('newNode', newNode, 'agentNode', agentNode);

        // check if agent node was just created
        if (newNode) {
          newNodeCreated = true;
        }

        if (agentNode.type === 'model') {
          model = await Model.findOne({
            where: {
              id: agentNode.modelId,
            },
          });
        }

        // Compose track data
        const trackData = {
          ...item,
          environment,
          evaluationToken: openaiToken,
          evaluationModel,
          nodeName,
          executionId,
          slug: null,
        };

        if (item.output && Object.keys(item.output).length === 0) {
          continue;
        }

        // Save using the same logic as track
        const answer =
          agentNode.type === 'tool'
            ? await executeToolTrack(agentNode, trackData, agent)
            : await executeTrack(model, trackData, ModelLog);

        if (answer.error) {
          results.push({ node: nodeName, error: answer.error });
        } else {
          results.push({
            node: nodeName,
            success: true,
            modelLogId: answer.modelLogId || null,
          });
        }
      } catch (err) {
        console.log('err:', err.message);
        results.push({ node: item.id, error: err.message });
      }
    }
    if (newNodeCreated) {
      await repositionAgentNodes(agent, true);
    }
    const agentLog = await AgentLog.findByPk(executionId);
    if (agentLog) {
      await agentLog.update({
        status: 'success',
        output: results,
      });
    }
    res.status(201).json({ results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

export const urlsToTrack = async (req, res) => {
  try {
    const company = req.company;
    const modelGroups = await ModelGroup.findAll({
      where: { companyId: company.id },
    });
    const modelGroupIds = modelGroups.map((modelGroup) => modelGroup.id);
    const models = await Model.findAll({
      where: { modelGroupId: modelGroupIds },
    });

    res.status(201).json(models);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const startTrack = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate token and get environment
    const companyAuth = await Company.validateApiToken(token);
    if (!companyAuth) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { environment, company } = companyAuth;

    const agentName = req.body.agentName;
    const agentSlug = agentName ? generateSlug(agentName) : null;
    let agent = await Agent.findOne({
      where: { slug: agentSlug, companyId: company.id },
    });
    if (!agent) {
      const agentConfig = {
        agent: {
          name: agentName || `Agent ${agentSlug}`,
          description: 'Automatically created agent from tracking request',
          slug: agentSlug,
        },
        nodes: [],
      };

      // Create the agent
      agent = await createAgentFromConfig(agentConfig, company.id);
    }

    const agentLog = await AgentLog.create({
      agentId: agent.id,
      input: 'processing',
      environment,
      status: 'processing',
    });

    res.status(201).json({ executionId: agentLog.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const track = async (req, res) => {
  try {
    // Get the token from the request headers
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Validate token and get environment
    const companyAuth = await Company.validateApiToken(token);
    if (!companyAuth) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { environment, company } = companyAuth;

    // Split the modelId by '-' and get the actual modelId (second part)
    const split = req.body.modelId?.split('-');
    const agentName = req.body.agentName;
    const agentSlug = agentName ? generateSlug(agentName) : split[0];
    const modelId = req.body.nodeName
      ? generateSlug(req.body.nodeName)
      : split[split.length - 1];
    const nodeType = req.body.nodeType || 'model'; // Default to model if not specified
    // Find or create the agent
    let agent = await Agent.findOne({
      where: { slug: agentSlug, companyId: company.id },
    });

    if (!agent) {
      const agentConfig = {
        agent: {
          name: agentName || `Agent ${agentSlug}`,
          description: 'Automatically created agent from tracking request',
          slug: agentSlug,
        },
        nodes: [],
      };

      // Create the agent
      agent = await createAgentFromConfig(agentConfig, company.id);
    }

    if (!modelId) {
      return res.status(201).json({
        error: 'Invalid modelId format. Expected format: agentId-modelId',
      });
    }

    // First try to find the model directly
    let model = await Model.findOne({ where: { slug: modelId } });

    // If not found, try with the full modelId
    if (!model && req.body.modelId) {
      model = await Model.findOne({ where: { slug: req.body.modelId } });
    }

    let newNodeCreated = false;
    // Find or create the node
    const { agentNode, newNode } = await findOrCreateAgentNode({
      agent,
      nodeType,
      model,
      nodeId: modelId,
      nodeName: req.body.nodeName,
      toolType: req.body.toolType || 'TOOL',
      description: model?.description || 'Automatically created node',
      agentLogId: req.body.agentLogId || req.body.executionId,
    });
    if (agentNode.type === 'model') {
      model = await Model.findOne({
        where: {
          id: agentNode.modelId,
        },
      });
    }

    if (newNode) {
      newNodeCreated = true;
    }

    // Add environment to request body
    const trackData = {
      ...req.body,
      environment,
    };

    // Execute appropriate tracking based on whether it's a tool node or not
    const answer =
      agentNode.type === 'tool'
        ? await executeToolTrack(agentNode, trackData, agent)
        : await executeTrack(model, trackData, ModelLog);

    if (answer.error) {
      return res.status(201).json({ error: answer.error });
    }
    res.status(201).json(answer);
  } catch (error) {
    res.status(201).json({ error: error.message });
  }
};

export const endTrack = async (req, res) => {
  try {
    const { error, stack, externalId, agentName } = req.body;
    let { agentLogId, executionId } = req.body;
    if (!agentLogId && !executionId && !externalId && agentName) {
      const agent = await Agent.findOne({
        where: { slug: [agentName, generateSlug(agentName)] },
      });
      const agentLog = await AgentLog.findOne({
        where: {
          agentId: agent.id,
          status: 'processing',
        },
        order: [['createdAt', 'DESC']],
      });
      agentLogId = agentLog?.id;
    }

    // Start transaction

    // Find the agent log
    let agentLog = null;
    if (agentLogId) {
      agentLog = await AgentLog.findByPk(agentLogId);
    }
    if (!agentLog && executionId) {
      agentLog = await AgentLog.findOne({
        where: { id: executionId },
      });
    }
    if (!agentLog && externalId) {
      agentLog = await AgentLog.findOne({
        where: { externalId },
      });
    }
    agentLogId = agentLog.id;

    if (!agentLog) {
      return res.status(404).json({ error: 'Agent log not found' });
    }

    const agentNodes = await AgentNode.findAll({
      where: {
        agentId: agentLog.agentId,
        deletedAt: null,
      },
    });
    const modelIds = agentNodes
      .map((node) => node.modelId)
      .filter((id) => id !== null);
    const nodeIds = agentNodes
      .map((node) => node.id)
      .filter((id) => id !== null);

    // Get the latest output from either ModelLog or AgentNodeLog
    const [lastModelLog, lastAgentNodeLog] = await Promise.all([
      ModelLog.findOne({
        where: { agentLogId, modelId: { [Op.in]: modelIds } },
        order: [['createdAt', 'DESC']],
      }),
      AgentNodeLog.findOne({
        where: { parentLogId: agentLogId, agentNodeId: { [Op.in]: nodeIds } },
        order: [['createdAt', 'DESC']],
      }),
    ]);

    // Determine the final output from the most recent log
    let finalOutput = null;
    if (lastModelLog && lastAgentNodeLog) {
      finalOutput =
        lastModelLog.createdAt > lastAgentNodeLog.createdAt
          ? lastModelLog.output
          : lastAgentNodeLog.output;
    } else {
      finalOutput = lastModelLog?.output || lastAgentNodeLog?.output;
    }

    // Calculate duration from start time in metadata
    const endTime = new Date();
    const startTime = new Date(
      agentLog.metadata?.startedAt || agentLog.createdAt
    );
    const duration = endTime.getTime() - startTime.getTime();

    const nodeLogs = await AgentNodeLog.findAll({
      where: { parentLogId: agentLogId, agentNodeId: { [Op.in]: nodeIds } },
      order: [['createdAt', 'DESC']],
    });

    const modelLogs = await ModelLog.findAll({
      where: { agentLogId, modelId: { [Op.in]: modelIds } },
      order: [['createdAt', 'DESC']],
      attributes: ['status'],
    });

    let modelIncorrect = modelLogs.filter(
      (log) =>
        log?.status === 'failed' ||
        log?.dataValues?.status === 'failed' ||
        log?.status === 'error' ||
        log?.dataValues?.status === 'error' ||
        log?.status === 'crash' ||
        log?.dataValues?.status === 'crash'
    ).length;

    let incorrect = nodeLogs.filter(
      (log) =>
        log?.status === 'failed' ||
        log?.dataValues?.status === 'failed' ||
        log?.status === 'error' ||
        log?.dataValues?.status === 'error'
    ).length;

    // Update the agent log
    await agentLog.update({
      status:
        incorrect > 0 || error
          ? 'failed'
          : modelIncorrect > 0
          ? 'failed_model'
          : 'success',
      output: finalOutput,
      duration,
      errorDetails: error ? { message: error, stack } : null,
      metadata: {
        ...agentLog.metadata,
        endedAt: endTime,
      },
    });

    return res.status(200).json({
      id: agentLog.id,
      status: 'success',
      output: finalOutput,
      duration,
    });
  } catch (error) {
    console.error('Error in endTrack:', error);
    return res.status(500).json({ error: error.message });
  }
};
