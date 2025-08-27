// Helper to check if a string is base64 and if it's an image
import { Jimp } from 'jimp';
const isBase64 = (str) => {
  if (!str || typeof str !== 'string') return false;
  try {
    // Check if it's a data URL
    if (str.startsWith('data:')) {
      // Check if it's an image
      return str.startsWith('data:image/');
    }
    
    // For raw base64
    const base64String = str.split(',')[1] || str;
    return btoa(atob(base64String)) === base64String;
  } catch (err) {
    return false;
  }
};

/**
 * Extracts system messages as context from any data structure
 * @param {any} data - Input data structure
 * @param {Object} model - Optional model object with systemPromptStructure
 * @returns {string|null} Concatenated context messages or null if none found
 */
export const parseContext = (data, model = null) => {
  if (!data) return null;

  const systemMessages = [];
  
  const extractSystemContent = (item) => {
    if (item?.input?.options?.systemMessage || item?.systemMessage || item?.options?.systemMessage || item?.input?.options?.systemPromptTemplate) {
      systemMessages.push(item?.input?.options?.systemMessage || item?.systemMessage || item?.options?.systemMessage || item?.input?.options?.systemPromptTemplate);
      return;
    }
    if (!item) return;
    
    if (Array.isArray(item)) {
      item.forEach(extractSystemContent);
    } else if (typeof item === 'object') {
      if (item?.input?.options?.systemMessage) {
        systemMessages.push(item.input.options.systemMessage);
      }
      if (item?.input?.options?.systemPromptTemplate) {
        systemMessages.push(item.input.options.systemPromptTemplate);
      }
      if (item.role === 'system' && item.content) {
        systemMessages.push(item.content);
      } else {
        Object.values(item).forEach(extractSystemContent);
      }
    }
  };
  
  extractSystemContent(data);
  
  // If no system messages found and model has systemPromptStructure, try using it
  if (systemMessages.length === 0 && model?.systemPromptStructure?.structure) {
    const structure = model.systemPromptStructure.structure;
    const systemPrompt = extractSystemPromptUsingStructure(data, structure);
    if (systemPrompt) {
      systemMessages.push(systemPrompt);
    }
  }
  
  return systemMessages.length > 0 ? systemMessages.join(', ') : null;
};

/**
 * Extracts system prompt using the detected structure
 * @param {any} data - Input data structure
 * @param {Object} structure - The system prompt structure
 * @returns {string|null} The system prompt or null if not found
 */
const extractSystemPromptUsingStructure = (data, structure) => {
  if (!data || !structure) return null;

  try {
    switch (structure.type) {
      case 'array':
        if (Array.isArray(data) && structure.arrayIndex !== undefined) {
          const item = data[structure.arrayIndex];
          if (item && typeof item === 'object' && item[structure.field]) {
            return item[structure.field];
          }
        }
        break;
      
      case 'nested':
        const value = getNestedValue(data, structure.path);
        if (value && typeof value === 'string') {
          return value;
        }
        break;
      
      case 'direct':
        if (data && typeof data === 'object' && data[structure.field]) {
          return data[structure.field];
        }
        break;
    }
  } catch (error) {
    console.error('Error extracting system prompt using structure:', error);
  }

  return null;
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
 * Extracts base64 attachments from any data structure
 * @param {any} data - Input data structure
 * @returns {string[]} Array of base64 strings
 */

const isValidImageBase64 = async (base64String) => {
  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const image = await Jimp.read(buffer);
    return image.bitmap.width > 0 && image.bitmap.height > 0;
  } catch (err) {
    return false;
  }
};

export const parseAttachments = async (data) => {
  const attachments = [];
  
  const extractAttachments = async (item) => {
    if (!item) return;
    
    if (typeof item === 'string' && isBase64(item)) {
      const isValidImage = await isValidImageBase64(item);
      if (isValidImage) {
        attachments.push(item);
      }
    } else if (Array.isArray(item)) {
      await Promise.all(item.map(extractAttachments));
    } else if (typeof item === 'object') {
      // Check specific attachment fields first
      const attachmentFields = ['image', 'image_url', 'url'];
      for (const field of attachmentFields) {
        if (item[field] && isBase64(item[field])) {
          const isValidImage = await isValidImageBase64(item[field]);
          if (isValidImage) {
            attachments.push(item[field]);
            return;
          } else {
            attachments.push(item[field]);
          }
        }
      }
      // Continue searching in other fields
      await Promise.all(Object.values(item).map(extractAttachments));
    }
  };
  
  await extractAttachments(data);
  return attachments;
};

// Helper to get a short representation of an image base64
export const getImagePlaceholder = (base64String) => {
  if (!base64String || !isBase64(base64String)) return base64String;
  return '[Image]';
};

