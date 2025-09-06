import evaluationPrompt from '../../models/evaluationPrompt.js';
import db from '../../models/index.js';
import { Op } from 'sequelize';

const { Agent, AgentNode, AgentConnection, Model, ModelGroup, ModelEvaluationPrompt, EvaluationPrompt } = db;

export const createAgentFromConfig = async (config, companyId, isN8N = false) => {
  const slug = config.agent.slug || generateSlug(config.agent.name)
  const createdAgent = await Agent.findOne({ where: { slug, companyId } });
  if (createdAgent) {
    throw new Error('Agent already exists');
  }
  try {
    // Create the agent
    const agent = await Agent.create({
      name: config.agent.name,
      description: config.agent.description,
      companyId,
      slug: config.agent.slug || generateSlug(config.agent.name)
    });

    // Create nodes and store their IDs for connections
    const nodeMap = new Map();
    
    for (const nodeConfig of config.nodes) {
      let node;
      
      if (nodeConfig.type === 'model') {
        // Create the model first
        const modelGroup = await ModelGroup.create({
          name: nodeConfig.name,
          description: nodeConfig.description,
          companyId: companyId
        });
        const model = await Model.create({
          name: nodeConfig.name,
          description: nodeConfig.description,
          provider: nodeConfig?.model?.provider || 'openai',
          problemType: nodeConfig?.model?.problem_type || 'text_generation',
          parameters: nodeConfig?.model?.parameters || {},
          slug: generateSlug(nodeConfig.name),
          modelGroupId: modelGroup.id,
          active: true,
          flags: {
            isN8N: isN8N
          }
        });

        // Add default correctness evaluator to all models
        try {
          await Model.addDefaultCorrectnessEvaluator(model.id, companyId);
        } catch (error) {
          console.error('Failed to add correctness evaluator:', error);
          // Don't fail the model creation if evaluator addition fails
        }

        if (isN8N) {
          // add hallucination evaluator for N8N models
          const hallucinationEvaluator = await EvaluationPrompt.findOne({
            where: {
              name: 'Hallucination & Factual Accuracy Evaluation',
              companyId: companyId
            }
          });
          if (hallucinationEvaluator) {
            await ModelEvaluationPrompt.create({
              modelId: model.id,
              evaluationPromptId: hallucinationEvaluator.id,
              companyId: companyId
            });
          }
        }

        // Create the model node
        node = await AgentNode.create({
          agentId: agent.id,
          name: nodeConfig.name,
          type: 'model',
          config: {
            position: nodeConfig.position,
            model: model.id,
            description: nodeConfig.description
          },
          group: nodeConfig.group,
          modelId: model.id,
          slug: nodeConfig.slug || generateSlug(nodeConfig.name)
        });
      } else {
        // Create tool node
        node = await AgentNode.create({
          agentId: agent.id,
          name: nodeConfig.name,
          type: 'tool',
          group: nodeConfig.group,
          config: {
            position: nodeConfig.position,
            description: nodeConfig.description,
            toolType: nodeConfig.tool_type || 'HTTP'
          },
          slug: nodeConfig.slug || generateSlug(nodeConfig.name)
        });
      }

      nodeMap.set(nodeConfig.slug, node.id);
    }

    // Create connections
    for (const nodeConfig of config.nodes) {
      if (nodeConfig.next_nodes && nodeConfig.next_nodes.length > 0) {
        const fromNodeId = nodeMap.get(nodeConfig.slug);
        
        for (const nextNode of nodeConfig.next_nodes) {
          const toNodeId = nodeMap.get(nextNode.slug);
          
          if (fromNodeId && toNodeId) {
            await AgentConnection.create({
              agentId: agent.id,
              fromNodeId,
              toNodeId,
              inputName: nextNode.input_name,
              outputName: nextNode.output_name
            });
          }
        }
      }
    }

    // Update node types (initial/end nodes)
    await AgentConnection.updateNodeTypes(agent.id);

    // Fetch the complete agent with all relations
    const completeAgent = await Agent.findByPk(agent.id, {
      include: [
        {
          model: AgentNode,
          include: [
            {
              model: Model,
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

    return completeAgent;
  } catch (error) {
    console.error('Error creating agent from config:', error);
    throw error;
  }
};

// Helper function to generate a slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('') + Math.random().toString(36).substring(2, 4);
}; 