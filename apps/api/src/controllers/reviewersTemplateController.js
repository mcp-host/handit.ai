import db from '../../models/index.js';
import { QueryTypes } from 'sequelize';

const { EvaluationPrompt, ModelEvaluationPrompt, EvaluatorMetric } = db;

export async function createEvaluationPrompt(req, res) {
  try {
    
    const { name, prompt, defaultProviderModel, defaultIntegrationTokenId } = req.body;
    const companyId = req.userObject?.companyId || req.company?.id;
    const metric = await EvaluatorMetric.create({ name, companyId });

    const newPrompt = await EvaluationPrompt.create({
      name,
      prompt,
      metricId: metric.id,
      isGlobal: false,
      companyId,
      defaultProviderModel,
      defaultIntegrationTokenId,
    });
    return res.status(201).json({ success: true, data: newPrompt });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateEvaluationPrompt(req, res) {
  try {
    const { id } = req.params;
    const { name, prompt, defaultProviderModel, defaultIntegrationTokenId } = req.body;
    const companyId = req.userObject?.companyId || req.company?.id;
    const template = await EvaluationPrompt.findOne({ where: { id, companyId } });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found or not owned by your company.' });
    }

    template.name = name ?? template.name;
    template.prompt = prompt ?? template.prompt;
    template.defaultProviderModel = defaultProviderModel ?? template.defaultProviderModel;
    template.defaultIntegrationTokenId = defaultIntegrationTokenId ?? template.defaultIntegrationTokenId;
    await template.save();
    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEvaluationPrompts(req, res) {
  try {
    const companyId = req.userObject?.companyId || req.company?.id;
    const prompts = await EvaluationPrompt.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { isGlobal: true },
          { companyId },
        ],
      },
      order: [['isGlobal', 'DESC'], ['createdAt', 'DESC']],
      include: [
        {
          model: db.IntegrationToken,
          as: 'defaultIntegrationToken',
          attributes: ['id', 'name', 'providerId'],
        },
        {
          model: db.ModelEvaluationPrompt,
          as: 'modelAssociations',
          include: [
            {
              model: db.Model,
              as: 'model',
              attributes: ['id', 'name', 'parameters'],
            },
            {
              model: db.IntegrationToken,
              as: 'integrationToken',
              attributes: ['id', 'name', 'providerId'],
            },
          ],
        },
        {
          model: db.EvaluatorMetric,
          as: 'metric',
        },
      ],
    });

    // Format associations for frontend
    const data = prompts.map(prompt => {
      const associations = (prompt.modelAssociations || []).map(assoc => ({
        id: assoc.id,
        modelId: assoc.modelId,
        providerId: assoc.integrationToken?.providerId || null,
        providerModel: assoc.model?.parameters?.providerModel || null,
        tokenId: assoc.integrationTokenId,
        modelName: assoc.model?.name,
        tokenName: assoc.integrationToken?.name,
      }));
      return {
        ...prompt.toJSON(),
        associations,
        metric: prompt.metric || null,
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function associatePromptToModel(req, res) {
  try {
    const { modelId } = req.params;
    const { evaluationPromptId, integrationTokenId, providerModel } = req.body;
    const companyId = req.userObject?.companyId || req.company?.id;
    // Only allow association if prompt is global or belongs to company
    const prompt = await EvaluationPrompt.findOne({
      where: {
        id: evaluationPromptId,
        [db.Sequelize.Op.or]: [
          { isGlobal: true },
          { companyId },
        ],
      },
    });
    if (!prompt) {
      return res.status(404).json({ success: false, message: 'Prompt not found or not accessible.' });
    }
    // Check if association already exists
    const exists = await ModelEvaluationPrompt.findOne({ where: { modelId, evaluationPromptId } });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Prompt already associated with model.' });
    }
    console.log('integrationTokenId', integrationTokenId);
    console.log('providerModel', providerModel);
    const association = await ModelEvaluationPrompt.create({ modelId, evaluationPromptId, integrationTokenId, providerModel });
    return res.status(201).json({ success: true, data: association });
  } catch (error) {
    console.log('error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPromptsForModel(req, res) {
  try {
    const { modelId } = req.params;
    const associations = await ModelEvaluationPrompt.findAll({
      where: { modelId },
      include: [
        { model: EvaluationPrompt, as: 'evaluationPrompt' },
        { model: db.IntegrationToken, as: 'integrationToken' },
      ],
    });
    // Return both the association and the evaluation prompt
    const prompts = associations.map(a => ({
      // Association fields
      modelId: a.modelId,
      evaluationPromptId: a.evaluationPromptId,
      integrationTokenId: a.integrationTokenId,
      providerModel: a.providerModel,
      // Optionally include token info
      token: a.integrationToken ? {
        id: a.integrationToken.id,
        name: a.integrationToken.name,
        providerId: a.integrationToken.providerId,
      } : null,
      // Evaluation prompt fields
      ...a.evaluationPrompt?.toJSON(),
      id: a.id,
    }));

    return res.json({ success: true, data: prompts });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateAssociation(req, res) {
  try {
    const { id } = req.params;
    const { integrationTokenId, providerModel } = req.body;
    const assoc = await ModelEvaluationPrompt.findByPk(id);
    if (!assoc) {
      return res.status(404).json({ success: false, message: 'Association not found.' });
    }
    assoc.integrationTokenId = integrationTokenId ?? assoc.integrationTokenId;
    assoc.providerModel = providerModel ?? assoc.providerModel;
    await assoc.save();
    return res.json({ success: true, data: assoc });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteAssociation(req, res) {
  try {
    const { id } = req.params;
    const assoc = await ModelEvaluationPrompt.findByPk(id);
    if (!assoc) {
      return res.status(404).json({ success: false, message: 'Association not found.' });
    }
    await assoc.destroy();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEvaluationPromptStats(req, res) {
  try {
    const companyId = req.userObject?.companyId || req.company?.id;
    const sequelize = db.sequelize;
    // 1. Get all modelGroupIds for the company
    const modelGroups = await sequelize.query(
      'SELECT id FROM "ModelGroups" WHERE company_id = :companyId',
      { replacements: { companyId }, type: QueryTypes.SELECT }
    );
    const modelGroupIds = modelGroups.map(g => g.id);
    if (!modelGroupIds.length) return res.json({ success: true, data: [] });
    // 2. Get all modelIds for those groups
    const models = await sequelize.query(
      'SELECT id FROM "Models" WHERE model_group_id IN (:modelGroupIds)',
      { replacements: { modelGroupIds }, type: QueryTypes.SELECT }
    );
    const modelIds = models.map(m => m.id);
    if (!modelIds.length) return res.json({ success: true, data: [] });
    // 3. Get stats for all evaluators for these models
    const stats = await sequelize.query(
      `SELECT el.evaluation_prompt_id as evaluatorId,
              COUNT(*) as total,
              SUM(CASE WHEN el.is_correct = true THEN 1 ELSE 0 END) as success,
              MAX(el.created_at) as lastEvaluation
       FROM "EvaluationLogs" el
       WHERE el.model_id IN (:modelIds)
       GROUP BY el.evaluation_prompt_id`,
      { replacements: { modelIds }, type: QueryTypes.SELECT }
    );
    // 4. Format: add successRate
    const formatted = stats.map(s => ({
      evaluatorId: s.evaluatorid || s.evaluatorId,
      total: Number(s.total),
      success: Number(s.success),
      successRate: s.total > 0 ? Number(s.success) / Number(s.total) : null,
      lastEvaluation: s.lastevaluation || s.lastEvaluation,
    }));
    return res.json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
} 