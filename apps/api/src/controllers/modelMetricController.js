import db from '../../models/index.js';
import { getModelCorrectEntriesByDay, getModelLastModelMetrics,   getModelNumberOfAlertsByType,
} from '../services/modelMetricsCalculationService.js';
import {
  getModelEntriesCountByClass,
  getModelDifferenceLastWeekByClass,
  getModelComparisonMetricsLastMonth,
} from '../services/modelMetricService.js';
import { redisService } from '../services/redisService.js';
const { ModelMetric, Model, ModelGroup } = db;
const { sequelize } = db;

const generateMockComparisonMetrics = () => {
  return {
    "Healtcheck": {
        "previousMonth": 0,
        "currentMonth": 1
    },
    "f1": {
        "previousMonth": 0.43,
        "currentMonth": 0.851063829787234
    },
    "recall": {
        "previousMonth": 0.34,
        "currentMonth": 0.551063829787234
    },
    "precision": {
        "previousMonth": 0.52,
        "currentMonth": 0.351063829787234
    },
    "accuracy": {
        "previousMonth": 0.33,
        "currentMonth": 0.9787611408199643
    }
  };
};

export const getComparisonMetricsLastMonth = async (req, res) => {
  try {
    const { userObject } = req;
  const company = await db.Company.findOne({
    where: { id: userObject.companyId },
  });

  const agentNodes = await db.AgentNode.findAll({
    where: {
      modelId: req.params.id,
    },
  });

  const agent = await db.Agent.findOne({
    where: { id: agentNodes[0]?.agentId },
  });
  if (company.testMode || agent?.tourAgent || agent?.demoAgent) {
    return res.status(200).json(generateMockComparisonMetrics());
  }

  const nodes = await db.sequelize.query(
    `
    SELECT 
      mm.name as model_metric_name,
      EXTRACT(MONTH FROM mml.created_at) as month,
      EXTRACT(YEAR FROM mml.created_at) as year,
      AVG(mml.value) as value
    FROM "Models" m
    INNER JOIN "ModelMetrics" mm ON mm.model_id = m.id
    INNER JOIN "ModelMetricLogs" mml ON mml.model_metric_id = mm.id
    WHERE m.id = ${req.params.id}
    AND mml.created_at > '${new Date(
      new Date() - 59 * 24 * 60 * 60 * 1000
    ).toLocaleString()}'
    GROUP BY 1,2,3
    `,
    { type: db.sequelize.QueryTypes.SELECT }
  );

  const groupedData = {};
  const countGroupedData = {};
  nodes.forEach((node) => {
    if (!groupedData[node.model_metric_name]) {
      groupedData[node.model_metric_name] = {
        previousMonth: 0,
        currentMonth: 0,
      };
      countGroupedData[node.model_metric_name] = {
        previousMonth: 0,
        currentMonth: 0,
      };
    }
    const now = new Date();
    if (node.month == (now.getMonth() + 1) && node.year == now.getFullYear()) {
      groupedData[node.model_metric_name].currentMonth += parseFloat(node.value);
      countGroupedData[node.model_metric_name].currentMonth += 1;
    } else {
      groupedData[node.model_metric_name].previousMonth += parseFloat(node.value);
      countGroupedData[node.model_metric_name].previousMonth += 1;
    }
  });

  for (const key in groupedData) {
    groupedData[key].currentMonth = groupedData[key].currentMonth / countGroupedData[key].currentMonth;
    groupedData[key].previousMonth = groupedData[key].previousMonth / countGroupedData[key].previousMonth;
  }

    
    res.status(200).json(groupedData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getModelMetricsOfModel = async (req, res) => {
  const model = await Model.findByPk(req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const cacheKey = `model-metrics-detail:${model.id}`;
    const cachedData = await redisService.get(cacheKey);
    
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const companyMetric = await model.saveModelMetricsInCache();
    
    res.status(200).json(companyMetric);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getEntriesCountByClass = async (req, res) => {
  const model = await Model.findByPk(req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const positiveEntries = await getModelEntriesCountByClass(model.id);
    res.status(200).json(positiveEntries);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getLastModelMetrics = async (req, res) => {
  const model = await Model.findByPk(req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const lastModelMetrics = await getModelLastModelMetrics(model.id, sequelize);
    res.status(200).json(lastModelMetrics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getDifferenceLastWeekByClass = async (req, res) => {
  const model = await Model.findByPk(req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const differenceLastWeekByClass = await getModelDifferenceLastWeekByClass(model.id);
    res.status(200).json(differenceLastWeekByClass);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getNumberOfAlertsByType = async (req, res) => {
  const model = await Model.findByPk(req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const numberOfAlertsByType = await getModelNumberOfAlertsByType(model.id, sequelize);
    res.status(200).json(numberOfAlertsByType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getCorrectEntriesByDay = async (req, res) => {
  const model = await Model.findByPk(req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const correctEntries = await getModelCorrectEntriesByDay(model.id, sequelize);
    res.status(200).json(correctEntries);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const createModelMetric = async (req, res) => {
  try {
    const currentValue = req.body.currentValue;
    const modelMetric = await ModelMetric.create(req.body);

    if (currentValue !== undefined) {
      await modelMetric.createModelMetricLog({ value: currentValue });
    }
    res.status(201).json(modelMetric);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllModelMetrics = async (req, res) => {
  try {
    const modelMetrics = await ModelMetric.findAll();
    res.status(200).json(modelMetrics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getModelMetricById = async (req, res) => {
  try {
    const modelMetric = await ModelMetric.findByPk(req.params.id);
    if (!modelMetric) {
      return res.status(404).json({ error: 'Model Metric not found' });
    }
    res.status(200).json(modelMetric);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateModelMetric = async (req, res) => {
  try {
    const modelMetric = await ModelMetric.findByPk(req.params.id);
    if (!modelMetric) {
      return res.status(404).json({ error: 'Model Metric not found' });
    }
    await modelMetric.update(req.body);
    res.status(200).json(modelMetric);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteModelMetric = async (req, res) => {
  try {
    const modelMetric = await ModelMetric.findByPk(req.params.id);
    if (!modelMetric) {
      return res.status(404).json({ error: 'Model Metric not found' });
    }
    await modelMetric.destroy();
    res.status(204).json();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


export const me = async (req, res) => {
  const { userObject } = req;
  const companyId = userObject.companyId;

  try {
    // Get all models for the company

    const modelGroups = await ModelGroup.findAll({
      where: { companyId },
    });

    const models = await Model.findAll({
      where: { modelGroupId: modelGroups.map((modelGroup) => modelGroup.id) },
    });

    // Initialize response array
    let companyMetrics = [];

    // Process each model
    await Promise.all(models.map(async (model) => {
      const cacheKey = `model-metrics-monitoring:${model.id}`;
      let modelMetrics = await redisService.get(cacheKey);
      //let modelMetrics = null;
      // If no cache or model was recently updated, calculate metrics
      if (!modelMetrics) {
        modelMetrics = await model.saveModelMetricsOfModelMonitoringInCache();
      }

      companyMetrics.push(modelMetrics);
    }));

    res.status(200).json(companyMetrics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