const extractAllDicts = (item, dicts = []) => {
  if (!item) return dicts;
  
  if (typeof item === 'object' && !Array.isArray(item)) {
    if (item.__dict__) {
      dicts.push(item.__dict__);
    }
    
    // Recursively check all nested objects
    Object.values(item).forEach(value => extractAllDicts(value, dicts));
  } else if (Array.isArray(item)) {
    item.forEach(value => extractAllDicts(value, dicts));
  }
  
  return dicts;
};

/**
 * Extracts meaningful content from input data
 * @param {any} data - Input data structure
 * @param {Object} model - Optional model object with systemPromptStructure
 * @returns {string} Extracted content or formatted fallback
 */
export const parseInputContent = (data, model = null) => {
  if (!data) return '';
  
  // First check for any __dict__ objects
  const dicts = extractAllDicts(data);
  if (dicts.length > 0) {
    return JSON.stringify(dicts, null);
  }
  
  // If no __dict__ found, continue with normal parsing
  const contents = [];
  let match = false;
  const extractContent = (item) => {
    if (!item) return;
    
    if (typeof item === 'string' && !isBase64(item)) {
      contents.push(item);
      return;
    }
    
    if (Array.isArray(item)) {
      item.forEach(extractContent);
      return;
    }
    
    if (typeof item === 'object') {

      if (item.type && item.type === 'image_url') {
        return;
      }
      // Skip system messages and attachments
      if (item.role === 'system') return;
      
      // Skip system prompts using detected structure
      if (model?.systemPromptStructure?.structure) {
        const structure = model.systemPromptStructure.structure;
        if (isSystemPromptField(item, structure)) {
          return;
        }
      }
      
      // Prioritize content field
      if (item.content && typeof item.content === 'string' && !isBase64(item.content)) {
        contents.push(item.content);
        match = true;
        return;
      }

      // Check for common input fields
      const inputFields = ['input', 'query', 'prompt', 'text', 'message'];
      for (const field of inputFields) {
        if (item[field] && typeof item[field] === 'string' && !isBase64(item[field])) {
          contents.push(item[field]);
          match = true;
          return;
        }
      }
      
      // Recursively process other fields
      Object.values(item).forEach(extractContent);
    }
  };
  
  extractContent(data);
  if (!match) {
    return JSON.stringify(data, null);
  }
  return contents.join(', ');
};

/**
 * Checks if an item is a system prompt field based on the detected structure
 * @param {any} item - The item to check
 * @param {Object} structure - The system prompt structure
 * @returns {boolean} True if the item is a system prompt field
 */
const isSystemPromptField = (item, structure) => {
  if (!item || !structure) return false;

  try {
    switch (structure.type) {
      case 'array':
        if (structure.arrayIndex !== undefined && structure.field) {
          return item[structure.field] !== undefined;
        }
        break;
      
      case 'nested':
        if (structure.field) {
          return item[structure.field] !== undefined;
        }
        break;
      
      case 'direct':
        if (structure.field) {
          return item[structure.field] !== undefined;
        }
        break;
    }
  } catch (error) {
    console.error('Error checking system prompt field:', error);
  }

  return false;
};

/**
 * Extracts meaningful content from output data
 * @param {any} data - Output data structure
 * @returns {string} Extracted content or formatted fallback
 */
export const parseOutputContent = (data) => {
  if (!data) return '';

  // First check for any __dict__ objects
  const dicts = extractAllDicts(data);
  if (dicts.length > 0) {
    return JSON.stringify(dicts, null);
  }
  
  // If no __dict__ found, continue with normal parsing
  const contents = [];
  let match = false;

  const extractContent = (item) => {
    if (!item) return;
    
    if (typeof item === 'string' && !isBase64(item)) {
      contents.push(item);
      return;
    }
    
    if (Array.isArray(item)) {
      item.forEach(extractContent);
      return;
    }
    
    if (typeof item === 'object') {
      // Handle GPT-style responses with choices
      if (item.tool_calls) {
        item.tool_calls.forEach(toolCall => {
          if (toolCall.function.arguments) {
            contents.push(toolCall.function.arguments);
            match = true;
          }
        });
      }
      if (item.choices && Array.isArray(item.choices)) {
        item.choices.forEach(choice => {
          if (choice.message?.content) {
            contents.push(choice.message.content);
            match = true;
          } else if (choice.content) {
            contents.push(choice.content);
            match = true;
          } else if (choice.text) {
            contents.push(choice.text);
            match = true;
          }
        });
        return;
      }

      // Include all content, even from system messages
      if (item.content && typeof item.content === 'string' && !isBase64(item.content)) {
        contents.push(item.content);
        match = true;
        return;
      }

      // Check for common output fields
      const outputFields = ['output', 'response', 'text', 'message', 'answer'];
      for (const field of outputFields) {
        if (item[field] && typeof item[field] === 'string' && !isBase64(item[field])) {
          contents.push(item[field]);
          match = true;
          return;
        }
      }
      
      // Recursively process other fields
      Object.values(item).forEach(extractContent);
    }
  };
  
  extractContent(data);
  if (!match) {
    return JSON.stringify(data, null);
  }
  return contents.join(', ');
}; 