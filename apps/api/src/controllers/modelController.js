import db from '../../models/index.js';

const { Model, ModelGroup } = db;


export const createModel = async (req, res) => {
  try {
    //const answer = await checkSubscriptionLimits(req.userObject.id, 'models');
     /*if(!answer) {
     return res.status(400).json({ error: 'Subscription limit reached' });
    }*/
    const { userObject } = req;
    const { companyId } = userObject;
    const modelGroup = await ModelGroup.create({
      name: req.body.name,
      description: req.body.modelCreationDate,
      companyId
    })
    const { datasetIds } = req.body;
    const model = await Model.create({...req.body, modelGroupId: modelGroup.id});
    
    // Add default correctness evaluator to the model
    try {
      await Model.addDefaultCorrectnessEvaluator(model.id, companyId);
    } catch (error) {
      console.error('Failed to add correctness evaluator:', error);
      // Don't fail the model creation if evaluator addition fails
    }
    
    if (datasetIds) {
      await model.setDatasetsByIds(datasetIds);
    }
    res.status(201).json(model);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllModels = async (req, res) => {
  try {
    const models = await Model.findAll();
    res.status(200).json(models);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getModelById = async (req, res) => {
  try {
    const model = await Model.findByPk(req.params.id);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    const prompt = await model.prompt();
    const optimizedModel = await model.getPrincipalABTestModel();
    const optimizedPrompt = await optimizedModel?.prompt();
    res.status(200).json({ ...model.toJSON(), prompt, optimizedPrompt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateModel = async (req, res) => {
  try {
    const model = await Model.findByPk(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    await model.update(req.body);
    const { datasetIds } = req.body;
    if (datasetIds) {
      await model.setDatasetsByIds(datasetIds);
    }
    res.status(200).json(model);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteModel = async (req, res) => {
  try {
    const model = await Model.findByPk(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    await model.destroy();
    res.status(204).json();
  }
  catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const me = async (req, res) => {
  const { userObject } = req;
  const { companyId } = userObject;
  const modelGroups = await ModelGroup.findAll({ where: { companyId } });
  const modelGroupsIds = modelGroups.map(modelGroup => modelGroup.id);
  if (!modelGroupsIds.length) {
    return res.status(200).json([]);
  }
  // send models with datasets
  const models = await Model.findAll({ where: { modelGroupId: modelGroupsIds, isReviewer: false }, include: 'datasets', order: [['createdAt', 'ASC']] });

  let modelsData = []

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const modelData = model.toJSON();
    const datasets = modelData.datasets.map(dataset => dataset.name);
    const abTesting = await model.getABTestModels();

    modelsData.push({ ...modelData, datasets, ab: abTesting.length > 0 });
  }

  modelsData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.status(200).json(modelsData);
}
