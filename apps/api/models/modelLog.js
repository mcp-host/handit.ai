'use strict';
import { Model, Op } from 'sequelize';
import {
  detectErrorMessage,
  outputContainsError,
} from '../src/services/outputProcessingService.js';
import {
  singleEvaluate,
} from '../src/services/evaluationService.js';
import { executeCalculateMetricsForModel } from '../src/services/modelMetricLogCalulatorService.js';
import { evaluateAB } from '../src/services/abTestService.js';
import { runReview } from '../src/services/insightsService.js';
import { isCorrect } from '../src/services/entries/correctnessEvaluatorService.js';
import { redisService } from '../src/services/redisService.js';
import { parseContext } from '../src/services/parser.js';
import { sendModelFailureNotification } from '../src/services/emailService.js';
import { sendPromptVersionCreatedEmail } from '../src/services/emailService.js';
import { autoDetectAndUpdateSystemPromptStructure } from '../src/services/systemPromptStructureManagerService.js';
import { createPromptOptimizationPR } from '../src/services/promptOptimizationPRService.js';

export default (sequelize, DataTypes) => {
  class ModelLog extends Model {
    static associate(models) {
      // Define associations here
      ModelLog.belongsTo(models.Model, { foreignKey: 'model_id' });
      ModelLog.belongsTo(models.AgentLog, {
        foreignKey: 'agent_log_id',
        allowNull: true,
      });
    }
  }
  ModelLog.init(
    {
      input: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      output: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      isCorrect: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        field: 'is_correct',
      },
      autoEvaluationProcessed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'auto_evaluation_processed',
      },
      processed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      metricProcessed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'metric_processed',
      },
      originalLogId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'original_log_id',
      },
      actual: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      predicted: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
      modelId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'model_id',
      },
      agentLogId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'agent_log_id',
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
      environment: {
        type: DataTypes.ENUM('production', 'staging'),
        allowNull: false,
        defaultValue: 'production',
      },
      status: {
        type: DataTypes.ENUM('success', 'error', 'crash'),
        allowNull: false,
        defaultValue: 'success',
      },
      batchId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'batch_id',
      },
      evaluationStatus: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: true,
        defaultValue: null,
        field: 'evaluation_status',
      },
      version: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '1',
        comment: 'Version of the model when the log was created'
      },
    },
    {
      sequelize,
      modelName: 'ModelLog',
      timestamps: true,
      paranoid: true,
      hooks: {
        afterCreate: async (modelLog) => {
          setImmediate(async () => {
            try {
              const model = await sequelize.models.Model.findByPk(
                modelLog.modelId
              );
 
              if (!model.active) {
                return;
              }

              // Check if system prompt structure detection is needed
              if (!model.systemPromptStructure) {
                // If we have 3 or more logs, trigger structure detection
                try {
                  console.log(`Triggering system prompt structure detection for model ${model.id} (${model.name})`);
                  await autoDetectAndUpdateSystemPromptStructure(model.id, sequelize.models.Model, sequelize.models.ModelLog);
                } catch (error) {
                  console.error(`Error detecting system prompt structure for model ${model.id}:`, error);
                }
              }

              let prompt = parseContext(modelLog.input, model);


              if (!model.isOptimized && prompt && prompt.length > 0 && !modelLog.originalLogId) {
                const modelVersions = await model.getModelVersions();
                if (modelVersions.length === 0 ) {
                  await model.createModelVersion({
                    prompt: prompt,
                    version: '1',
                    activeVersion: true,
                  });
                }
              }

              // Set the version field to the active model version (id-version)
              const modelVersion = await model.getModelVersion();
              if (modelVersion) {
                const versionString = `${modelVersion.modelId}-${modelVersion.version}`;
                if (modelLog.version !== versionString) {
                  await modelLog.update({ version: versionString });
                }
              }

              // Check if model is not a reviewer and has more than 10 logs
              if (!model.isReviewer) {
                const reviewers = await model.getReviewers();
                if (reviewers.length === 0) {
                  const reviewer = await sequelize.models.Model.create({
                    name: `${model.name} - Reviewer`,
                    provider: model.provider,
                    parameters: {
                      problemType: 'oss',
                    },
                    modelGroupId: model.modelGroupId,
                    type: 'largeLanguageModel',
                    problemType: model.problemType,
                    modelCategory: model.modelCategory,
                    active: true,
                    isReviewer: true,
                  });

                  await sequelize.models.ReviewersModels.create({
                    reviewerId: reviewer.dataValues.id,
                    modelId: model.id,
                    reviewer_id: reviewer.dataValues.id,
                    model_id: model.id,
                    activationThreshold: 5,
                    evaluationPercentage: model.flags?.isN8N ? 100 : 30,
                    limit: 5,
                  });
                }

                // check if model has informative evaluators
                let informativeEvaluators = await model.allEvaluationPrompts();
                informativeEvaluators = informativeEvaluators.filter(e => e.isInformative);
                
                const currentEvaluators = await model.evaluationPrompts();
                const currentInformativeEvaluators = currentEvaluators.filter(e => e.evaluationPrompt.isInformative);
                
                const difference = informativeEvaluators.filter(e => !currentInformativeEvaluators.some(ce => ce.evaluationPrompt.id === e.id));
                if (difference.length > 0) {
                  for (let i = 0; i < difference.length; i++) {
                    const evaluator = difference[i];
                    await model.addEvaluationPrompt(evaluator);
                  }
                }
              }

              
              await redisService.deletePattern(`entries:${modelLog.modelId}:*`);
              if (model.isReviewer) {
                return;
              }

              const modelGroup = await model.getModelGroup();
              const companyId = modelGroup.companyId;
              const company = await sequelize.models.Company.findByPk(
                companyId
              );

              if (company.testMode) {
                await company.moveModelMetricsToLast30Days();
              }

              if (
                !model.isReviewer &&
                modelLog.input.length > 0 &&
                !model.isOptimized &&
                !modelLog.originalLogId
              ) {
                const systemPrompt = parseContext(modelLog.input, model);
                await model.update({
                  parameters: {
                    ...model.parameters,
                    prompt: systemPrompt,
                  },
                });
              }

              const reviewers = await model.getReviewers();
              for (let i = 0; i < reviewers.length; i++) {
                const reviewer = reviewers[i];

                const reviewerInstance = await sequelize.models.Model.findOne({
                  where: {
                    id: reviewer.reviewerId,
                  },
                });

                const evaluationPercentage = reviewer.evaluationPercentage;

                const modelId = modelLog.modelId;
                const model = await sequelize.models.Model.findByPk(modelId);
                const prompts = await model.evaluationPrompts();
                
                // Separate AI evaluators (prompts) from function evaluators
                const aiEvaluators = prompts.filter(prompt => prompt.evaluationPrompt.type === 'prompt');
                const functionEvaluators = prompts.filter(prompt => prompt.evaluationPrompt.type === 'function');
                let evaluators = [];
                // Always run function evaluators (100% of the time)
                if (functionEvaluators.length > 0) {
                  evaluators = [...evaluators, ...functionEvaluators];
                }
                
                // Apply percentage only to AI evaluators (prompts)
                if (aiEvaluators.length > 0) {
                  const randomNumberFrom0To100 = Math.floor(Math.random() * 101);
                  if (randomNumberFrom0To100 <= evaluationPercentage) {
                    evaluators = [...evaluators, ...aiEvaluators];
                  }
                }

                if (evaluators.length > 0) {
                  await singleEvaluate(
                    modelLog,
                    reviewerInstance,
                    evaluators,
                    model.flags?.isN8N,
                    sequelize.models.EvaluationLog
                  );
                }
              }
              const abTestModels = await model.getABTestModels();

              for (let i = 0; i < abTestModels.length; i++) {
                const randomNumberFrom0To100 = Math.floor(Math.random() * 101);
                const abTest = abTestModels[i].abTest;
                if (randomNumberFrom0To100 <= abTest.percentage) {
                  await evaluateAB(
                    modelLog,
                    abTestModels[i],
                    sequelize.models.ModelLog,
                    modelLog.id,
                    sequelize.models,
                    company
                  );
                }
              }

              const output = modelLog.output;
              const hasError = outputContainsError(output);
              let errorMessage = '';

              if (hasError) {
                errorMessage = detectErrorMessage(output);
              }
              const modelMetric = await sequelize.models.ModelMetric.findOne({
                where: {
                  modelId: modelLog.modelId,
                  type: 'health_check',
                },
              });

              if (!modelMetric) {
                return;
              }

              const lastModelMetricLog =
                await modelMetric.getLastModelMetricLogs(1);

              if (hasError) {
                await modelMetric.createModelMetricLog({
                  value: 0,
                  description: errorMessage,
                  label: 'health_check',
                });
              } else {
                const lastModelMetricLogValue = lastModelMetricLog[0]?.value;

                if (
                  lastModelMetricLog.length === 0 ||
                  lastModelMetricLogValue === 0
                ) {
                  await modelMetric.createModelMetricLog({
                    value: 1,
                    description: 'Model health check passed',
                    label: 'health_check',
                  });
                }
              }

              const random = Math.floor(Math.random() * 101);
              if (random <= 20) {
                await model.generateInsights();
                const newPrompt = await model.applySuggestions();
                if (newPrompt) {
                  const existingABTest = await sequelize.models.ABTestModels.findOne({
                    where: {
                      modelId: model.id,
                      principal: true
                    }
                  });
        
                  if (existingABTest) {
                    // Update the optimized model version
                    await model.updateOptimizedPrompt(newPrompt);
                  } else {
                    // Create a new optimized model
                    const originalModel = model.toJSON();
                    // remove id from originalModel
                    delete originalModel.id;

                    const optimizedModel = await sequelize.models.Model.create({
                      ...originalModel,
                      slug: `${model.slug}-optimized-${Date.now()}`,
                      isOptimized: true,
                      parameters: {
                        prompt: newPrompt,
                        problemType: model.parameters?.problemType
                      },
                      problemType: model.problemType,
                    });

                    // Copy metrics and reviewers
                    const metrics = await model.getModelMetrics();
                    for (const metric of metrics) {
                      await sequelize.models.ModelMetric.create({
                        ...metric.toJSON(),
                        id: undefined,
                        modelId: optimizedModel.id
                      });
                    }

                    const reviewers = await model.getReviewers();
                    for (const reviewer of reviewers) {
                      await sequelize.models.ReviewersModels.create({
                        modelId: optimizedModel.id,
                        model_id: model.id,
                        reviewer_id: reviewer.reviewerId,
                        reviewerId: reviewer.reviewerId
                      });
                    }

                    // Create AB test
                    await sequelize.models.ABTestModels.create({
                      modelId: model.id,
                      optimizedModelId: optimizedModel.id,
                      principal: true,
                      percentage: 30
                    });

                    await model.updateOptimizedPrompt(newPrompt);

                    // Create GitHub PR for prompt optimization
                    try {
                      const agentNode = await sequelize.models.AgentNode.findOne({
                        where: {
                          modelId: model.id,
                          deletedAt: null
                        }
                      });

                      if (agentNode) {
                        const agent = await sequelize.models.Agent.findByPk(agentNode.agentId);
                        
                        if (agent && agent.repository) {
                          const originalPrompt = model.parameters?.prompt || parseContext(modelLog.input, model);
                          
                          // Calculate improvement metrics from recent evaluations
                          const recentLogs = await sequelize.models.ModelLog.findAll({
                            where: {
                              modelId: model.id,
                              createdAt: {
                                [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                              }
                            },
                            limit: 100,
                            order: [['createdAt', 'DESC']]
                          });

                          const successfulLogs = recentLogs.filter(log => log.status === 'success');
                          const accuracy = recentLogs.length > 0 ? successfulLogs.length / recentLogs.length : 0;
                          const improvement = 0.15; // Default improvement assumption, could be calculated from A/B test results

                          const metrics = {
                            accuracy,
                            improvement,
                            totalEvaluations: recentLogs.length,
                            successfulEvaluations: successfulLogs.length,
                            timestamp: new Date().toISOString()
                          };

                          console.log(`🔄 Creating GitHub PR for prompt optimization - Agent: ${agent.name}`);
                          
                          const prResult = await createPromptOptimizationPR({
                            agent,
                            originalPrompt,
                            optimizedPrompt: newPrompt,
                            metrics,
                            models: sequelize.models
                          });

                          if (prResult.success) {
                            console.log(`✅ Successfully created GitHub PR #${prResult.prNumber}: ${prResult.prUrl}`);
                          } else {
                            console.log(`❌ Failed to create GitHub PR: ${prResult.error}`);
                          }
                        }
                      }
                    } catch (prError) {
                      console.error('Error creating GitHub PR for prompt optimization:', prError);
                    }

                    // Send email notification for new prompt version
                    try {
                      // Get the agent information
                      const agentNode = await sequelize.models.AgentNode.findOne({
                        where: {
                          modelId: model.id,
                          deletedAt: null
                        }
                      });

                      if (agentNode) {
                        const agent = await sequelize.models.Agent.findByPk(agentNode.agentId);
                        const company = await sequelize.models.Company.findByPk(agent.companyId);
                        
                        // Get users of the company
                        const users = await sequelize.models.User.findAll({
                          where: {
                            companyId: company.id,
                            deletedAt: null
                          }
                        });

                        // Get the prompt version
                        const modelVersions = await sequelize.models.ModelVersions.findAll({
                          where: {
                            modelId: model.id
                          },
                          order: [['createdAt', 'DESC']],
                          limit: 1
                        });

                        const promptVersion = modelVersions[0]?.version || '1';

                        // Send email to each user
                        for (const user of users) {
                          await sendPromptVersionCreatedEmail({
                            recipientEmail: user.email,
                            firstName: user.firstName,
                            agentName: agent.name,
                            modelName: model.name,
                            promptVersion: promptVersion,
                            agentId: agent.id,
                            modelId: model.id,
                            Email: sequelize.models.Email,
                            User: sequelize.models.User,
                            notificationSource: 'prompt_version_created',
                            sourceId: model.id
                          });
                        }
                      }
                    } catch (emailError) {
                      console.error('Error sending prompt version created email:', emailError);
                    }

                  }
                }
              }
              if (!model.isReviewer && !model.isOptimized && !modelLog.originalLogId) {
                await model.saveABCorrectEntriesByDayInCache();
                await model.saveABMetricsInCache();
                await model.saveModelMetricsInCache();
                await model.saveModelMetricsOfModelMonitoringInCache();
                await model.saveMetricsFullDateInCache();
              }
            } catch (error) {
              console.error('Error in ModelLog afterCreate hook:', error);
            }
          });
        },
        afterUpdate: async (modelLog) => {
          setImmediate(async () => {
            try {
              const model = await sequelize.models.Model.findByPk(
                modelLog.modelId
              );
              if (!model) {
                return;
              }
              if (!model.active) {
                return;
              }
              if (model.isReviewer) {
                return;
              }
              const insights = await sequelize.models.Insights.findAll({
                where: {
                  modelId: modelLog.modelId,
                },
              });
              if (!isCorrect(modelLog) && insights.length < 10) {
                const insightsModels = await model.getInsightsModels();
                for (let i = 0; i < insightsModels.length; i++) {
                  const insightModel = insightsModels[i];
                  const percentage = insightModel.percentage;
                  const randomNumberFrom0To100 = Math.floor(
                    Math.random() * 101
                  );
                  if (randomNumberFrom0To100 <= percentage) {
                    const reviewer = await sequelize.models.Model.findOne({
                      where: {
                        id: insightModel.insightModelId,
                      },
                    });
                    await runReview(
                      modelLog,
                      reviewer,
                      sequelize.models.ModelLog,
                      sequelize.models.Insights,
                      model.problemType
                    );
                  }
                }
              }

              if (
                modelLog.actual &&
                modelLog.actual !== null &&
                !isCorrect(modelLog)
              ) {
                await modelLog.update({
                  status: 'error',
                });
                const agentLog = await sequelize.models.AgentLog.findByPk(
                  modelLog.agentLogId
                );
                if (agentLog) {
                  await agentLog.update({
                    status: 'failed_model',
                  });
                }
                
                // Send email notification for model failure
                await sendModelFailureNotification(modelLog, sequelize.models.Model, sequelize.models.AgentLog, sequelize.models.Agent, sequelize.models.AgentNode, sequelize.models.Company, sequelize.models.Email, sequelize.models.User);
              }

              if (
                modelLog.actual &&
                modelLog.actual !== null &&
                !modelLog.metricProcessed
              ) {
                const logVersion = modelLog.version;
                await executeCalculateMetricsForModel(
                  model,
                  sequelize.models.ModelMetricLog,
                  logVersion
                );
              }

              if (modelLog.agentLogId) {
                // const { updateAgentEntryFlowCache } = await import('../src/services/agentService.js');
                // await updateAgentEntryFlowCache(modelLog.agentLogId);
              }
            } catch (error) {
              console.error('Error in ModelLog afterUpdate hook:', error);
            }
          });
        },
      },
    }
  );
  return ModelLog;
};
