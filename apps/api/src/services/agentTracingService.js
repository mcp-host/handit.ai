import db from '../../models/index.js';
import { createAgentFromConfig } from './agentCreationService.js';
import { generateSlug } from '../utils/slugGenerator.js';

const { Agent, AgentNode, Model, AgentLog } = db;

export const createAgentFromTracing = async (agentLog, companyId) => {
  try {
    // Extract agent information from the log
    const { steps, input } = agentLog;
    
    if (!steps || steps.length === 0) {
      throw new Error('No steps found in the tracing log');
    }

    // Create the agent configuration
    const agentConfig = {
      agent: {
        name: `Agent from Trace ${new Date().toISOString().split('T')[0]}`,
        description: `Automatically created agent from tracing log ${agentLog.id}`,
        slug: generateSlug(`trace-agent-${agentLog.id}`)
      },
      nodes: []
    };

    // Map to track processed nodes to avoid duplicates
    const processedNodes = new Map();

    // Process each step to create nodes
    for (const step of steps) {
      const nodeId = step.mappingnodeid || step.nodeId;
      
      // Skip if we've already processed this node
      if (processedNodes.has(nodeId)) continue;
      
      // Get the original node to copy its configuration
      const originalNode = await AgentNode.findByPk(nodeId, {
        include: [{
          model: Model,
          as: 'Model'
        }]
      });

      if (!originalNode) continue;

      // Create node configuration
      const nodeConfig = {
        name: originalNode.name,
        type: originalNode.type,
        description: originalNode.config?.description || '',
        position: originalNode.config?.position || { x: 0, y: 0 },
        slug: generateSlug(originalNode.name),
        group: originalNode.group
      };

      // If it's a model node, add model configuration
      if (originalNode.type === 'model' && originalNode.Model) {
        nodeConfig.model = {
          provider: originalNode.Model.provider,
          problem_type: originalNode.Model.problemType,
          parameters: originalNode.Model.parameters
        };
      } else if (originalNode.type === 'tool') {
        nodeConfig.tool_type = originalNode.config?.toolType || 'HTTP';
      }

      // Add next nodes based on the step sequence
      nodeConfig.next_nodes = [];
      const currentStepIndex = steps.findIndex(s => (s.mappingnodeid || s.nodeId) === nodeId);
      if (currentStepIndex < steps.length - 1) {
        const nextStep = steps[currentStepIndex + 1];
        const nextNodeId = nextStep.mappingnodeid || nextStep.nodeId;
        const nextNode = await AgentNode.findByPk(nextNodeId);
        if (nextNode) {
          nodeConfig.next_nodes.push({
            slug: generateSlug(nextNode.name),
            input_name: 'input',
            output_name: 'output'
          });
        }
      }

      agentConfig.nodes.push(nodeConfig);
      processedNodes.set(nodeId, true);
    }

    // Create the agent using the existing creation service
    const agent = await createAgentFromConfig(agentConfig, companyId);
    return agent;
  } catch (error) {
    console.error('Error creating agent from tracing:', error);
    throw error;
  }
}; 