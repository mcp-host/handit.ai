import { generateAIResponse } from './aiService.js';
import { z } from 'zod';

const SystemPromptStructureSchema = z.object({
  structure: z.object({
    path: z.string().describe('The path to the system prompt in the data structure (e.g., "messages[0].content" or "input.options.systemMessage")'),
    type: z.enum(['direct', 'nested', 'array']).describe('The type of structure: direct (direct field), nested (nested object), or array (array of messages)'),
    field: z.string().describe('The specific field name that contains the system prompt'),
    arrayIndex: z.number().optional().describe('If type is array, the index where system prompt is found'),
    parentField: z.string().optional().describe('The parent field that contains the system prompt field')
  }),
  confidence: z.number().min(0).max(1).describe('Confidence level in the detected structure (0-1)'),
  reasoning: z.string().describe('Explanation of how the structure was detected')
});

/**
 * Detects the structure of system prompts in input data using AI
 * @param {Array} logs - Array of model logs to analyze
 * @param {Object} model - The model object
 * @returns {Promise<Object>} The detected system prompt structure
 */
export const detectSystemPromptStructure = async (logs, model) => {
  try {

    // Take a sample of logs for analysis
    const sampleLogs = logs.slice(0, Math.min(2, logs.length));
    
    // Prepare the analysis data
    const analysisData = sampleLogs.map((log, index) => ({
      logIndex: index,
      input: log.input,
      hasSystemPrompt: false,
      systemPromptLocation: null
    }));

    // First pass: manually check for common patterns
    for (const data of analysisData) {
      const systemPrompt = findSystemPromptInData(data.input);
      if (systemPrompt) {
        data.hasSystemPrompt = true;
        data.systemPromptLocation = systemPrompt;
      }
    }

    // If we found system prompts in at least 2 logs, analyze the pattern
    const logsWithSystemPrompts = analysisData.filter(data => data.hasSystemPrompt);
    
    if (logsWithSystemPrompts.length >= 2) {
      const structure = analyzeSystemPromptPattern(logsWithSystemPrompts);
      return {
        structure,
        confidence: 0.9,
        reasoning: `Detected consistent system prompt structure across ${logsWithSystemPrompts.length} logs`
      };
    }

    // If no clear pattern found, use AI to analyze the structure
    const messages = [
      {
        role: 'system',
        content: `You are an expert at analyzing data structures and identifying where system prompts are located. 
        
        Your task is to analyze the provided input data structures and determine the most likely path where system prompts are stored.
        
        Common patterns include:
        - messages[0].content (for chat-style inputs)
        - input.options.systemMessage (for structured inputs)
        - systemMessage (direct field)
        - prompt (direct field)
        - system (direct field)
        
        Look for:
        1. Fields that contain instructional text
        2. Fields that appear consistently across multiple inputs
        3. Fields that are likely to contain system instructions
        
        Return a structured response with the detected path and confidence level.`
      },
      {
        role: 'user',
        content: `Analyze these input data structures and determine where system prompts are most likely located:

${JSON.stringify([analysisData[0]].map(data => ({
  logIndex: data.logIndex,
  input: data.input
})), null, 2)}

Focus on finding consistent patterns across the logs. If no clear pattern exists, provide the most likely structure based on the data format.`
      }
    ];

    const response = await generateAIResponse({
      messages,
      responseFormat: SystemPromptStructureSchema
    });

    const result = JSON.parse(response.text);
    return result;

  } catch (error) {
    console.error('Error detecting system prompt structure:', error);
    return {
      structure: null,
      confidence: 0,
      reasoning: `Error during detection: ${error.message}`
    };
  }
};

/**
 * Manually searches for system prompts in data using common patterns
 * @param {any} data - The input data to search
 * @returns {Object|null} The found system prompt location or null
 */
const findSystemPromptInData = (data) => {
  if (!data) return null;

  // Check for direct system message in array
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item && typeof item === 'object' && item.role === 'system' && item.content) {
        return {
          path: `[${i}].content`,
          type: 'array',
          field: 'content',
          arrayIndex: i,
          parentField: 'role'
        };
      }
    }
  }

  // Check for nested system message
  if (typeof data === 'object') {
    // Check common patterns
    const patterns = [
      { path: 'input.options.systemMessage', field: 'systemMessage', parentField: 'options' },
      { path: 'systemMessage', field: 'systemMessage' },
      { path: 'options.systemMessage', field: 'systemMessage', parentField: 'options' },
      { path: 'prompt', field: 'prompt' },
      { path: 'system', field: 'system' }
    ];

    for (const pattern of patterns) {
      const value = getNestedValue(data, pattern.path);
      if (value && typeof value === 'string' && value.length > 10) {
        return {
          path: pattern.path,
          type: 'nested',
          field: pattern.field,
          parentField: pattern.parentField
        };
      }
    }
  }

  return null;
};

/**
 * Analyzes patterns in system prompt locations
 * @param {Array} logsWithSystemPrompts - Logs that contain system prompts
 * @returns {Object} The detected structure
 */
const analyzeSystemPromptPattern = (logsWithSystemPrompts) => {
  // Group by structure type
  const structures = logsWithSystemPrompts.map(log => log.systemPromptLocation);
  
  // Find the most common structure
  const structureCounts = {};
  structures.forEach(structure => {
    const key = `${structure.type}:${structure.path}`;
    structureCounts[key] = (structureCounts[key] || 0) + 1;
  });

  const mostCommonKey = Object.keys(structureCounts).reduce((a, b) => 
    structureCounts[a] > structureCounts[b] ? a : b
  );

  const [type, path] = mostCommonKey.split(':');
  const mostCommonStructure = structures.find(s => `${s.type}:${s.path}` === mostCommonKey);

  return {
    path: mostCommonStructure.path,
    type: mostCommonStructure.type,
    field: mostCommonStructure.field,
    arrayIndex: mostCommonStructure.arrayIndex,
    parentField: mostCommonStructure.parentField
  };
};

/**
 * Gets a nested value from an object using a path string
 * @param {Object} obj - The object to search
 * @param {string} path - The path to the value (e.g., "input.options.systemMessage")
 * @returns {any} The value at the path or undefined
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

/**
 * Updates a model's system prompt structure
 * @param {Object} model - The model to update
 * @param {Object} structure - The detected structure
 * @returns {Promise<Object>} The updated model
 */
export const updateModelSystemPromptStructure = async (model, structure) => {
  try {
    model.systemPromptStructure = structure;
    await model.save();
    return model;
  } catch (error) {
    console.error('Error updating model system prompt structure:', error);
    throw error;
  }
}; 