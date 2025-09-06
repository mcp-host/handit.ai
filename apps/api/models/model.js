'use strict';
import { Model as ModelEntity, Op, QueryTypes } from 'sequelize';
import { evaluateAB } from '../src/services/abTestService.js';
import { enhancePrompt } from '../src/services/promptEnhancementService.js';
import { redisService } from '../src/services/redisService.js';
import {
  getMetricOfModelMonitoring,
  getModelCorrectEntriesByDay,
  getModelMetricsFullDate,
  getModelMetricsOfModelById,
} from '../src/services/modelMetricsCalculationService.js';
import { isCorrect } from '../src/services/entries/correctnessEvaluatorService.js';
import { runReview } from '../src/services/insightsService.js';

export default (sequelize, DataTypes) => {
  class Model extends ModelEntity {
    static associate(models) {
      Model.belongsTo(models.ModelGroup, { foreignKey: 'model_group_id' });
      Model.belongsToMany(models.Dataset, {
        through: models.ModelDataset,
        foreignKey: 'model_id',
        otherKey: 'dataset_id',
        as: 'datasets',
      });
      Model.hasMany(models.ABTestModels, { foreignKey: 'model_id' });
      Model.hasMany(models.ModelLog, { foreignKey: 'model_id' });
      Model.hasMany(models.ModelMetric, { foreignKey: 'model_id' });
      Model.belongsToMany(models.Model, {
        through: models.ReviewersModels,
        foreignKey: 'model_id',
        otherKey: 'reviewer_id',
        as: 'reviewers',
      });
      Model.hasMany(models.AgentNode, {
        foreignKey: 'model_id',
        as: 'AgentNodes',
      });
      Model.hasMany(models.ModelDeployHistory, {
        foreignKey: 'modelId',
        as: 'deployHistories',
      });
      Model.hasMany(models.ModelEvaluationPrompt, {
        foreignKey: 'modelId',
        as: 'evaluationPrompts',
      });
    }

    async addEvaluationPrompt(evaluationPrompt) {
      const prompt = await sequelize.models.ModelEvaluationPrompt.create({
        modelId: this.id,
        evaluationPromptId: evaluationPrompt.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return prompt;
    }

    /**
     * Automatically add the correctness evaluator to a newly created model
     * @param {number} modelId - The ID of the model
     * @param {number} companyId - The ID of the company
     * @returns {Promise<Object|null>} - Created ModelEvaluationPrompt or null if not found
     */
    static async addDefaultCorrectnessEvaluator(modelId, companyId) {
      try {
        // Find the correctness evaluator for this company
        const correctnessEvaluator = await sequelize.models.EvaluationPrompt.findOne({
          where: {
            name: 'Correctness Evaluation',
            companyId: companyId
          }
        });

        if (correctnessEvaluator) {
          // Add the evaluator to the model
          const modelEvaluationPrompt = await sequelize.models.ModelEvaluationPrompt.create({
            modelId: modelId,
            evaluationPromptId: correctnessEvaluator.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log(`Added correctness evaluator to model ${modelId} for company ${companyId}`);
          return modelEvaluationPrompt;
        } else {
          console.warn(`Correctness evaluator not found for company ${companyId}`);
          return null;
        }
      } catch (error) {
        console.error('Error adding default correctness evaluator:', error);
        return null;
      }
    }

    async allEvaluationPrompts() {
      const modelGroup = await this.getModelGroup();
      const company = await modelGroup.getCompany();

      const prompts = await sequelize.models.EvaluationPrompt.findAll({
        where: {
          companyId: company.id,
        },
      });

      return prompts;
    }

    async evaluationPrompts() {
      // check if model is optimzied get prompts of parent model
      let modelId = this.id;
      const originalModel = await sequelize.models.ABTestModels.findOne({
        where: {
          optimizedModelId: this.id,
        },
      });
      if (originalModel) {
        modelId = originalModel.id;
      }

      const evaluationPrompts =
        await sequelize.models.ModelEvaluationPrompt.findAll({
          where: {
            modelId,
          },
          include: [
            {
              model: sequelize.models.EvaluationPrompt,
              as: 'evaluationPrompt',
              attributes: ['id', 'name', 'prompt', 'defaultProviderModel', 'type', 'isInformative', 'functionBody'],
              include: [
                {
                  required: false,
                  model: sequelize.models.IntegrationToken,
                  as: 'defaultIntegrationToken',
                  attributes: ['id', 'name', 'providerId', 'token', 'data'],
                  include: [
                    {
                      model: sequelize.models.Provider,
                      as: 'provider',
                      attributes: ['id', 'name'],
                    },
                  ],
                },
              ],
            },
            {
              required: false,
              model: sequelize.models.IntegrationToken,
              as: 'integrationToken',
              attributes: ['id', 'name', 'providerId'],
              include: [
                {
                  model: sequelize.models.Provider,
                  as: 'provider',
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        });

      return evaluationPrompts;
    }

    /**
     * Release a specific prompt version: set active_version to false for all, then true for the target
     * @param {Object} params - Parameters for release
     * @param {number|string} params.modelId - ID of the model
     * @param {string} params.version - Version identifier to activate
     * @returns {Promise<Object|null>} - Activated ModelVersion or null if not found
     * @throws {Error} - When database operation fails
     */
    async releasePromptVersion({ modelId, version, originalModelId }) {
      try {
        const ModelVersion = sequelize.models.ModelVersions;

        // 1. Deactivate all existing versions for this model
        await ModelVersion.update(
          { activeVersion: false },
          { where: { modelId, activeVersion: true } }
        );
        await ModelVersion.update(
          { activeVersion: false },
          { where: { modelId: originalModelId, activeVersion: true } }
        );
        const abModel = await this.getPrincipalABTestModel();
        if (abModel) {
          await ModelVersion.update(
            { activeVersion: false },
            { where: { modelId: abModel.id, activeVersion: true } }
          );
        }
        // 2. Activate the requested version
        const releaseVersion = await ModelVersion.update(
          { activeVersion: true },
          {
            where: { modelId, version },
            returning: true,
          }
        );

        // 3. Create a new ModelDeployHistory record
        await sequelize.models.ModelDeployHistory.create({
          modelId: originalModelId,
          version,
          createdAt: new Date(),
        });

        // 3. Return the activated version if found
        return releaseVersion || null;
      } catch (error) {
        // Log and rethrow with context
        console.error('Error in releasePromptVersion:', error);
        throw new Error(
          `Failed to release prompt version ${version}: ${error.message}`
        );
      }
    }

    /** Versions Promts for Autonom

    /**
     * Create a new prompt version record in the ModelVersions table
     * Computes the next version number by fetching existing versions
     * for this model and incrementing the highest one, or starts at 1.
     *
     * @param {Object} data - Data for the new version
     * @param {number|string} data.modelId - ID of the model
     * @param {string} data.prompt - Prompt text to store
     * @param {boolean} [data.active=false] - Whether this version is active
     * @returns {Promise<Object>} - Created ModelVersion instance
     */
    async createVersionPromt({ modelId, prompt, active = false }) {
      // Reference to the Sequelize ModelVersions model
      const ModelVersion = sequelize.models.ModelVersions;

      // Fetch all existing versions for this model, ordered ascending by version
      const existingVersions = await ModelVersion.findAll({
        where: { modelId },
        order: [['version', 'ASC']],
      });

      // Determine the next version number
      let nextVersionNumber;
      if (existingVersions.length === 0) {
        // No prior versions: start at 1
        nextVersionNumber = 1;
      } else {
        // Parse the last version string to integer
        const lastEntry = existingVersions[existingVersions.length - 1];
        const lastNumber = parseInt(lastEntry.version, 10);

        // If parsing fails, fallback to count + 1
        nextVersionNumber = Number.isNaN(lastNumber)
          ? existingVersions.length + 1
          : lastNumber + 1;
      }

      // Build the payload for the new prompt version
      const payload = {
        modelId,
        version: nextVersionNumber.toString(),
        parameters: { prompt },
        activeVersion: active,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert the new version record into the database
      const newVersion = await ModelVersion.create(payload);
      return newVersion;
    }

    async getModelMetrics() {
      const metrics = await sequelize.models.ModelMetric.findAll({
        where: {
          modelId: this.id,
        },
      });
      return metrics;
    }

    async updateOptimizedPrompt(prompt) {
      const optimizedModel = await this.getPrincipalABTestModel();
      if (optimizedModel) {
        const lastVersion = await sequelize.models.ModelVersions.findOne({
          where: {
            modelId: optimizedModel.id,
          },
          order: [['createdAt', 'DESC']],
        });
        await sequelize.models.ModelVersions.create({
          modelId: optimizedModel.id,
          parameters: {
            prompt,
          },
          version: lastVersion ? parseInt(lastVersion.version) + 1 : 1,
          activeVersion: false,
        });
      }
    }

    async getEvaluator() {
      const reviewers = await this.getReviewers();

      const reviewerId = reviewers[0].reviewerId;

      const reviewerInstance = await Model.findOne({
        where: {
          id: reviewerId,
        },
      });

      return reviewerInstance;
    }

    async runABTestBatch() {
      const abTests = await this.getABTestModels();

      for (let i = 0; i < abTests.length; i++) {
        const entries = await sequelize.query(
          `SELECT original.* FROM "ModelLogs" AS original LEFT JOIN "ModelLogs" AS optimized 
            ON optimized.original_log_id = original.id
            WHERE original.model_id = ${this.id}
            AND optimized.id IS NULL
            ORDER BY RANDOM()
            LIMIT 30`,
          {
            type: QueryTypes.SELECT,
          }
        );

        const modelGroup = await this.getModelGroup();
        const company = await modelGroup.getCompany();

        await Promise.all(
          entries.map(async (entry) => {
            const modelLog = await sequelize.models.ModelLog.findByPk(entry.id);
            await evaluateAB(
              modelLog,
              abTests[i],
              sequelize.models.ModelLog,
              modelLog.id,
              sequelize.models,
              company
            );
          }, 0)
        );
      }
    }

    async getModelLogs(date = null) {
      if (date) {
        const logs = await sequelize.models.ModelLog.findAll({
          where: {
            modelId: this.id,
            createdAt: {
              [Op.gt]: date,
            },
          },
          attributes: ['id', 'status', 'createdAt', 'output'],
        });
        return logs;
      } else {
        const logs = await sequelize.models.ModelLog.findAll({
          where: {
            modelId: this.id,
          },
        });
        return logs;
      }
    }

    async getMetricUnprocessedLogs() {
      const logs = await sequelize.models.ModelLog.findAll({
        where: {
          modelId: this.id,
          metricProcessed: false,
          actual: {
            [Op.not]: null,
          },
          environment: 'production',
        },
        attributes: ['id', 'actual', 'createdAt', 'status'],
      });
      return logs;
    }

    async createModelVersion({ prompt, version = '1', activeVersion = true }) {
      await sequelize.models.ModelVersions.create({
        modelId: this.id,
        version: version,
        activeVersion,
        parameters: {
          prompt,
        },
      });
    }

    async groupedAlerts() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
        },
      });
      const metricAlerts = alerts.filter((alert) => alert.type === 'metric');
      const errorAlerts = alerts.filter((alert) => alert.type === 'error');

      let groupedErrorAlerts = errorAlerts.reduce((acc, alert) => {
        if (!acc[alert.data?.message]) {
          acc[alert.data?.message] = {
            errors: [],
          };
        }
        acc[alert.data?.message].errors.push(alert);
        return acc;
      }, {});

      // sort errors by createdAt
      groupedErrorAlerts = Object.keys(groupedErrorAlerts).reduce(
        (acc, key) => {
          acc[key] = {
            errors: groupedErrorAlerts[key].errors.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            ),
          };
          return acc;
        },
        {}
      );

      for (const [key, value] of Object.entries(groupedErrorAlerts)) {
        const errorAlerts = value.errors;
        const errorsInLast24H = errorAlerts.filter((alert) => {
          return alert.createdAt > new Date(new Date() - 24 * 60 * 60 * 1000);
        });

        const alertsByHour = {};
        for (let i = 0; i < 24; i++) {
          const date = new Date(new Date() - i * 60 * 60 * 1000);

          // date with year-month-day hour:00:00
          date.setMinutes(0);
          date.setSeconds(0);
          alertsByHour[date.toUTCString()] = 0;
        }
        errorsInLast24H.forEach((alert) => {
          const date = new Date(alert.createdAt);
          // date with year-month-day 00:00:00
          date.setMinutes(0);
          date.setSeconds(0);

          alertsByHour[date.toUTCString()] += 1;
        });

        const errorsLast30Days = errorAlerts.filter((alert) => {
          return (
            alert.createdAt > new Date(new Date() - 30 * 24 * 60 * 60 * 1000)
          );
        });

        const alertsByDay = {};
        for (let i = 0; i < 30; i++) {
          const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
          // date with year-month-day 00:00:00
          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(0);
          alertsByDay[date.toUTCString()] = 0;
        }

        errorsLast30Days.forEach((alert) => {
          const date = new Date(alert.createdAt);
          // date with year-month-day 00:00:00

          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(0);

          alertsByDay[date.toUTCString()] += 1;
        });

        value.errorsByDay = alertsByDay;
        value.errorsByHour = alertsByHour;
        value.totalErrors = errorsInLast24H.length;
        value.totalErrorsLast30Days = errorsLast30Days.length;
        value.firstSeen =
          errorAlerts.length > 0 ? errorAlerts[0].createdAt : null;
        value.lastSeen =
          errorAlerts.length > 0
            ? errorAlerts[errorAlerts.length - 1].createdAt
            : null;
        value.errors = errorAlerts;
        groupedErrorAlerts[key] = value;
      }

      return {
        metricAlerts,
        errorAlerts: groupedErrorAlerts,
      };
    }

    async setDatasetsByIds(datasetIds) {
      const datasets = await sequelize.models.Dataset.findAll({
        where: {
          id: datasetIds,
        },
      });
      await this.setDatasets(datasets);
    }

    async getModelGroup() {
      const modelGroup = await sequelize.models.ModelGroup.findOne({
        where: {
          id: this.modelGroupId,
        },
      });
      return modelGroup;
    }

    async saveABCorrectEntriesByDayInCache() {
      const cacheKey = `ab-correct-entries:${this.id}`;

      const correctEntries = await getModelCorrectEntriesByDay(
        this.id,
        sequelize
      );
      const optimizedModel = await this.getPrincipalABTestModel();
      let optimizedModelCorrectEntries = {};
      if (optimizedModel) {
        optimizedModelCorrectEntries = await getModelCorrectEntriesByDay(
          optimizedModel.id,
          sequelize
        );
      }
      const response = {
        baseModelMetric: correctEntries,
        optimizedModelMetric: optimizedModelCorrectEntries,
      };

      await redisService.set(cacheKey, response);

      return response;
    }

    async saveABMetricsInCache() {
      const cacheKey = `ab-metrics:${this.id}`;

      const optimizedModel = await this.getPrincipalABTestModel();
      const baseModelMetric = await getModelMetricsOfModelById(
        this.id,
        sequelize
      );

      let optimizedModelMetric = {};
      if (optimizedModel) {
        optimizedModelMetric = await getModelMetricsOfModelById(
          optimizedModel.id,
          sequelize
        );
      }

      const response = { baseModelMetric, optimizedModelMetric };

      await redisService.set(cacheKey, response);

      return response;
    }

    async saveModelMetricsInCache() {
      const cacheKey = `model-metrics-detail:${this.id}`;
      const companyMetric = await getModelMetricsOfModelById(
        this.id,
        sequelize
      );
      await redisService.set(cacheKey, companyMetric);
      return companyMetric;
    }

    async saveModelMetricsOfModelMonitoringInCache() {
      const cacheKey = `model-metrics-monitoring:${this.id}`;
      const modelMetrics = await getMetricOfModelMonitoring(this.id, sequelize);
      await redisService.set(cacheKey, modelMetrics);
      return modelMetrics;
    }

    async getSecondABTestModel() {
      const abTests = await sequelize.models.ABTestModels.findAll({
        where: {
          modelId: this.id,
        },
        order: [['createdAt', 'ASC']],
      });

      if (abTests.length > 0) {
        const modelId = abTests[0].optimizedModelId;

        const model = await sequelize.models.Model.findByPk(modelId);

        return model;
      }
      return null;
    }

    async saveMetricsFullDateInCache() {
      const cacheKey = `metrics-full-date:${this.id}`;
      const optimizedModel = await this.getPrincipalABTestModel();
      const optimizedModel2 = await this.getSecondABTestModel();
      let [metrics, optimizedMetrics, optimizedMetrics2] = await Promise.all([
        getModelMetricsFullDate(this.id, false, sequelize),
        optimizedModel
          ? getModelMetricsFullDate(optimizedModel.id, true, sequelize)
          : Promise.resolve({}),
        optimizedModel2
          ? getModelMetricsFullDate(optimizedModel2.id, true, sequelize)
          : Promise.resolve({}),
      ]);
      // for optimized model on the lastmetriclogs that are empty, add the metrics of the optimized model 2

      const metricMap = {};
      optimizedMetrics?.modelMetrics?.forEach((metric) => {
        const optimizedMetric = optimizedMetrics2?.modelMetrics?.find(
          (m) => m.name === metric.name
        );
        metricMap[optimizedMetric.id] = metric.id;
      });
      let lastMetricLogs = optimizedMetrics?.lastMetricLogs;
      Object.keys(lastMetricLogs || {}).forEach((day) => {
        if (
          Object.keys(lastMetricLogs[day]).length === 0 &&
          Object.keys(optimizedMetrics2.lastMetricLogs).includes(day)
        ) {
          const metricLogs = optimizedMetrics2.lastMetricLogs[day];
          const newMetricLogs = {};
          Object.keys(metricLogs).forEach((metricId) => {
            if (metricMap[metricId]) {
              newMetricLogs[metricMap[metricId]] = metricLogs[metricId];
            }
          });
          lastMetricLogs[day] = newMetricLogs;
        }
      });

      optimizedMetrics.lastMetricLogs = lastMetricLogs;

      const response = {
        baseModelMetric: metrics,
        optimizedModelMetric: optimizedMetrics,
      };
      await redisService.set(cacheKey, response);

      return response;
    }

    async getMetricProcessedLogs() {
      const logs = await sequelize.models.ModelLog.findAll({
        where: {
          modelId: this.id,
          actual: {
            [Op.not]: null,
          },
          createdAt: {
            // more than 1 day ago
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000),
          },
          status: 'error',
        },
        limit: 3,
      });
      return logs;
    }

    async generateInsights() {
      const modelLogs = await this.getMetricProcessedLogs();
      const randomModelLogs = modelLogs.sort(() => Math.random() - 0.5);
      const insights = [];
      for (let i = 0; i < randomModelLogs.length; i++) {
        const modelLog = modelLogs[i];
        if (!isCorrect(modelLog) && insights.length < 2) {
          const modelGroup = await this.getModelGroup();
          const company = await modelGroup.getCompany();
          let optimizationToken;
          let defaultModel;
          let provider;
          let optimizationTokenData;
          if (this.flags?.isN8N) {
            optimizationToken = process.env.TOGETHER_API_KEY;
            defaultModel = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'; // TODO: change to the default model of the company
            provider = 'TogetherAI';
          } else {
            const token = await company.getOptimizationToken();
            optimizationToken = token.token;
            optimizationTokenData = token.data;
            defaultModel = company.optimizationModel;
            provider = token.provider.name;
            if (!defaultModel) {
              if (provider === 'OpenAI') {
                defaultModel = 'gpt-4o-mini';
              } else if (provider === 'TogetherAI') {
                defaultModel =
                  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
              }
            }
          }

          try {
            await runReview(
              modelLog,
              null,
              sequelize.models.ModelLog,
              sequelize.models.Insights,
              this.problemType,
              this.version,
              this.id,
              optimizationToken,
              optimizationTokenData,
              provider,
              defaultModel
            );
          } catch (error) {
            console.error('error', error);
          }
        }
      }
    }

    async getModelVersions() {
      const versions = await sequelize.models.ModelVersions.findAll({
        where: {
          model_id: this.id,
        },
        order: [['createdAt', 'DESC']],
      });
      return versions;
    }

    async getModelVersion(version = null) {
      const versions = await sequelize.models.ModelVersions.findAll({
        where: {
          model_id: this.id,
        },
        order: [['createdAt', 'DESC']],
      });

      const abTestModel = await this.getPrincipalABTestModel();
      let abTestVersions = [];
      if (abTestModel) {
        abTestVersions = await sequelize.models.ModelVersions.findAll({
          where: {
            model_id: abTestModel.id,
          },
        });
      }

      if (version) {
        const version = versions.find((v) => v.id === version);
        return version;
      }

      const allVersions = [...versions, ...abTestVersions];
      const activeVersion = allVersions.find(
        (v) => v.parameters.prompt && v.activeVersion
      );

      if (activeVersion) {
        return activeVersion;
      }

      if (versions.length > 0 && versions[0].parameters.prompt) {
        return versions[0];
      }
      return null;
    }

    async prompt(version = null) {
      const versions = await sequelize.models.ModelVersions.findAll({
        where: {
          model_id: this.id,
        },
        order: [['createdAt', 'DESC']],
      });

      if (version) {
        const version = versions.find((v) => v.id === version);
        return version?.parameters?.prompt;
      }

      if (versions.length > 0 && versions[0].parameters.prompt) {
        return versions[0].parameters.prompt;
      }
      return this.parameters?.prompt;
    }

    async changePrompt(newPrompt) {
      const lastVersion = await sequelize.models.ModelVersions.findOne({
        where: {
          model_id: this.id,
        },
        order: [['createdAt', 'DESC']],
      });
      let version = 1;
      if (lastVersion) {
        version = parseInt(lastVersion.version) + 1;
      }
      await sequelize.models.ModelVersions.create({
        modelId: this.id,
        version,
        parameters: {
          prompt: newPrompt,
        },
      });

      // delete all old insights
      await sequelize.models.Insights.destroy({
        where: {
          modelId: this.id,
        },
      });

      return newPrompt;
    }

    async applySuggestions() {
      const modelVersion = await this.getModelVersion();
      let prompt = modelVersion?.parameters?.prompt;
      if (!prompt) {
        prompt = await this.prompt();
      }
      const suggestions = await sequelize.models.Insights.findAll({
        where: {
          modelId: this.id,
        },
        order: [['createdAt', 'DESC']],
        limit: 20,
      });

      if (!suggestions.length || !prompt) {
        return null;
      }
      const modelGroup = await this.getModelGroup();
      const company = await modelGroup.getCompany();
      let token;
      let defaultModel;
      let provider;
      let tokenData;
      if (this.flags?.isN8N) {
        token = process.env.TOGETHER_API_KEY;
        defaultModel = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
        provider = 'TogetherAI';
      } else {
        const optimizationToken = await company.getOptimizationToken();
        token = optimizationToken.token;
        tokenData = optimizationToken.data;
        defaultModel = company.optimizationModel;
        provider = optimizationToken.provider.name;
        if (!defaultModel) {
          if (provider === 'OpenAI') {
            defaultModel = 'gpt-4o-mini';
          } else if (provider === 'TogetherAI') {
            defaultModel = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
          } else if (provider === 'AWSBedrock') {
            defaultModel = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
          } else if (provider === 'GoogleAI') {
            defaultModel = 'gemini-2.0-flash';
          }
        }
      }

      const enhancedPromptResult = await enhancePrompt(
        prompt,
        suggestions,
        token,
        tokenData,
        provider,
        defaultModel
      );
      return enhancedPromptResult;
    }

    async getABPrompts() {
      let basePrompt = await this.prompt();
      basePrompt = basePrompt || '';
      const optimizedModel = await this.getPrincipalABTestModel();
      let optimizedPrompt = await optimizedModel?.prompt();
      optimizedPrompt = optimizedPrompt || '';
      return {
        basePrompt,
        optimizedPrompt,
      };
    }

    async getLastAlerts() {
      // get alerts of the last 24 hours
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000),
          },
        },
      });
      return alerts;
    }

    async getComparisonMetricsLastMonth() {
      const lastModelMetrics = await this.getLastModelMetrics();
      const avgModelMetricsLastMonth = await this.getAvgModelMetricsLast30Days(
        new Date(new Date() - 30 * 24 * 60 * 60 * 1000)
      );
      const avgModelMetricsCurrentMonth =
        await this.getAvgModelMetricsLast30Days();

      return {
        lastModelMetrics,
        avgModelMetricsLastMonth,
        avgModelMetricsCurrentMonth,
      };
    }

    async getLastAlertsCount() {
      const count = await sequelize.models.Alert.count({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000),
          },
        },
      });
      return count;
    }

    async getDifferenceLastWeekByClass() {
      // Current week: from 7 days ago to now
      const currentWeekEnd = new Date();
      const currentWeekStart = new Date(currentWeekEnd);
      currentWeekStart.setDate(currentWeekEnd.getDate() - 7);

      // Last week: from 14 days ago to 7 days ago
      const lastWeekEnd = currentWeekStart;
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 7);

      const [lastWeekEntries, currentWeekEntries] = await Promise.all([
        this.getEntriesCountByClass(lastWeekStart, lastWeekEnd),
        this.getEntriesCountByClass(currentWeekStart, currentWeekEnd),
      ]);

      return {
        lastWeekEntries,
        currentWeekEntries,
      };
    }

    async getEntriesCountByClass(
      fromDate = new Date(new Date().setDate(new Date().getDate() - 30)),
      toDate = new Date()
    ) {
      const results = await sequelize.query(
        `
        WITH positive_mappings AS (
          SELECT 
            key,
            CAST(value AS NUMERIC) as value
          FROM (
            SELECT 
              key::text as key,
              value::text as value
            FROM json_each(
              (SELECT CAST(parameters->>'mapping' AS json)
               FROM "Models"
               WHERE id = :modelId)
            )
          ) as mapping_values
          WHERE value IN ('1', '1.0')
        )
        SELECT 
          SUM(CASE WHEN is_positive THEN 1 ELSE 0 END) as positive_count,
          SUM(CASE WHEN NOT is_positive THEN 1 ELSE 0 END) as negative_count
        FROM (
          SELECT
            CASE
              WHEN actual->>'modelClass' IN ('1', 'true') THEN true
              WHEN actual->>'modelClass' ~ E'^\\d+(\\.\\d+)?$' THEN CAST(actual->>'modelClass' AS NUMERIC) = 1
              WHEN actual->>'relevance' ~ E'^\\d+(\\.\\d+)?$' THEN CAST(actual->>'relevance' AS NUMERIC)*10 > 5
              WHEN EXISTS (
                SELECT 1 FROM "Models" 
                WHERE id = :modelId 
              ) AND actual->>'modelClass' IN (
                SELECT key FROM positive_mappings
              ) THEN true
              ELSE false
            END as is_positive
          FROM "ModelLogs"
          WHERE model_id = :modelId
          AND processed = true
          AND created_at >= :fromDate
          AND created_at <= :toDate
          AND (
            CASE 
              WHEN actual->>'correct' IN ('true', '1') THEN true
              WHEN actual->>'correct' ~ E'^\\d+(\\.\\d+)?$' THEN CAST(actual->>'correct' AS NUMERIC)*10 > 5
              ELSE false
            END
            OR
            (actual->>'class' = actual->>'modelClass')
          )
        ) subquery
      `,
        {
          replacements: { modelId: this.id, fromDate, toDate },
          type: QueryTypes.SELECT,
        }
      );

      return {
        positiveCount: parseInt(results[0]?.positive_count || 0),
        negativeCount: parseInt(results[0]?.negative_count || 0),
      };
    }

    async getLastErrorsCount() {
      const count = await sequelize.models.Alert.count({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000),
          },
          type: 'error',
        },
      });
      return count;
    }

    async getAlerts() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
        },
      });
      return alerts;
    }

    async getNumberOfAlertsByTypeByMonth(date = new Date()) {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(date - 30 * 24 * 60 * 60 * 1000),
            [Op.lte]: date,
          },
        },
      });

      const alertsByType = alerts.reduce((acc, alert) => {
        if (alert.type === 'metric') {
          if (!acc[alert.severity]) {
            acc[alert.severity] = 0;
          }
          acc[alert.severity]++;
          return acc;
        } else if (alert.type === 'error') {
          if (!acc.error) {
            acc.error = 0;
          }
          acc.error++;
          return acc;
        }
      }, {});

      return alertsByType;
    }

    async getReviewers() {
      const reviewers = await sequelize.models.ReviewersModels.findAll({
        where: {
          modelId: this.id,
        },
      });
      return reviewers;
    }

    async getUnprocessedLogs(limit = 5) {
      try {
        const yesterday = new Date(
          new Date().setDate(new Date().getDate() - 3)
        );
        const yesterdayAt4pm = new Date(yesterday);
        yesterdayAt4pm.setHours(16, 0, 0, 0);

        const nowAt4pm = new Date(new Date().setDate(new Date().getDate() + 2));
        nowAt4pm.setHours(16, 0, 0, 0);

        const modelLogs = await sequelize.models.ModelLog.findAll({
          where: {
            modelId: this.id,
            environment: 'production',
            actual: null,
            createdAt: {
              // yesterday after 4pm gtm -5
              [Op.gte]: yesterdayAt4pm,
              [Op.lte]: nowAt4pm,
            },
          },
          limit: limit,
          order: [['createdAt', 'DESC']],
        });
        return modelLogs;
      } catch (error) {
        console.log('error', error);
        return [];
      }
    }

    async getLastModelLog() {
      const modelLog = await sequelize.models.ModelLog.findOne({
        where: {
          modelId: this.id,
        },
        order: [['createdAt', 'DESC']],
      });

      return modelLog;
    }

    async getABTestModels() {
      try {
        const abTests = await sequelize.models.ABTestModels.findAll({
          where: {
            modelId: this.id,
          },
        });
        const models = await Promise.all(
          abTests.map(async (abTest) => {
            const version = abTest.optimizedModelVersionId;
            const data = await sequelize.models.Model.findOne({
              where: {
                id: abTest.optimizedModelId,
              },
            });
            const prompt = await data.prompt(version);
            return {
              ...data.dataValues,
              abTest: abTest.dataValues,
              prompt,
            };
          })
        );
        return models;
      } catch (error) {
        console.log(error);
        return [];
      }
    }

    async getPrincipalABTestModel() {
      try {
        const abTest = await sequelize.models.ABTestModels.findOne({
          where: {
            modelId: this.id,
            principal: true,
          },
        });

        if (abTest) {
          return await sequelize.models.Model.findOne({
            where: {
              id: abTest.optimizedModelId,
            },
          });
        }
        return null;
      } catch (error) {
        console.log(error);
        return {};
      }
    }

    async getUnprocessedLogsCount() {
      const modelLogs = await sequelize.models.ModelLog.count({
        where: {
          modelId: this.id,
          actual: null,
          environment: 'production',
        },
      });
      return modelLogs;
    }

    async getLastModelMetrics() {
      const modelMetrics = await sequelize.models.ModelMetric.findAll({
        where: {
          modelId: this.id,
          name: {
            [Op.ne]: 'Healtcheck',
          },
        },
      });

      const transformedModelMetricLogsByModelMetricId = {};
      for (const modelMetric of modelMetrics) {
        const modelMetricLogs = await sequelize.models.ModelMetricLog.findOne({
          where: {
            modelMetricId: modelMetric.id,
          },
          order: [['createdAt', 'DESC']],
        });

        if (modelMetricLogs) {
          transformedModelMetricLogsByModelMetricId[modelMetric.id] =
            modelMetricLogs;
        }
      }
      return transformedModelMetricLogsByModelMetricId;
    }

    async getAvgModelMetricsLast30Days(
      date = new Date(),
      modelMetricLogs = null
    ) {
      // First check if we're in test mode by getting the company through the model group
      const modelGroup = await this.getModelGroup();
      const company = await modelGroup.getCompany();

      if (company?.testMode) {
        return this.generateMockMetricsForDate(date);
      }

      // Original implementation for non-test mode
      const modelMetrics = await sequelize.models.ModelMetric.findAll({
        where: {
          modelId: this.id,
        },
      });

      if (!modelMetricLogs) {
        modelMetricLogs = await sequelize.models.ModelMetricLog.findAll({
          where: {
            modelMetricId: modelMetrics.map((modelMetric) => modelMetric.id),
            createdAt: {
              [Op.gt]: new Date(date - 30 * 24 * 60 * 60 * 1000),
              [Op.lte]: date,
            },
          },
        });
      }

      const modelMetricLogsByModelMetricId = modelMetricLogs.reduce(
        (acc, modelMetricLog) => {
          if (!acc[modelMetricLog.modelMetricId]) {
            acc[modelMetricLog.modelMetricId] = [];
          }
          acc[modelMetricLog.modelMetricId].push(modelMetricLog);
          return acc;
        },
        {}
      );

      const avgModelMetricLogsByModelMetricId = {};
      for (const [key, value] of Object.entries(
        modelMetricLogsByModelMetricId
      )) {
        const avg = value.reduce((acc, modelMetricLog) => {
          return acc + modelMetricLog.value;
        }, 0);
        avgModelMetricLogsByModelMetricId[key] = avg / value.length;
      }

      return avgModelMetricLogsByModelMetricId;
    }

    // Helper method to generate mock metrics based on date
    async generateMockMetricsForDate(date) {
      // Get the model metrics to know what metrics we need to mock
      const modelMetrics = await sequelize.models.ModelMetric.findAll({
        where: {
          modelId: this.id,
        },
      });

      const mockMetrics = {};
      const now = new Date();
      const isCurrentMonth =
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      // Base improvement factor - current month should be better than previous
      const improvementFactor = isCurrentMonth ? 1.15 : 1.0; // 15% better for current month

      for (const metric of modelMetrics) {
        const metricId = metric.id;
        const metricName = metric.name.toLowerCase();

        // Base value depends on metric type
        let baseValue;
        switch (metricName) {
          case 'accuracy':
          case 'precision':
          case 'f1':
          case 'recall':
            baseValue = 75 + Math.random() * 5; // 75-80% base
            break;
          case 'averagerelevance':
          case 'averagecoherence':
            baseValue = 80 + Math.random() * 5; // 80-85% base
            break;
          case 'responsetime':
            baseValue = isCurrentMonth
              ? 150 + Math.random() * 30
              : 200 + Math.random() * 50; // Lower is better
            break;
          case 'tokenusage':
            baseValue = isCurrentMonth
              ? 900 + Math.random() * 100
              : 1100 + Math.random() * 200; // Lower is better
            break;
          default:
            baseValue = 80 + Math.random() * 5; // Default 80-85% base
        }

        // Apply improvement factor for current month
        let finalValue;
        if (metricName === 'responsetime' || metricName === 'tokenusage') {
          // For metrics where lower is better, divide by improvement factor
          finalValue = baseValue / improvementFactor;
        } else {
          // For metrics where higher is better, multiply by improvement factor
          finalValue = baseValue * improvementFactor;
        }

        // Add small random variation (±2%)
        finalValue *= 0.98 + Math.random() * 0.04;

        // Ensure values stay within reasonable bounds
        finalValue = Math.min(99.9, Math.max(0, finalValue));

        // Round to 2 decimal places
        mockMetrics[metricId] = Math.round(finalValue * 100) / 100;
      }

      return mockMetrics;
    }

    async getAvgModelMetricByDayLast30Days(date = new Date()) {
      const modelMetrics = await sequelize.models.ModelMetric.findAll({
        where: {
          modelId: this.id,
        },
      });

      const modelMetricLogs = await sequelize.models.ModelMetricLog.findAll({
        where: {
          modelMetricId: modelMetrics.map((modelMetric) => modelMetric.id),
          createdAt: {
            [Op.gt]: new Date(date - 30 * 24 * 60 * 60 * 1000),
            [Op.lte]: date,
          },
        },
      });

      const modelMetricLogsByDay = modelMetricLogs.reduce(
        (acc, modelMetricLog) => {
          const date = new Date(modelMetricLog.createdAt);
          // date with year-month-day 00:00:00
          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(0);

          if (!acc[date.toUTCString()]) {
            acc[date.toUTCString()] = [];
          }
          acc[date.toUTCString()].push(modelMetricLog);
          return acc;
        },
        {}
      );

      const avgModelMetricByDay = {};
      for (const [key, value] of Object.entries(modelMetricLogsByDay)) {
        const avg = value.reduce((acc, modelMetricLog) => {
          return acc + modelMetricLog.value;
        }, 0);
        avgModelMetricByDay[key] = avg / value.length;
      }

      return avgModelMetricByDay;
    }

    async getLastErrors() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000),
          },
          type: 'error',
        },
      });
      return alerts;
    }

    getDays(alerts) {
      const days = new Set();
      alerts.forEach((alert) => {
        const date = new Date(alert.createdAt);
        // date with year-month-day 00:00:00
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        days.add(date.toUTCString());
      });
      return days;
    }

    async lastHealtchErrorDays() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000 * 30),
          },
          type: 'error',
        },
      });

      const modelMetrics = await this.getModelMetrics();

      const successAlerts = await sequelize.models.ModelMetricLog.findAll({
        where: {
          modelMetricId: modelMetrics.map((modelMetric) => modelMetric.id),
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000 * 30),
          },
          label: 'health_check',
          value: 1,
        },
      });

      const successDays = this.getDays(successAlerts);

      const errorDays = this.getDays(alerts);

      const days = new Set();
      errorDays.forEach((day) => {
        if (!successDays.has(day)) {
          days.add(day);
        }
      });
      return days.size;
    }

    async lastHealtchWarningDays() {}

    async getLastHealthChecks() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000 * 30),
          },
          type: 'error',
        },
      });

      const modelMetrics = await this.getModelMetrics();

      const successAlerts = await sequelize.models.ModelMetricLog.findAll({
        where: {
          modelMetricId: modelMetrics.map((modelMetric) => modelMetric.id),
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000 * 30),
          },
          label: 'health_check',
          value: 1,
        },
      });

      const successDays = this.getDays(successAlerts);

      const errorDays = this.getDays(alerts);

      const days = new Set();
      errorDays.forEach((day) => {
        if (successDays.has(day)) {
          days.add(day);
        }
      });
      return days.size;
    }

    async getLastAlert() {
      const alert = await sequelize.models.Alert.findOne({
        where: {
          modelId: this.id,
        },
        order: [['createdAt', 'DESC']],
      });
      return alert;
    }

    async getIncorrectEntriesFromDateDayByDay(date) {
      const modelGroup = await this.getModelGroup();
      const company = await modelGroup.getCompany();
      if (company.testMode) {
        return this.generateDemoIncorrectEntriesFromDateDayByDay();
      }

      // Initialize results object with dates
      const incorrectEntriesByDay = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        incorrectEntriesByDay[
          date.toISOString().split('T')[0] + 'T00:00:00.000Z'
        ] = 0;
      }

      // Modified SQL query to handle boolean and numeric values safely
      const results = await sequelize.query(
        `
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as count
        FROM "ModelLogs"
        WHERE model_id = :modelId 
        AND processed = true
        AND created_at > :date
        AND status <> 'success'
        AND actual is not null
        AND environment = 'production'
        GROUP BY DATE_TRUNC('day', created_at)
      `,
        {
          replacements: { modelId: this.id, date },
          type: QueryTypes.SELECT,
        }
      );

      // Populate results
      results.forEach((row) => {
        const dayStr =
          new Date(row.day).toISOString().split('T')[0] + 'T00:00:00.000Z';
        if (Object.keys(incorrectEntriesByDay).includes(dayStr)) {
          incorrectEntriesByDay[dayStr] = parseInt(row.count);
        }
      });

      return incorrectEntriesByDay;
    }

    async generateDemoCorrectEntriesFromDateDayByDay() {
      const correctEntriesByDay = {};
      // set kes of correctEntriesByDay, from date to today

      for (let i = 0; i < 30; i++) {
        const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
        // date with year-month-day 00:00:00
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        correctEntriesByDay[date.toUTCString()] = 0;
      }

      for (const [key] of Object.entries(correctEntriesByDay)) {
        correctEntriesByDay[key] = 70 + Math.floor(Math.random() * 30);
      }

      return correctEntriesByDay;
    }

    async generateDemoIncorrectEntriesFromDateDayByDay() {
      const incorrectEntriesByDay = {};

      for (let i = 0; i < 30; i++) {
        const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
        // date with year-month-day 00:00:00
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        incorrectEntriesByDay[date.toUTCString()] = 0;
      }

      for (const [key] of Object.entries(incorrectEntriesByDay)) {
        incorrectEntriesByDay[key] = Math.floor(Math.random() * 30);
      }

      return incorrectEntriesByDay;
    }

    async getInsightsModels() {
      const insightsModels = await sequelize.models.InsightsModels.findAll({
        where: {
          modelId: this.id,
        },
        limit: 5,
        order: [['createdAt', 'DESC']],
      });
      return insightsModels;
    }

    async getCorrectEntriesFromDateDayByDay(date) {
      const modelGroup = await this.getModelGroup();
      const company = await modelGroup.getCompany();
      if (company.testMode) {
        return this.generateDemoCorrectEntriesFromDateDayByDay();
      }

      // Initialize results object with dates
      const correctEntriesByDay = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        correctEntriesByDay[
          date.toISOString().split('T')[0] + 'T00:00:00.000Z'
        ] = 0;
      }

      // Modified SQL query to handle boolean and numeric values safely
      const results = await sequelize.query(
        `
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as count
        FROM "ModelLogs"
        WHERE model_id = :modelId 
        AND processed = true
        AND actual is not null
        AND created_at > :date
        AND status = 'success'
        AND environment = 'production'
        GROUP BY DATE_TRUNC('day', created_at)
      `,
        {
          replacements: { modelId: this.id, date },
          type: QueryTypes.SELECT,
        }
      );

      // Populate results
      results.forEach((row) => {
        const dayStr =
          new Date(row.day).toISOString().split('T')[0] + 'T00:00:00.000Z';
        if (Object.keys(correctEntriesByDay).includes(dayStr)) {
          correctEntriesByDay[dayStr] = parseInt(row.count);
        }
      });

      return correctEntriesByDay;
    }

    async addReviewer(reviewerModel) {
      await sequelize.models.ReviewersModels.create({
        modelId: this.id,
        model_id: this.id,
        reviewerId: reviewerModel.dataValues.id,
        reviewer_id: reviewerModel.dataValues.id,
        activationThreshold: 40,
        evaluationPercentage: 50,
      });
    }

    async getLastMetricLogsFromDateDayByDay(date, modelMetricLogs = null) {
      const modelMetrics = await sequelize.models.ModelMetric.findAll({
        where: {
          modelId: this.id,
        },
      });

      if (!modelMetricLogs) {
        modelMetricLogs = await sequelize.models.ModelMetricLog.findAll({
          where: {
            modelMetricId: modelMetrics.map((modelMetric) => modelMetric.id),
            createdAt: {
              [Op.gt]: date,
            },
          },
        });
      }

      const modelMetricLogsByDay = modelMetricLogs.reduce(
        (acc, modelMetricLog) => {
          const date = new Date(modelMetricLog.createdAt);
          // date with year-month-day 00:00:00
          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(0);

          if (!acc[date.toUTCString()]) {
            acc[date.toUTCString()] = [];
          }
          acc[date.toUTCString()].push(modelMetricLog);
          return acc;
        },
        {}
      );

      const lastMetricLogs = {};
      // set kes of lastMetriclogs, from date to today
      for (let i = 0; i < 30; i++) {
        const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
        // date with year-month-day 00:00:00
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        lastMetricLogs[date.toUTCString()] = {};
      }

      for (const [key, value] of Object.entries(modelMetricLogsByDay)) {
        const logs = value;

        const metricLogs = logs.reduce((acc, modelMetricLog) => {
          if (!acc[modelMetricLog.modelMetricId]) {
            acc[modelMetricLog.modelMetricId] = [];
          }
          acc[modelMetricLog.modelMetricId].push(modelMetricLog);
          return acc;
        }, {});

        const avgModelMetricLogsByModelMetricId = {};
        for (const [key, value] of Object.entries(metricLogs)) {
          const avg = value.reduce((acc, modelMetricLog) => {
            return acc + modelMetricLog.value;
          }, 0);
          avgModelMetricLogsByModelMetricId[key] = avg / value.length || 0;
        }

        lastMetricLogs[key] = avgModelMetricLogsByModelMetricId;
      }

      return lastMetricLogs;
    }

    async getLastAlerts30DaysByDay() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      });

      // iterate last 30 days and create object with key the exact date and value the amount of alerts on that day
      const alertsByDay = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date(new Date() - i * 24 * 60 * 60 * 1000);
        // date with year-month-day 00:00:00
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        alertsByDay[date.toUTCString()] = 0;
      }
      alerts.forEach((alert) => {
        const date = new Date(alert.createdAt);
        // date with year-month-day 00:00:00
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);

        alertsByDay[date.toUTCString()] += 1;
      });
      return alertsByDay;
    }

    async getLastAlertsHourByHour() {
      const alerts = await sequelize.models.Alert.findAll({
        where: {
          modelId: this.id,
          createdAt: {
            [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000),
          },
        },
        order: [['createdAt', 'ASC']],
      });

      // iterate last 24 hours and create object with key the exact date and hour and value the amount of alerts on that hour
      const alertsByHour = {};
      for (let i = 0; i < 24; i++) {
        const date = new Date(new Date() - i * 60 * 60 * 1000);
        // date with year-month-day hour:00:00
        date.setMinutes(0);
        date.setSeconds(0);
        alertsByHour[date.toUTCString()] = 0;
      }
      alerts.forEach((alert) => {
        const date = new Date(alert.createdAt);
        // date with year-month-day hour:00:00
        date.setMinutes(0);
        date.setSeconds(0);

        alertsByHour[date.toUTCString()] += 1;
      });
      return alertsByHour;
    }
  }
  Model.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      problemType: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'problem_type',
      },
      modelCreationDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'model_creation_date',
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      flags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'JSON field for storing logic-related flags and metadata',
      },
      systemPromptStructure: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'system_prompt_structure',
        comment:
          'JSON field storing the detected structure for system prompt location in input data',
      },
      modelGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'model_group_id',
      },
      modelCategory: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'other',
        field: 'model_category',
        comment: 'Category of the model indicating its primary function',
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isReviewer: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'is_reviewer',
        defaultValue: false,
      },
      isOptimized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'is_optimized',
        defaultValue: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'active',
        defaultValue: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'Model',
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeValidate: async (model) => {
          if (model.name && !model.slug) {
            // Convert name to camelCase for slug
            let slug = model.name
              // Replace special characters with space
              .replace(/[^\w\s]/g, ' ')
              // Split into words
              .split(/\s+/)
              // Convert to camelCase
              .map((word, index) => {
                if (index === 0) {
                  return word.toLowerCase();
                }
                return (
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                );
              })
              .join('');

            // Add random suffix
            const randomSuffix = Math.random().toString(36).substring(2, 4);
            model.slug = `${slug.slice(0, 10)}${randomSuffix}`;
          }
        },
      },
    }
  );
  return Model;
};
