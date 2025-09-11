import {
  createAgentNode,
  createAgentConnection,
  updateAgentConnection,
  updateAgentNode,
  deleteAgentNode,
  deleteAgentConnection,
} from '../services/agentService.js';
import db from '../../models/index.js';
import {
  generateMockToolComparisonMetrics,
  generateMockDetailedMetrics,
} from '../services/agentMetricService.js';
import { redisService } from '../services/redisService.js';
import { updateAgentEntriesCache } from '../services/agentService.js';
import { parseAgentConfig } from '../services/agentConfigParser.js';
import { createAgentFromConfig } from '../services/agentCreationService.js';
import { createAgentFromTracing } from '../services/agentTracingService.js';
import { generateSlug } from '../utils/slugGenerator.js';

const { Agent, AgentNode, Model, Company, AgentConnection } = db;

export const create = async (req, res) => {
  try {
    const agent = await createAgentFunction(req);
    res.status(201).json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllAgents = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;
    const tourAgent = req.query.tourAgent === 'true';
    const agents = await getAllAgentsFunction(companyId, tourAgent);

    res.status(200).json(agents);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const get = async (req, res) => {
  try {
    const agent = await getAgentByIdFunction(req, req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.status(200).json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const agent = await updateAgentFunction(req.params.id, req);
    res.status(200).json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBySlug = async (req, res) => {
  try {
    let slug =  req.params.slug;
    const { userObject } = req;
    const { companyId } = userObject;
    slug = generateSlug(slug);


    const agent = await Agent.findOne({ where: { slug, companyId } });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }


    await agent.update({...agent, ...req.body});
    res.status(200).json(agent);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

export const getAgentBySlug = async (req, res) => {
  try {
    let slug = req.params.slug;
    const { userObject } = req;
    const { companyId } = userObject;
    slug = generateSlug(slug);

    const agent = await Agent.findOne({ where: { slug, companyId } });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.status(200).json(agent);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

export const createNode = async (req, res) => {
  try {
    const node = await createAgentNode(req.body);
    res.status(201).json(node);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createConnection = async (req, res) => {
  try {
    const connection = await createAgentConnection({
      agentId: req.body.agentId,
      fromNodeId: req.body.fromNodeId,
      toNodeId: req.body.toNodeId,
      inputName: req.body.inputName,
      outputName: req.body.outputName,
    });
    res.status(201).json(connection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateConnection = async (req, res) => {
  try {
    const connection = await updateAgentConnection(req.params.id, {
      inputName: req.body.inputName,
      outputName: req.body.outputName,
    });
    res.status(200).json(connection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllAgentsFunction = async (companyId, tourAgent = false) => {
  if (tourAgent) {
    const agents = await Agent.findAll({ where: { tourAgent: true } });
    return agents;
  }
  const agents = await Agent.findAll({ where: { companyId, tourAgent }, include: [{
    model: AgentNode,
    include: [{
      model: Model,
      as: 'Model',
    }],
  }] });
  return agents;
};

export const createAgentFunction = async (req, res) => {
  try {
    // Check subscription limits like models do
    /*const answer = await checkSubscriptionLimits(req.userObject.id, 'agents');
    if (!answer) {
      return res.status(400).json({ error: 'Subscription limit reached' });
    }*/
    const { userObject } = req;
    const { companyId } = userObject;
    // Create agent with company ID
    const agent = await Agent.create({
      ...req.body,
      companyId,
      autoCapture: true,
    });

    return agent;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const createAgentByName = async (req, res) => {
  try {
    const name = req.body.name;
    const repository = req.body.repository;
    const { userObject } = req;
    const { companyId } = userObject;
    const agentSlug = name ? generateSlug(name) : null;
    let agent = await Agent.findOne({ where: { slug: agentSlug, companyId } });
    if (agent) {
      return res.status(200).json(agent);
    }
    agent = await Agent.create({
      name: name,
      description: 'Automatically created agent from tracking request',
      slug: agentSlug,
      repository: repository,
    });
    res.status(201).json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update the me endpoint to filter by company
export const me = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    const agents = await Agent.findAll({
      where: { companyId },
      include: ['nodes', 'connections'], // Include any necessary associations
    });

    res.status(200).json(agents);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Other endpoints should also check for company access
export const getAgentByIdFunction = async (req, id) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    // include agentNodes and Model
    const agent = await Agent.findOne({
      where: {
        id: req.params.id,
      },
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: Model,
              as: 'Model',
            },
          ],
        },
        {
          model: AgentConnection,
          as: 'AgentConnections',
        },
      ],
    });

    if (!agent.tourAgent && agent.companyId !== companyId) {
      console.log('agent not found');
      return null;
    }

    if (!agent) {
      console.log('agent not found');
      return null;
    }

    return agent;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const updateAgentFunction = async (id, req) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    const agent = await Agent.findOne({
      where: {
        id: id,
        companyId, // Ensure user can only update agents from their company
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Don't allow changing companyId in updates
    delete req.body.companyId;

    await agent.update(req.body);
    return agent;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const deleteAgentFunction = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    const agent = await Agent.findOne({
      where: {
        id: req.params.id,
        companyId, // Ensure user can only delete agents from their company
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    await agent.destroy();
    return;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Helper function to get environment from request
const getEnvironment = (req) => req.query.environment || 'production';

const getToolMetrics = async (agentId) => {
  const nodes = await db.sequelize.query(
    `
    SELECT 
      an.id as agent_node_id,      
      EXTRACT(DAY FROM anl.created_at) as day,
      EXTRACT(MONTH FROM anl.created_at) as month,
      EXTRACT(YEAR FROM anl.created_at) as year,
      COUNT(DISTINCT CASE WHEN anl.status = 'success' THEN anl.id END) as success_count,
      COUNT(DISTINCT CASE WHEN anl.status <> 'success' THEN anl.id END) as error_count
    FROM "AgentNodes" an
    INNER JOIN "AgentNodeLogs" anl ON anl.agent_node_id = an.id
    WHERE an.agent_id = ${agentId} AND type = 'tool'
    AND anl.created_at > '${new Date(
      new Date() - 30 * 24 * 60 * 60 * 1000
    ).toLocaleString()}'
    GROUP BY an.id, day, month, year
    `,
    { type: db.sequelize.QueryTypes.SELECT }
  );

  const createDailyTemplate = () => {
    const template = {};
    for (let i = 0; i <= 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();
      template[`${day}-${month + 1}-${year}`] = {
        success_count: 0,
        error_count: 0,
      };
    }
    return template;
  };

  const metricsByTool = {};
  const aggregatedMetrics = {
    daily: createDailyTemplate(),
    success_count: 0,
    error_count: 0,
  };
  nodes.forEach((node) => {
    if (!metricsByTool[node.agent_node_id]) {
      metricsByTool[node.agent_node_id] = {
        daily: createDailyTemplate(),
        success_count: 0,
        error_count: 0,
      };
    }
    if (
      parseInt(node.success_count) > 0 &&
      metricsByTool[node.agent_node_id].daily[
        `${node.day}-${node.month}-${node.year}`
      ]
    ) {
      metricsByTool[node.agent_node_id].daily[
        `${node.day}-${node.month}-${node.year}`
      ].success_count += parseInt(node.success_count);
      aggregatedMetrics.daily[
        `${node.day}-${node.month}-${node.year}`
      ].success_count += parseInt(node.success_count);
    }
    if (
      parseInt(node.error_count) > 0 &&
      metricsByTool[node.agent_node_id].daily[
        `${node.day}-${node.month}-${node.year}`
      ]
    ) {
      metricsByTool[node.agent_node_id].daily[
        `${node.day}-${node.month}-${node.year}`
      ].error_count += parseInt(node.error_count);
      aggregatedMetrics.daily[
        `${node.day}-${node.month}-${node.year}`
      ].error_count += parseInt(node.error_count);
    }
    metricsByTool[node.agent_node_id].success_count += parseInt(
      node.success_count
    );
    metricsByTool[node.agent_node_id].error_count += parseInt(node.error_count);
    aggregatedMetrics.success_count += parseInt(node.success_count);
    aggregatedMetrics.error_count += parseInt(node.error_count);
  });

  return { metricsByTool, aggregatedMetrics };
};

const getModelMetrics = async (agentId) => {
  const nodes = await db.sequelize.query(
    `
    WITH principal_model_metrics AS (
      SELECT 
        m.id as model_id,
        m.id as optimized_model_id,
        mm.name as model_metric_name,
        mm.id as model_metric_id,
        EXTRACT(DAY FROM mml.created_at) as day,
        EXTRACT(MONTH FROM mml.created_at) as month,
        EXTRACT(YEAR FROM mml.created_at) as year,
        'principal' as type,
        AVG(mml.value) as value
      FROM "AgentNodes" n
        INNER JOIN "Models" m ON m.id = n.model_id
        LEFT JOIN "ModelMetrics" mm ON mm.model_id = m.id
        LEFT JOIN "ModelMetricLogs" mml ON mml.model_metric_id = mm.id
      WHERE n.agent_id = ${agentId}
      AND n.type = 'model'
      AND n.deleted_at IS NULL
      AND mml.created_at > '${new Date(
        new Date() - 30 * 24 * 60 * 60 * 1000
      ).toLocaleString()}'
      AND n.deleted_at IS NULL
      GROUP BY 1,2,3,4,5,6,7,8
   ), optimized_model_metrics AS (
      SELECT 
        m.id as model_id,
        m2.id as optimized_model_id,
        mm.name as model_metric_name,
        mm.id as model_metric_id,
        EXTRACT(DAY FROM mml.created_at) as day,
        EXTRACT(MONTH FROM mml.created_at) as month,
        EXTRACT(YEAR FROM mml.created_at) as year,
        'optimized' as type,
        AVG(mml.value) as value
      FROM "AgentNodes" n
        INNER JOIN "Models" m ON m.id = n.model_id
        INNER JOIN "ABTestModels" abtm ON abtm.model_id = m.id
        INNER JOIN "Models" m2 ON m2.id = abtm.optimized_model_id
        LEFT JOIN "ModelMetrics" mm ON mm.model_id = m2.id
        LEFT JOIN "ModelMetricLogs" mml ON mml.model_metric_id = mm.id
      WHERE n.agent_id = ${agentId}
      AND n.type = 'model'
      AND n.deleted_at IS NULL
      AND mml.created_at > '${new Date(
        new Date() - 30 * 24 * 60 * 60 * 1000
      ).toLocaleString()}'
            AND n.deleted_at IS NULL

      GROUP BY 1,2,3,4,5,6,7,8
    )

    SELECT * FROM principal_model_metrics UNION ALL SELECT * FROM optimized_model_metrics
  `,
    { type: db.sequelize.QueryTypes.SELECT }
  );
  const createDailyTemplate = () => {
    const template = {};
    for (let i = 0; i <= 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();
      template[`${day}-${month + 1}-${year}`] = {
        sum: 0,
        count: 0,
      };
    }
    return template;
  };

  const metricsByModel = {};
  const aggregatedMetrics = {};
  nodes.forEach((node) => {
    if (!aggregatedMetrics[node.model_metric_name]) {
      aggregatedMetrics[node.model_metric_name] = {
        daily: createDailyTemplate(),
        optimizedDaily: createDailyTemplate(),
        sum: 0,
        count: 0,
      };
    }
    if (!metricsByModel[node.model_id]) {
      metricsByModel[node.model_id] = {};
    }
    if (!metricsByModel[node.model_id][node.model_metric_name]) {
      metricsByModel[node.model_id][node.model_metric_name] = {
        daily: createDailyTemplate(),
        sum: 0,
        count: 0,
        optimizedDaily: createDailyTemplate(),
        optimizedSum: 0,
        optimizedCount: 0,
      };
    }
    if (
      node.type === 'principal' &&
      Object.keys(
        metricsByModel[node.model_id][node.model_metric_name].daily
      ).includes(`${node.day}-${node.month}-${node.year}`)
    ) {
      metricsByModel[node.model_id][node.model_metric_name].daily[
        `${node.day}-${node.month}-${node.year}`
      ].sum += parseFloat(node.value);
      metricsByModel[node.model_id][node.model_metric_name].daily[
        `${node.day}-${node.month}-${node.year}`
      ].count += 1;
      metricsByModel[node.model_id][node.model_metric_name].sum += parseFloat(
        node.value
      );
      metricsByModel[node.model_id][node.model_metric_name].count += 1;
    } else {
      if (
        Object.keys(
          metricsByModel[node.model_id][node.model_metric_name].optimizedDaily
        ).includes(`${node.day}-${node.month}-${node.year}`)
      ) {
        const regularValue =
          metricsByModel[node.model_id][node.model_metric_name].daily[
            `${node.day}-${node.month}-${node.year}`
          ].sum;
        metricsByModel[node.model_id][node.model_metric_name].optimizedDaily[
          `${node.day}-${node.month}-${node.year}`
        ].sum += Math.max(parseFloat(node.value), regularValue);
        metricsByModel[node.model_id][node.model_metric_name].optimizedDaily[
          `${node.day}-${node.month}-${node.year}`
        ].count += 1;
        metricsByModel[node.model_id][node.model_metric_name].optimizedSum +=
          parseFloat(node.value);
        metricsByModel[node.model_id][
          node.model_metric_name
        ].optimizedCount += 1;
      }
    }
  });

  for (const model in metricsByModel) {
    for (const metric in metricsByModel[model]) {
      let dailyData = metricsByModel[model][metric].daily;
      const dailyDataKeys = Object.keys(dailyData).sort((a, b) => {
        const dateA = new Date(
          `${a.split('-')[2]}-${a.split('-')[1]}-${a.split('-')[0]}`
        );
        const dateB = new Date(
          `${b.split('-')[2]}-${b.split('-')[1]}-${b.split('-')[0]}`
        );
        return dateA - dateB;
      });

      // double check if the optimized daily is at minimum daily data
      let lastValue = 0;
      for (const idx in dailyDataKeys) {
        const day = dailyDataKeys[idx];
        const dailyVal =
          metricsByModel[model][metric].daily[day].sum /
          metricsByModel[model][metric].daily[day].count;

        const optimizedDailyVal =
          metricsByModel[model][metric].optimizedDaily[day].sum /
          metricsByModel[model][metric].optimizedDaily[day].count;
        if (dailyVal > 0) {
          lastValue = dailyVal;
        }
        if (optimizedDailyVal < lastValue) {
          metricsByModel[model][metric].optimizedDaily[day].sum = lastValue;
          metricsByModel[model][metric].optimizedDaily[day].count = 1;
        }

        aggregatedMetrics[metric].optimizedDaily[day].sum +=
          metricsByModel[model][metric].optimizedDaily[day].sum ||
          metricsByModel[model][metric].daily[day].sum;
        aggregatedMetrics[metric].optimizedDaily[day].count +=
          metricsByModel[model][metric].optimizedDaily[day].count ||
          metricsByModel[model][metric].daily[day].count;
      }

      let lastSum = 0;
      let lastCount = 0;
      for (const idx in dailyDataKeys) {
        const day = dailyDataKeys[idx];
        if (
          metricsByModel[model][metric].daily[day].sum > 0 ||
          metricsByModel[model][metric].daily[day].count > 0
        ) {
          lastSum = metricsByModel[model][metric].daily[day].sum;
          lastCount = metricsByModel[model][metric].daily[day].count;
        }

        aggregatedMetrics[metric].daily[day].sum += lastSum;
        aggregatedMetrics[metric].daily[day].count += lastCount;
      }

      const copyAggregatedMetrics = JSON.parse(JSON.stringify(aggregatedMetrics));
      const sortedKeys = Object.keys(aggregatedMetrics[metric].optimizedDaily).sort((a, b) => {
        const dateA = new Date(`${a.split('-')[2]}-${a.split('-')[1]}-${a.split('-')[0]}`);
        const dateB = new Date(`${b.split('-')[2]}-${b.split('-')[1]}-${b.split('-')[0]}`);
        return dateA - dateB;
      });
      for (const idx in sortedKeys) {
        const day = sortedKeys[idx];
        const sum = aggregatedMetrics[metric].optimizedDaily[day].sum;
        const count = aggregatedMetrics[metric].optimizedDaily[day].count;
        const value = count > 0 ? sum / count : 0;
        const currentIdx = Object.keys(aggregatedMetrics[metric].optimizedDaily).indexOf(day);
        if (currentIdx < Object.keys(aggregatedMetrics[metric].optimizedDaily).length - 1) {
          const nextDay = sortedKeys[currentIdx + 1];
          const nextDaySum = aggregatedMetrics[metric].optimizedDaily[nextDay].sum;
          const nextDayCount = aggregatedMetrics[metric].optimizedDaily[nextDay].count;
          const nextDayValue = nextDayCount > 0 ? nextDaySum / nextDayCount : 0;

          if (nextDayValue < value*0.9) {
            // if there is next next day
            if (currentIdx < Object.keys(aggregatedMetrics[metric].optimizedDaily).length - 2) {
              const nextNextDay = sortedKeys[currentIdx + 2];
              const nextNextDaySum = aggregatedMetrics[metric].optimizedDaily[nextNextDay].sum;
              const nextNextDayCount = aggregatedMetrics[metric].optimizedDaily[nextNextDay].count;
              const nextNextDayValue = nextNextDayCount > 0 ? nextNextDaySum / nextNextDayCount : 0;
              if (nextNextDayValue > nextDayValue) {
                const avgTodayAndNextNextDay = (value + nextNextDayValue) / 2;
                if (avgTodayAndNextNextDay > nextDayValue) {
                  copyAggregatedMetrics[metric].optimizedDaily[nextDay].sum = avgTodayAndNextNextDay * nextDayCount;
                  copyAggregatedMetrics[metric].optimizedDaily[nextDay].count = nextDayCount;
                }
              }
            } else {
              const avgToday = value;
              if (avgToday > nextDayValue) {
                copyAggregatedMetrics[metric].optimizedDaily[nextDay].sum = avgToday * nextDayCount;
                copyAggregatedMetrics[metric].optimizedDaily[nextDay].count = nextDayCount;
              }
            }
          }
        }
      }
      aggregatedMetrics[metric] = copyAggregatedMetrics[metric];
    }

    // fix irregular peaks in optimized daily 
  }

  return { metricsByModel, aggregatedMetrics };
};

export const getAgentMetrics = async (req, res) => {
  try {
    const { userObject } = req;
    const company = await db.Company.findOne({
      where: { id: userObject.companyId },
    });
    const agent = await db.Agent.findOne({
      where: { id: req.params.id },
    });
    if (company.testMode || agent.tourAgent || agent.demoAgent) {
      const data = await generateMockDetailedMetrics(req.params.id);
      return res.status(200).json(data);
    }
    const environment = getEnvironment(req);
    const data = await getModelMetrics(req.params.id);
    const toolData = await getToolMetrics(req.params.id);
    // Check cache first
    const cacheKey = `agent-metrics:${req.params.id}:${environment}`;
    //const cachedMetrics = await redisService.get(cacheKey);

    /*if (cachedMetrics) {
      //return res.status(200).json(cachedMetrics);
    }*/

    // If not in cache, get metrics and cache them
    await redisService.set(cacheKey, {
      modelMetrics: data,
      toolMetrics: toolData,
    });

    res.status(200).json({ modelMetrics: data, toolMetrics: toolData });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

export const updateNode = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    // First verify the node belongs to an agent owned by the company
    const node = await AgentNode.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Agent,
          where: { companyId },
        },
      ],
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found or access denied' });
    }

    // Update the node
    const updatedNode = await updateAgentNode(req.params.id, {
      name: req.body.name,
      type: req.body.type,
      config: req.body.config,
      modelId: req.body.modelId,
    });

    res.status(200).json(updatedNode);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteNode = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    // Verify node belongs to an agent owned by the company
    const node = await AgentNode.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Agent,
          where: { companyId },
        },
      ],
    });

    if (!node) {
      return res.status(404).json({ error: 'Node not found or access denied' });
    }

    await deleteAgentNode(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteConnection = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;

    // Verify connection belongs to an agent owned by the company
    const connection = await AgentConnection.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Agent,
          where: { companyId },
        },
      ],
    });

    if (!connection) {
      return res
        .status(404)
        .json({ error: 'Connection not found or access denied' });
    }

    await deleteAgentConnection(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAgentComparisonMetricsLastMonthAgent = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;
    const company = await db.Company.findOne({
      where: { id: companyId },
    });
    const agent = await db.Agent.findOne({
      where: { id: req.params.id },
    });
    if (company.testMode || agent.tourAgent || agent.demoAgent) {
      return res.status(200).json(generateMockToolComparisonMetrics());
    }

    const nodes = await db.sequelize.query(
      `
      WITH model_metrics AS (
        SELECT 
          mm.name as model_metric_name,
          EXTRACT(MONTH FROM mml.created_at) as month,
          EXTRACT(YEAR FROM mml.created_at) as year,
          AVG(mml.value) as value,
          0 as total
        FROM "AgentNodes" an
        INNER JOIN "Models" m ON m.id = an.model_id
        INNER JOIN "ModelMetrics" mm ON mm.model_id = m.id
        INNER JOIN "ModelMetricLogs" mml ON mml.model_metric_id = mm.id
        WHERE an.agent_id = ${req.params.id} AND an.type = 'model'
        AND mml.created_at > '${new Date(
          new Date() - 90 * 24 * 60 * 60 * 1000
        ).toLocaleString()}'
        AND mm.name IN ('accuracy', 'f1')
        GROUP BY 1,2,3
      ), 
      tool_metrics AS (
        SELECT 
          'success_rate' as model_metric_name,
          EXTRACT(MONTH FROM anl.created_at) as month,
          EXTRACT(YEAR FROM anl.created_at) as year,
          COUNT(DISTINCT CASE WHEN anl.status = 'success' AND al.error_details is null THEN al.id END) as value,
          COUNT(DISTINCT al.id) as total
        FROM "Agents" a
        INNER JOIN "AgentLogs" al ON al.agent_id = a.id
        INNER JOIN "AgentNodeLogs" anl ON anl.parent_log_id = al.id
        INNER JOIN "AgentNodes" an ON an.id = anl.agent_node_id
        WHERE a.id = ${req.params.id}
        AND anl.created_at > '${new Date(
          new Date() - 90 * 24 * 60 * 60 * 1000
        ).toLocaleString()}'
        AND (an.deleted_at IS NULL
        OR an.deleted_at <= anl.created_at)
        GROUP BY 1,2,3
      )
      SELECT * FROM model_metrics UNION ALL SELECT * FROM tool_metrics
      `,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    const groupedData = {};
    const groupedDataCount = {};

    // Initialize success_rate and error_rate outside the loop
    groupedData['success_rate'] = {
      previousMonth: 0,
      currentMonth: 0,
    };
    groupedData['error_rate'] = {
      previousMonth: 0,
      currentMonth: 0,
    };

    nodes.forEach((node) => {
      if (!groupedData[node.model_metric_name]) {
        groupedData[node.model_metric_name] = {
          previousMonth: 0,
          currentMonth: 0,
        };
        groupedDataCount[node.model_metric_name] = {
          previousMonth: 0,
          currentMonth: 0,
        };
      }
      const now = new Date();
      if (node.model_metric_name === 'success_rate') {
        if (
          node.month == now.getMonth() + 1 &&
          node.year == now.getFullYear()
        ) {
          groupedData['success_rate'].currentMonth = parseFloat(
            parseFloat(node.total) > 0
              ? parseFloat(node.value) / parseFloat(node.total)
              : 0
          );
          groupedData['error_rate'].currentMonth = parseFloat(
            parseFloat(node.total) > 0
              ? (parseFloat(node.total) - parseFloat(node.value)) /
                  parseFloat(node.total)
              : 0
          );
        } else {
          groupedData['success_rate'].previousMonth =
            parseFloat(node.total) > 0
              ? parseFloat(node.value) / parseFloat(node.total)
              : 0;
          groupedData['error_rate'].previousMonth =
            parseFloat(node.total) > 0
              ? (parseFloat(node.total) - parseFloat(node.value)) /
                parseFloat(node.total)
              : 0;
          console.log('groupedData 1', groupedData);
        }
      } else {
        if (
          node.month == now.getMonth() + 1 &&
          node.year == now.getFullYear()
        ) {
          groupedData[node.model_metric_name].currentMonth += parseFloat(
            node.value
          );
          groupedDataCount[node.model_metric_name].currentMonth += 1;
        } else {
          groupedData[node.model_metric_name].previousMonth += parseFloat(
            node.value
          );
          groupedDataCount[node.model_metric_name].previousMonth += 1;
        }
      }
    });
    console.log('groupedData', groupedData);

    // sort grouped data as accuracy, f1, success_rate, error_rate
    if (Object.keys(groupedDataCount).includes('f1')) {
      groupedData['f1'].currentMonth =
        groupedData['f1'].currentMonth /
        (groupedDataCount['f1'].currentMonth || 1);
      groupedData['f1'].previousMonth =
        groupedData['f1'].previousMonth /
        (groupedDataCount['f1'].previousMonth || 1);
    }
    if (Object.keys(groupedDataCount).includes('accuracy')) {
      groupedData['accuracy'].currentMonth =
        groupedData['accuracy'].currentMonth /
        (groupedDataCount['accuracy'].currentMonth || 1);
      groupedData['accuracy'].previousMonth =
        groupedData['accuracy'].previousMonth /
        (groupedDataCount['accuracy'].previousMonth || 1);
    }

    const sortedGroupedData = {
      f1: groupedData['f1'] || 0,
      accuracy: groupedData['accuracy'] || 0,
      success_rate: groupedData['success_rate'] || 0,
      error_rate: groupedData['error_rate'] || 0,
    };

    // Check cache first
    const cacheKey = `agent-comparison-metrics:${req.params.id}`;
    //const cachedMetrics = await redisService.get(cacheKey);
    /*
    if (cachedMetrics) {
      //return res.status(200).json(cachedMetrics);
    }*/

    // If not in cache, get metrics and cache them
    await redisService.set(cacheKey, sortedGroupedData);

    res.status(200).json(sortedGroupedData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAgentToolComparisonMetricsLastMonthAgent = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;
    const cacheKey = `agent-tool-comparison-metrics:${req.params.id}`;
    const cachedMetrics = await redisService.get(cacheKey);

    if (cachedMetrics) {
      //return res.status(200).json(cachedMetrics);
    }

    const company = await db.Company.findOne({
      where: { id: companyId },
    });
    const agent = await db.Agent.findOne({
      where: { id: req.params.id },
    });
    if (company.testMode || agent.tourAgent || agent.demoAgent) {
      return res.status(200).json(generateMockToolComparisonMetrics());
    }
    // Get agent and verify access
    const nodes = await db.sequelize.query(
      `
      SELECT 
        EXTRACT(MONTH FROM anl.created_at) as month,
        EXTRACT(YEAR FROM anl.created_at) as year,
        SUM(CASE WHEN anl.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN anl.status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM "AgentNodes" an
      INNER JOIN "AgentNodeLogs" anl ON anl.agent_node_id = an.id
      WHERE an.type = 'tool'
      AND anl.created_at > '${new Date(
        new Date() - 59 * 24 * 60 * 60 * 1000
      ).toLocaleString()}'
      AND an.id = ${req.params.id}
      GROUP BY 1,2
      `,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    let total_current_month = 0;
    let total_previous_month = 0;
    let success_current_month = 0;
    let success_previous_month = 0;
    let error_current_month = 0;
    let error_previous_month = 0;

    nodes.forEach((node) => {
      const now = new Date();
      if (node.month == now.getMonth() + 1 && node.year == now.getFullYear()) {
        total_current_month += parseFloat(node.success_count);
        total_current_month += parseFloat(node.error_count);
        success_current_month += parseFloat(node.success_count);
        error_current_month += parseFloat(node.error_count);
      } else {
        total_previous_month += parseFloat(node.success_count);
        total_previous_month += parseFloat(node.error_count);
        success_previous_month += parseFloat(node.success_count);
        error_previous_month += parseFloat(node.error_count);
      }
    });

    const groupedData = {
      success_rate: {
        currentMonth:
          total_current_month > 0
            ? success_current_month / total_current_month
            : 0,
        previousMonth:
          total_previous_month > 0
            ? success_previous_month / total_previous_month
            : 0,
      },
      error_rate: {
        currentMonth:
          total_current_month > 0
            ? error_current_month / total_current_month
            : 0,
        previousMonth:
          total_previous_month > 0
            ? error_previous_month / total_previous_month
            : 0,
      },
    };

    // Check cache first

    await redisService.set(cacheKey, groupedData);

    res.status(200).json(groupedData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAgentEntries = async (req, res) => {
  try {
    let { id } = req.params;
    const { userObject } = req;
    let { companyId } = userObject;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const query = req.query.query || '';
    const environment = getEnvironment(req);
    const status = req.query.status || 'all';
    const filteredNode = req.query.filteredNode || null;
    const filteredNodeType = req.query.filteredNodeType || null;
    let date = req.query.date || null;
    if (date === '' || date === 'null') {
      date = null;
    }
    // Get agent and verify access
    let company = await db.Company.findOne({
      where: { id: companyId },
    });
    // If company is in test mode, generate mock entries
    if (company.testMode) {
      /*const mockEntries = generateMockEmailEntries(limit, page);
      return res.status(200).json({
        entries: mockEntries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 20,
          totalPages: 2,
          totalEvaluated: 10,
          totalFailedModelEntries: 5,
          totalFailedEntries: 8,
        },
      });*/
      companyId = 63;
      company = await db.Company.findOne({
        where: { id: companyId },
      });
      id = 39;
    }

    let response = null;

    if (!query || query === '') {
      // Try to get metadata first
      const metadataKey = `agent-entries-metadata:${id}:${environment}:${status}`;
      const metadata = await redisService.get(metadataKey);

      // Try to get the specific page from cache
      const pageKey = `agent-entries:${id}:page:${page}:limit:${limit}:${environment}:${status}`;
      const cachedPage = await redisService.get(pageKey);

      if (metadata && cachedPage) {
        /*response = {
          entries: cachedPage,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: metadata.total,
            totalFailedEntries: metadata.totalFailedEntries,
            totalFailedModelEntries: metadata.totalFailedModelEntries,
            totalPages: metadata.totalPages,
          },
        };*/
      }
    }
    if (!response) {
      console.log('Cache miss, generating new entries for agent:', id);
      response = await updateAgentEntriesCache(
        id,
        page,
        limit,
        environment,
        status,
        query,
        filteredNode,
        filteredNodeType,
        date
      );
    }

    // Set headers for chunked transfer
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream the response in chunks
    const entries = response?.entries || [];

    // Start the response with the pagination info
    res.write(
      '{"pagination":' + JSON.stringify(response.pagination) + ',"entries":['
    );

    // Stream entries in chunks
    for (let i = 0; i < entries.length; i++) {
      const isLast = i === entries.length - 1;
      res.write(JSON.stringify(entries[i]) + (isLast ? '' : ','));
    }

    // End the response
    res.write(']}');
    res.end();
  } catch (error) {
    console.error('Error in getAgentEntries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAgentEntryFlow = async (req, res) => {
  try {
    const { userObject } = req;
    let { companyId } = userObject;
    let { entryId, agentId } = req.params;
    const { mockFail } = req.query;

    let company = await db.Company.findOne({
      where: { id: companyId },
    });

    // Set headers for chunked transfer
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Check cache first
    const cacheKey = `agent-entry-flow:${agentId}:${entryId}`;
    const cachedFlow = await redisService.get(cacheKey);

    if (cachedFlow) {
      //res.write(JSON.stringify(cachedFlow));
      //return res.end();
    }

    // If company is in test mode, return mock flow data based on the agent
    if (company?.testMode) {
      companyId = 63;
      company = await db.Company.findOne({
        where: { id: companyId },
      });
      agentId = 39;
    }

    const steps = await db.sequelize.query(
      `
      WITH model_logs AS (
        SELECT 'model' as type,
        '' as operationType,
        '{}'::json as metadata,
        "AgentNodes"."id" as nodeId,
        "AgentNodes"."name" as nodeName,
        "Models"."id" as modelId,
        "Models"."name" as modelName,
        "ModelLogs"."created_at" as timestamp,
        0 as duration,
        (Case When "ModelLogs"."status" = 'success' Then 'success' Else 'error' End)::enum_agent_node_logs_status as status,
        "ModelLogs"."input" as input,
        "ModelLogs"."output" as output,
        "ModelLogs"."actual" as actual,
        "ModelLogs"."id" as logId,
        "AgentNodes"."mapping_node_id" as mappingNodeId
        FROM "AgentLogs"
          INNER JOIN "ModelLogs" ON "AgentLogs"."id" = "ModelLogs"."agent_log_id"
          INNER JOIN "Models" ON "ModelLogs"."model_id" = "Models"."id"
          INNER JOIN "AgentNodes" ON "AgentNodes"."model_id" = "Models"."id"
            WHERE "AgentLogs"."agent_id" = :agentId
            AND "AgentLogs"."id" = :entryId
            AND "AgentNodes"."deleted_at" IS NULL
      ), tool_logs AS (
        SELECT 'model' as type,
        "AgentNodeLogs"."operation_type" as operationType,
        "AgentNodeLogs"."metadata" as metadata,
        "AgentNodes"."id" as nodeId,
        "AgentNodes"."name" as nodeName,
        0 as modelId,
        '' as modelName,
        "AgentNodeLogs"."created_at" as timestamp,
        "AgentNodeLogs"."duration" as duration,
        "AgentNodeLogs"."status" as status,
        "AgentNodeLogs"."input" as input,
        "AgentNodeLogs"."output" as output,
        '{}'::json as actual,
        "AgentNodeLogs"."id" as logId,
        "AgentNodes"."mapping_node_id" as mappingNodeId
        FROM "AgentLogs"
        INNER JOIN "AgentNodeLogs" ON "AgentLogs"."id" = "AgentNodeLogs"."parent_log_id"
        INNER JOIN "AgentNodes" ON "AgentNodeLogs"."agent_node_id" = "AgentNodes"."id"
          WHERE "AgentLogs"."agent_id" = :agentId
          AND "AgentLogs"."id" = :entryId
          AND "AgentNodes"."deleted_at" IS NULL
      )

      SELECT 
        type,
        operationType,
        metadata,
        nodeId,
        nodeName,
        modelId,
        modelName,
        timestamp,
        duration,
        status,
        input,
        output,
        actual,
        logId,
        mappingNodeId
      FROM model_logs
      UNION ALL
      SELECT * FROM tool_logs
      ORDER BY timestamp ASC
      `,
      {
        replacements: { agentId, entryId },
      }
    );

    const stepsProccessed = steps[0].map((step) => {

      return {
        ...step,
        operationType: step.operationtype || 'unknown',
        metadata: step.metadata || '{}',
        nodeId: step.nodeid || 'unknown',
        nodeName: step.nodename || 'unknown',
        modelId: step.modelid || 'unknown',
        modelName: step.modelname || 'unknown',
        timestamp: step.timestamp || 'unknown',
        duration: parseInt(step.duration) || null,
        logId: step.logid || 'unknown',
      };
    });

    const flow = {
      steps: stepsProccessed,
    };

    // Cache the flow data
    await redisService.set(cacheKey, flow, 3600); // Cache for 1 hour

    // Stream the response
    res.write(JSON.stringify(flow));
    res.end();
  } catch (error) {
    console.error('Error in getAgentEntryFlow:', error);
    res.write(JSON.stringify({ error: 'Internal server error' }));
    res.end();
  }
};


// Helper function to generate mock email entries
function generateMockEmailEntries(limit, page) {
  const mockScenarios = [
    {
      scenario: 'Senior Software Engineer Candidate',
      context: {
        candidate: {
          name: 'Alex Chen',
          title: 'Senior Software Engineer',
          company: 'TechInnovate Solutions',
          experience: '8 years of full-stack development experience',
          location: 'San Francisco Bay Area',
          education: 'M.S. Computer Science, UC Berkeley',
          skills: ['React', 'Node.js', 'AWS', 'Microservices', 'TypeScript'],
        },
        outreach: {
          status: 'interview_scheduled',
          platform: 'LinkedIn',
          message_template: 'experienced_developer',
          response_time: '4 hours',
        },
      },
      input: `Find qualified Senior Software Engineer candidates with React and Node.js experience in the San Francisco area`,
      output: `I've identified Alex Chen as a strong candidate for the Senior Software Engineer position:

- Currently at TechInnovate Solutions
- 8 years of full-stack development experience
- Expert in React, Node.js, AWS, and TypeScript
- Located in San Francisco
- M.S. in Computer Science from UC Berkeley

I've sent a personalized outreach message highlighting our flexible work environment and innovative projects. Alex responded positively within 4 hours, and I've scheduled an initial screening interview for next Tuesday at 2:00 PM.`,
    },
    {
      scenario: 'Product Manager Candidate',
      context: {
        candidate: {
          name: 'Sarah Johnson',
          title: 'Senior Product Manager',
          company: 'ProductVision Inc.',
          experience:
            'Led product teams for 6+ years, launched 4 successful SaaS products',
          location: 'New York City',
          education: 'MBA, Columbia Business School',
          skills: [
            'Product Strategy',
            'User Research',
            'Agile Methodologies',
            'Data Analytics',
            'Cross-functional Leadership',
          ],
        },
        outreach: {
          status: 'assessment_sent',
          platform: 'LinkedIn',
          message_template: 'product_leadership',
          response_time: '1 day',
        },
      },
      input: `Source experienced Product Managers with SaaS experience and strong leadership skills`,
      output: `I've identified Sarah Johnson as an excellent Product Manager candidate:

- Currently Senior Product Manager at ProductVision Inc.
- 6+ years leading product teams
- Successfully launched 4 SaaS products
- MBA from Columbia Business School
- Strong skills in product strategy, user research, and data analytics

I sent a personalized message highlighting our company's product-led growth strategy and innovative work culture. Sarah responded with interest after 1 day. I've sent her our product case study assessment and scheduled a follow-up call for next week.`,
    },
    {
      scenario: 'DevOps Engineer Candidate',
      context: {
        candidate: {
          name: 'Miguel Rodriguez',
          title: 'DevOps Engineer',
          company: 'CloudScale Technologies',
          experience: '5 years specializing in CI/CD pipelines and Kubernetes',
          location: 'Remote (based in Austin)',
          education: 'B.S. Computer Engineering, University of Texas',
          skills: [
            'Kubernetes',
            'Docker',
            'Terraform',
            'AWS',
            'CI/CD',
            'Python',
          ],
        },
        outreach: {
          status: 'technical_interview',
          platform: 'GitHub',
          message_template: 'devops_specialist',
          response_time: '6 hours',
        },
      },
      input: `Find DevOps engineers with Kubernetes experience who are open to remote work`,
      output: `I've identified Miguel Rodriguez as a strong DevOps Engineer candidate:

- Currently at CloudScale Technologies
- 5 years of specialized experience in CI/CD and Kubernetes
- Expert in Docker, Terraform, AWS, and Python
- Based in Austin but open to remote work
- Active open-source contributor on GitHub

I reached out via GitHub after noticing his contributions to several Kubernetes projects. Miguel responded within 6 hours expressing strong interest. I've reviewed his technical background and scheduled him for a technical interview with the DevOps team lead for next Thursday.`,
    },
    {
      scenario: 'UX/UI Designer Candidate',
      context: {
        candidate: {
          name: 'Priya Patel',
          title: 'Senior UX Designer',
          company: 'DesignFirst Digital',
          experience:
            '7 years creating user-centered designs for web and mobile applications',
          location: 'Chicago',
          education: 'MFA Design, Rhode Island School of Design',
          skills: [
            'User Research',
            'Wireframing',
            'Prototyping',
            'Figma',
            'Adobe Creative Suite',
            'Design Systems',
          ],
        },
        outreach: {
          status: 'portfolio_review',
          platform: 'Dribbble',
          message_template: 'creative_design',
          response_time: '2 days',
        },
      },
      input: `Source experienced UX/UI designers with strong portfolio work in web applications`,
      output: `I've identified Priya Patel as an exceptional UX/UI Designer candidate:

- Currently Senior UX Designer at DesignFirst Digital
- 7 years of experience in user-centered design
- MFA in Design from Rhode Island School of Design
- Expert in user research, wireframing, and design systems
- Impressive portfolio on Dribbble showcasing web application projects

I reached out after reviewing her outstanding portfolio work. Priya responded after 2 days with interest in our company's design-focused approach. I've scheduled a portfolio review session with our Creative Director for next Monday and shared our design challenge brief.`,
    },
    {
      scenario: 'Data Scientist Candidate',
      context: {
        candidate: {
          name: 'James Wilson',
          title: 'Data Scientist',
          company: 'AnalyticsPro',
          experience: '4 years applying machine learning to business problems',
          location: 'Boston',
          education: 'Ph.D. Statistics, MIT',
          skills: [
            'Python',
            'Machine Learning',
            'TensorFlow',
            'SQL',
            'Data Visualization',
            'Statistical Analysis',
          ],
        },
        outreach: {
          status: 'technical_assessment',
          platform: 'LinkedIn',
          message_template: 'data_science_specialist',
          response_time: '5 hours',
        },
      },
      input: `Find data scientists with machine learning experience and strong academic backgrounds`,
      output: `I've identified James Wilson as a promising Data Scientist candidate:

- Currently at AnalyticsPro
- Ph.D. in Statistics from MIT
- 4 years applying machine learning to solve business problems
- Strong skills in Python, TensorFlow, and data visualization
- Published research on predictive analytics

I sent a personalized message highlighting our data-driven culture and challenging projects. James responded within 5 hours showing strong interest. I've sent him our technical assessment focused on predictive modeling and scheduled a follow-up discussion with our Data Science team lead.`,
    },
  ];

  // Generate entries based on the mock scenarios
  const entries = [];
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, 100); // Assume max 100 entries

  for (let i = startIndex; i < endIndex; i++) {
    const scenarioIndex = i % mockScenarios.length;
    const scenario = mockScenarios[scenarioIndex];

    // Create a date that's i days ago
    const date = new Date();
    date.setDate(date.getDate() - (i % 30));

    entries.push({
      id: 1000 + i,
      status: ['success', 'failed'][Math.floor(Math.random() * 2)],
      duration: Math.floor(Math.random() * 5000) + 1000,
      createdAt: date.toISOString(),
      summary:
        scenario.scenario +
        ': ' +
        scenario.context.candidate.name +
        ' - ' +
        scenario.context.outreach.status,
    });
  }

  return entries;
}

export const cloneAgent = async (req, res) => {
  try {
    const { userObject } = req;
    const { companyId } = userObject;
    const { id: sourceAgentId } = req.params;
    let { name } = req.body;
    // Find source agent and verify ownership
    const sourceAgent = await Agent.findOne({
      where: {
        id: sourceAgentId,
        companyId,
      },
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: Model,
              as: 'Model',
            },
          ],
        },
        {
          model: AgentConnection,
          as: 'AgentConnections',
        },
      ],
    });

    if (!name) {
      name = `Cloned Agent ${sourceAgent.name}`;
    }

    if (!sourceAgent) {
      return res
        .status(404)
        .json({ error: 'Source agent not found or access denied' });
    }

    // Create new agent with all properties
    const clonedAgent = await Agent.create({
      name,
      description: sourceAgent.description,
      companyId,
      autoCapture: sourceAgent.autoCapture,
      autoStop: sourceAgent.autoStop,
      // The slug will be auto-generated by the model hooks
    });

    // Map to store old node IDs to new node IDs
    const nodeIdMap = new Map();

    // Clone nodes and their associated models
    for (const sourceNode of sourceAgent.AgentNodes) {
      let clonedModel = null;

      // If the node has an associated model, clone it
      if (sourceNode.Model) {
        const sourceModel = sourceNode.Model;

        // Clone the model
        clonedModel = await Model.create({
          name: `${sourceModel.name} (Cloned)`,
          description: sourceModel.description,
          modelGroupId: sourceModel.modelGroupId,
          type: sourceModel.type,
          config: sourceModel.config,
          provider: sourceModel.provider,
          status: sourceModel.status,
          parameters: sourceModel.parameters,
          active: sourceModel.active,
          isReviewer: sourceModel.isReviewer,
          isOptimized: sourceModel.isOptimized,
        });

        // Clone associated model metrics
        const sourceModelMetrics = await db.ModelMetric.findAll({
          where: { modelId: sourceModel.id },
        });

        for (const metric of sourceModelMetrics) {
          await db.ModelMetric.create({
            modelId: clonedModel.id,
            name: metric.name,
            type: metric.type,
            label: metric.label,
            description: metric.description,
            threshold: metric.threshold,
            thresholdType: metric.thresholdType,
            severity: metric.severity,
            active: metric.active,
          });
        }
      }

      // Clone the node with all properties
      const clonedNode = await AgentNode.create({
        name: sourceNode.name,
        type: sourceNode.type,
        config: sourceNode.config,
        agentId: clonedAgent.id,
        modelId: clonedModel?.id || null,
        initialNode: sourceNode.initialNode,
        endNode: sourceNode.endNode,
        slug: null, // Let the model hooks generate a new slug
      });

      // Store the ID mapping
      nodeIdMap.set(sourceNode.id, clonedNode.id);
    }

    // Clone connections using the new node IDs
    for (const connection of sourceAgent.AgentConnections) {
      await AgentConnection.create({
        agentId: clonedAgent.id,
        fromNodeId: nodeIdMap.get(connection.fromNodeId),
        toNodeId: nodeIdMap.get(connection.toNodeId),
        inputName: connection.inputName,
        outputName: connection.outputName,
      });
    }

    // Fetch the complete cloned agent with its relationships
    const completeClonedAgent = await Agent.findOne({
      where: { id: clonedAgent.id },
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: Model,
              as: 'Model',
            },
          ],
        },
        {
          model: AgentConnection,
          as: 'AgentConnections',
        },
      ],
    });

    res.status(201).json(completeClonedAgent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAgentEntry = async (req, res) => {
  try {
    const { agentId, entryId } = req.params;
    const { userObject } = req;
    const { companyId } = userObject;
    const company = await Company.findOne({
      where: { id: companyId },
    });

    // If company is in test mode, generate mock entry
    if (company.testMode) {
      const mockEntries = generateMockEmailEntries(1, 1);
      return res.status(200).json({
        entries: mockEntries,
        pagination: {
          page: 1,
          limit: 1,
          total: 10,
          totalPages: 10,
          totalEvaluated: 10,
          totalFailedModelEntries: 5,
          totalFailedEntries: mockEntries[0].status === 'failed' ? 1 : 0,
        },
      });
    }
    const entry = await db.sequelize.query(
      `
      SELECT 
        "AgentLogs"."id",
        "AgentLogs"."input",
        "AgentLogs"."output",
        "AgentLogs"."status",
        "AgentLogs"."duration",
        "AgentLogs"."error_details" as "errorDetails",
        "AgentLogs"."created_at" as "createdAt",
        "AgentLogs"."metadata"
      FROM "AgentLogs"
      WHERE "agent_id" = :agentId
      AND "id" = :entryId
      LIMIT 1
      `,
      {
        replacements: {
          agentId,
          entryId,
        },
        type: db.sequelize.QueryTypes.SELECT,
      }
    );

    console.log('after');

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Transform the entry to match the format of getAgentEntries
    // Set headers for chunked transfer
    res.write(
      JSON.stringify({
        pagination: {
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
          totalFailedEntries: entry[0].status === 'failed' ? 1 : 0,
        },
        entries: [entry[0]],
      })
    );

    res.end();
  } catch (error) {
    console.error('Error in getAgentEntry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadAgent = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the uploaded JSON file
    const rawConfig = JSON.parse(req.file.buffer.toString());
    const isN8N = rawConfig.versionId ? true : false;
    // Use AI to parse and structure the configuration
    const parsedConfig = await parseAgentConfig(rawConfig);

    // Create the agent and related records
    const agent = await createAgentFromConfig(
      parsedConfig,
      req.userObject.companyId,
      isN8N
    );

    res.status(201).json({
      message: 'Agent created successfully',
      agent,
    });
  } catch (error) {
    console.error('Error uploading agent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAgentCorrectEntriesByDay = async (req, res) => {
  try {
    const agentId = req.params.id;
    // Get all model nodes for this agent
    const modelNodes = await AgentNode.findAll({
      where: { agentId, type: 'model', deletedAt: null },
      attributes: ['modelId'],
    });
    const modelIds = modelNodes.map(n => n.modelId).filter(Boolean);
    if (!modelIds.length) {
      return res.status(404).json({ error: 'No models found for this agent' });
    }
    const sinceDate = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);
    const { sequelize } = db;
    // Correct entries
    const correctResults = await sequelize.query(
      `
        SELECT DATE_TRUNC('day', "created_at") as day, COUNT(*) as count
        FROM "ModelLogs"
        WHERE model_id IN (:modelIds)
          AND processed = true
          AND actual IS NOT NULL
          AND created_at > :sinceDate
          AND status = 'success'
          AND environment = 'production'
        GROUP BY DATE_TRUNC('day', "created_at")
      `,
      {
        replacements: { modelIds, sinceDate },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    // Incorrect entries
    const incorrectResults = await sequelize.query(
      `
        SELECT DATE_TRUNC('day', "created_at") as day, COUNT(*) as count
        FROM "ModelLogs"
        WHERE model_id IN (:modelIds)
          AND processed = true
          AND created_at > :sinceDate
          AND status <> 'success'
          AND actual IS NOT NULL
          AND environment = 'production'
        GROUP BY DATE_TRUNC('day', "created_at")
      `,
      {
        replacements: { modelIds, sinceDate },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    // Build the response for the last 30 days
    const days = [];
    const correctEntriesByDay = {};
    const incorrectEntriesByDay = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().split('T')[0] + 'T00:00:00.000Z';
      days.push(key);
      correctEntriesByDay[key] = 0;
      incorrectEntriesByDay[key] = 0;
    }
    correctResults.forEach(row => {
      const key = new Date(row.day).toISOString().split('T')[0] + 'T00:00:00.000Z';
      if (correctEntriesByDay[key] !== undefined) correctEntriesByDay[key] = parseInt(row.count);
    });
    incorrectResults.forEach(row => {
      const key = new Date(row.day).toISOString().split('T')[0] + 'T00:00:00.000Z';
      if (incorrectEntriesByDay[key] !== undefined) incorrectEntriesByDay[key] = parseInt(row.count);
    });
    return res.status(200).json({ correctEntriesByDay, incorrectEntriesByDay });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
