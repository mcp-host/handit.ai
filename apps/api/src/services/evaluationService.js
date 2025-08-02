import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { executeTrack } from './trackService.js';
import {
  parseAttachments,
  parseContext,
  parseInputContent,
  parseOutputContent,
} from './parser.js';
import { isCorrect } from './entries/correctnessEvaluatorService.js';
import {
  classificationEvaluationSystemPrompt,
  classificationEvaluationUserPrompt,
  LLMEvaluationSystemPrompt,
  LLMEvaluationUserPrompt,
} from './evaluationPrompts.js';
import { dataExtractionPrompts } from './prompts/dataExtractionPrompts.js';
import { textGenerationPrompts } from './prompts/textGenerationPrompts.js';
import { dataMappingPrompts } from './prompts/dataMappingPrompts.js';
import { classificationPrompts } from './prompts/classificationPrompts.js';
import { demoPrompts } from './prompts/demoPrompts.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateAIResponse } from './aiService.js';
import { Op } from 'sequelize';


const evaluationObject = {
  data_extraction: dataExtractionPrompts,
  generation: textGenerationPrompts,
  text_generation: textGenerationPrompts,
  mapping: dataMappingPrompts,
  classification: classificationPrompts,
  demo: demoPrompts,
};

const openAi = new OpenAI(process.env.OPENAI_API_KEY);

const ClassificationEvaluation = z.object({
  classificationAccuracy: z.object({
    modelOutput: z.string(),
    expectedOutput: z.string(),
  }),
  reasoningQuality: z.object({
    score: z.number(),
  }),
  outputFormatting: z.object({
    score: z.number(),
  }),
  confidenceLevel: z.enum(['High', 'Moderate', 'Low']),
  feedback: z.string(),
});

const LLMEvaluation = z.object({
  metrics: z.object({
    relevance: z.number(),
    coherence: z.number(),
    correctness: z.number(),
  }),
  confidenceLevel: z.enum(['High', 'Moderate', 'Low']),
  feedback: z.string(),
});

const randomSample = (array, n) => {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
};

export const summaryEvaluation = async (log, evaluatorPrompts = null) => {
  if (!evaluatorPrompts) {
    evaluatorPrompts = dataExtractionPrompts;
  }
  const messages = [
    {
      role: 'system',
      content: evaluatorPrompts.summarySystemPrompt,
    },
    {
      role: 'user',
      content:
        evaluatorPrompts.summaryUserPrompt +
        `
      \n\n 

      ${log.actual.evaluations
        .map(
          (evaluation) => `
      ${evaluation.evaluator} Evaluation:
      ${JSON.stringify(evaluation)}
      `
        )
        .join('\n\n')}

      NOTE: THERE ARE VALUES THAT ARE NOT PRESENT IN THE USER INPUT, SO CROSS COMPLETENESS WITH ACCURACY, TO CHECK IF MISSING VALUES ARE REALLY MISSING OR IF IT IS OK THOSE ARE EMPTY.
      DO NOT FLAG AS ERROR IF THE EVALUATORS MISSCLASSIFIED THE VALUES AS MISSING.

      DO NOT MAKE ANY COMMENT ON THE EVALUATIONS THEMSELVES, ONLY TELL WHY THE EVALUAION IS SAYING THE MODEL IS CORRECT OR INCORRECT.

      EVALUATORS ARE ASSUMED TO BE CORRECT, SO DO NOT FLAG ANY ISSUE ON THE EVALUATIONS.
      `,
    },
  ];

  const completion = await generateAIResponse({
    messages,
  });

  const summary = completion.choices[0].message.content;
  return summary;
};

export const singleEvaluate = async (entry, evaluator, prompts = [], isN8N = false, EvaluationLog = null) => {
  const MAX_RETRIES = 2;

  let retries = 0;
  let evaluation;

  while (retries < MAX_RETRIES) {
    try {
      evaluation = await evaluate(entry, prompts, isN8N);
      break; 
    } catch {
      retries++;
    }
  }
  let parsedOutput;

  parsedOutput = parseEvaluatorsOutput(evaluation);
  const status = isCorrect({ actual: parsedOutput }) ? 'success' : 'error';

  await updateModelLog(entry, {
    actual: parsedOutput,
    autoEvaluationProcessed: true,
    processed: true,
    status: status,
  });

  for (const ev of evaluation) {
    const evaluationId = ev.evaluatorId;
    const score = ev.score;
    if (!EvaluationLog) {
      continue;
    }
    await EvaluationLog.create({
      modelLogId: entry.id,
      modelId: entry.modelId,
      evaluationPromptId: evaluationId,
      isCorrect: ev.isInformative ? null : score >= 8,
    });
  }

  return { entry, evaluation, status };
};

export const evaluateSamples = async (
  entries,
  entriesCount,
  evaluationPercentage,
  evaluator,
  ModelLog,
  limit = 5
) => {
  const MAX_RETRIES = 2;
  const sample = randomSample(
    entries,
    Math.min(Math.floor((entriesCount * evaluationPercentage) / 100.0), limit)
  );

  const evaluations = await Promise.all(
    sample.map(async (entry) => {
      let retries = 0;
      let evaluation = null;

      while (retries < MAX_RETRIES) {
        try {
          evaluation = await evaluate(entry, []);
          return { entry, evaluation };
        } catch (error) {
          retries++;
          console.error(`Error on attempt ${retries} for entry:`, entry, error);
        }
      }

      return { entry, evaluation: null };
    })
  );

  for (let i = 0; i < evaluations.length; i++) {
    const { entry, evaluation } = evaluations[i];
    if (!evaluation || evaluation === null) {
      console.warn(
        `Entry failed evaluation after ${MAX_RETRIES} retries:`,
        entry
      );
      continue;
    }

    let parsedOutput;
    if (evaluation.type === 'evaluators') {
      if (evaluator.parameters.problemType === 'classification') {
        parsedOutput = parseClassificationOutput(evaluation);
      } else {
        parsedOutput = parseEvaluatorsOutput(evaluation.evaluations);
      }
    } else {
      if (evaluator.parameters.outputStyle === 'LLM') {
        parsedOutput = parseLLMOutput(evaluation);
      } else {
        parsedOutput = parseClassificationOutput(evaluation);
      }
    }


    const summary = await summaryEvaluation({
      actual: parsedOutput,
    });

    const parsedOutputWithSummary = {
      ...parsedOutput,
      summary,
    };

    await updateModelLog(entry, {
      actual: parsedOutputWithSummary,
      autoEvaluationProcessed: true,
      processed: true,
      status: isCorrect({ actual: parsedOutput }) ? 'success' : 'error',
    });
  }
};

const updateModelLog = async (entry, data) => {
  return await entry.update(data);
};

const parseClassificationOutput = (output) => {
  let parsedExpectedOutput = output.evaluations[0].expectedOutput;
  try {
    parsedExpectedOutput = JSON.parse(output.evaluations[0].expectedOutput);
  } catch (error) {
    console.error('Error parsing classification output:', error);
  }
  let parsedModelOutput = output.evaluations[0].modelOutput;
  try {
    parsedModelOutput = JSON.parse(output.evaluations[0].modelOutput);
  } catch (error) {
    console.error('Error parsing classification output:', error);
  }

  return {
    ...output,
    class: parsedExpectedOutput,
    modelClass: parsedModelOutput,
  };
};

export const parseLLMOutput = (output) => {
  const avgRelevance = output.metrics.relevance;
  const avgCoherence = output.metrics.coherence;

  return {
    ...output,
    relevance: avgRelevance,
    coherence: avgCoherence,
    correct: output.metrics.correctness >= 8,
  };
};

export const parseEvaluatorsOutput = (evaluations) => {
  // Only consider non-informative evaluators for correctness
  const nonInformative = evaluations.filter(e => !e.isInformative);
  const accuracy = nonInformative.length > 0 ? nonInformative.every((evaluation) => evaluation.score >= 8) : true;
  
  const output = {
    evaluations,
    correct: accuracy,
  };

  for (const evaluation of evaluations) {
    output[evaluation.evaluator] = evaluation.score;
  }

  return output;
};

const evaluate = async (entry, prompts = [], isN8N = false) => {
  const attachment = await parseAttachments(entry.input);
  const parsedOutput = parseOutputContent(entry.output);
  const context = parseContext(entry.input);
  const observation = entry?.input?.previousSteps?.map((step) => step.observation).join('\n\n');

  const imageAttachments = attachment
    .filter(
      (att) =>
        att.includes('https://') ||
        att.includes('http://') ||
        att.includes('www.') ||
        att.includes('base64')
    )
    .map((att) => ({
      type: 'image_url',
      image_url: {
        url: `${att}`,
      },
    }));

  const userContent =
    imageAttachments.length > 0
      ? [
          {
            type: 'text',
            text: parseInputContent(entry.input)
              .replaceAll('image_url', '')
              .replaceAll('gpt-4o', '')
              .replaceAll('gpt-4o-mini', ''),
          },
          ...imageAttachments,
        ]
      : parseInputContent(entry.input)
          .replaceAll('image_url', '')
          .replaceAll('gpt-4o', '')
          .replaceAll('gpt-4o-mini', '');


  const evaluatorPrompts = prompts;
  const evaluations = [];

  if (evaluatorPrompts && evaluatorPrompts.length > 0) {
    for (let i = 0; i < evaluatorPrompts.length; i++) {
      if (!parsedOutput || parsedOutput === null || parsedOutput === undefined || parsedOutput === '') continue;
      const evaluator = evaluatorPrompts[i];
      const evaluatorPrompt = evaluator.evaluationPrompt.dataValues;
      
      // Check if this is a function-based evaluator
      if (evaluatorPrompt.type === 'function') {
        try {
          // Create an async function from the function body
          const evaluatorFunction = new Function('entry', 'parseInputContent', 'parseContext', 'parseOutputContent', 'parseAttachments', 'parsedOutput', 'context', 'observation', 'userContent', `
            return (async () => {
              ${evaluatorPrompt.functionBody}
            })();
          `);
          
          // Execute the async function with the same parameters as prompt evaluators
          const result = await evaluatorFunction(entry, parseInputContent, parseContext, parseOutputContent, parseAttachments, parsedOutput, context, observation, userContent);
          
          // Validate the result structure
          if (!result || typeof result !== 'object') {
            throw new Error('Function evaluator must return an object');
          }
          
          if (typeof result.score !== 'number' || result.score < 0 || result.score > 10) {
            throw new Error('Function evaluator must return a score between 0 and 10');
          }
          
          if (!result.analysis || typeof result.analysis !== 'string') {
            throw new Error('Function evaluator must return an analysis string');
          }
          
          if (!Array.isArray(result.errors)) {
            throw new Error('Function evaluator must return an errors array');
          }
          
          evaluations.push({
            score: result.score,
            analysis: result.analysis,
            errors: result.errors,
            evaluator: evaluatorPrompt.name,
            evaluatorId: evaluatorPrompt.id,
            isInformative: evaluatorPrompt.isInformative || false,
          });
          
          continue; // Skip the prompt-based evaluation logic
        } catch (error) {
          console.error(`Error executing function evaluator ${evaluatorPrompt.name}:`, error);
          // Fall back to a default evaluation if function fails
          evaluations.push({
            score: 0,
            analysis: `Function evaluator failed: ${error.message}`,
            errors: [`Function execution error: ${error.message}`],
            evaluator: evaluatorPrompt.name,
            evaluatorId: evaluatorPrompt.id,
            isInformative: evaluatorPrompt.isInformative || false,
          });
          continue;
        }
      }
      
      // Original prompt-based evaluation logic
      const message = [
        {
          role: 'system',
          content: evaluatorPrompt.prompt
          + `### **Return a structured JSON response** in the following format:
          Return a structured JSON response with your assessment.
          
                {
                  "score": (score from 0-10),
                  "analysis": "Concise summary of the evaluation focusing strictly on accuracy.",
                  "errors": ["List of errors"]
                }`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'User Input:',
            },
            ...(Array.isArray(userContent)
              ? userContent
              : [
                  {
                    type: 'text',
                    text: userContent,
                  },
                ]),
            { type: 'text', text: `System Prompt: ${context}` },
            // add observation only if it is not empty
            observation && { type: 'text', text: `Observation over the RAG db: ${observation}` },
            {
              type: 'text',
              text: `Extracted Output: ${parsedOutput}`,
            },
            {
              type: 'text',
              text: `Evaluate the user input and the extracted output and return a structured JSON response in the following format:
              {
                "score": (score from 0-10),
                "analysis": "Concise summary of the evaluation focusing strictly on accuracy.",
                "errors": ["List of errors"]
              }`,
            },
          ].filter((item) => item !== null && item !== undefined && item !== ''),
        },
      ];
      let defaultModel = evaluator.evaluationPrompt?.defaultProviderModel;
      const provider = evaluator.evaluationPrompt?.defaultIntegrationToken?.provider?.name;
      if (!defaultModel) {
        if (provider === 'OpenAI') {
          defaultModel = 'gpt-4o';
        } else if (provider === 'TogetherAI') {
          defaultModel = 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8';
        } else if (provider === 'GoogleAI') {
          defaultModel = 'gemini-2.0-flash';
        } else if (provider === 'AWSBedrock') {
          defaultModel = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
        }
      }

      const completion = await generateAIResponse({
        messages: message,
        numberOfAttachments: imageAttachments.length,
        responseFormat: z.object({
          score: z.number(),
          analysis: z.string(),
          errors: z.array(z.string()),
        }),
        isN8N: isN8N,
        token: evaluator.evaluationPrompt?.defaultIntegrationToken?.token,
        tokenData: evaluator.evaluationPrompt?.defaultIntegrationToken?.data,
        provider: evaluator.evaluationPrompt?.defaultIntegrationToken?.provider?.name,
        model: defaultModel,
      });


      evaluations.push({
        ...JSON.parse(completion.choices[0].message.content),
        evaluator: evaluator.evaluationPrompt.name,
        evaluatorId: evaluator.evaluationPrompt.id,
        isInformative: evaluatorPrompt.isInformative || false,
      });
    }

    return evaluations;
  }
  return [];
};

/**
 * Creates a temporary JSONL file with batch requests and uploads it to OpenAI
 * @param {Array} batchRequests - Array of batch request objects
 * @returns {String} - The ID of the uploaded file
 */
const createAndUploadBatchFile = async (batchRequests) => {
  // Create temp file path
  const tempFilePath = path.join(os.tmpdir(), `batch_${Date.now()}.jsonl`);

  // Write each batch request as a JSON line
  const fileStream = fs.createWriteStream(tempFilePath);
  for (const request of batchRequests) {
    fileStream.write(JSON.stringify(request) + '\n');
  }
  await new Promise((resolve) => fileStream.end(resolve));

  // Upload file to OpenAI
  const file = await openAi.files.create({
    file: fs.createReadStream(tempFilePath),
    purpose: 'batch',
  });

  // Delete temp file
  fs.unlinkSync(tempFilePath);

  return file.id;
};

export const batchEvaluate = async (entries, evaluator, ModelLog) => {
  const slug = evaluator.slug;
  const outputStyle = evaluator.parameters.outputStyle;
  const isLLMEvaluation = evaluator.parameters?.problemType === 'text_generation';
  const evaluatorPrompts = evaluationObject[evaluator.parameters.problemType];
  
  // Prepare batch requests
  const batchRequests = [];
  
  for (const entry of entries) {
    const context = parseContext(entry.input);
    const attachment = await parseAttachments(entry.input);
    const parsedOutput = parseOutputContent(entry.output);
    const imageAttachments = attachment
      .filter(
        (att) =>
          att.includes('https://') ||
          att.includes('http://') ||
          att.includes('www.') ||
          att.includes('base64')
      )
      .map((att) => ({
        type: 'image_url',
        image_url: {
          url: `${att}`,
        },
      }));
    
    if (imageAttachments.length === 0) {
      return await singleEvaluate(entry, evaluator);
    }

    const userContent =
      imageAttachments.length > 0
        ? [
            {
              type: 'text',
              text: parseInputContent(entry.input)
                .replaceAll('image_url', '')
                .replaceAll('gpt-4o', '')
                .replaceAll('gpt-4o-mini', ''),
            },
            ...imageAttachments,
          ]
        : parseInputContent(entry.input)
            .replaceAll('image_url', '')
            .replaceAll('gpt-4o', '')
            .replaceAll('gpt-4o-mini', '');

    let messages;
    
    if (evaluatorPrompts) {
      // Handle evaluator prompts case
      const evaluators = evaluatorPrompts.evaluators;
      for (let i = 0; i < evaluators.length; i++) {
        const evaluatorPrompt = evaluators[i];

        messages = [
          {
            role: 'system',
            content:
              evaluatorPrompt.system +
              `\n\n ${
                evaluatorPrompt.problemType === 'demo'
                  ? 'You expert in Business Email generation, the email must be professional and well written and structured, the email must be in spanish, the email must not contain missing data, which means if someting is missing then it should not show placeholders, it should just avoid that, also it must not make up data.'
                  : context
              }`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'User Input:',
              },
              ...(Array.isArray(userContent)
                ? userContent
                : [
                    {
                      type: 'text',
                      text: userContent,
                    },
                  ]),
              {
                type: 'text',
                text: `Extracted Output: ${parsedOutput}`,
              },
              {
                type: 'text',
                text: evaluatorPrompt.user,
              },
            ],
          },
        ];
        
        batchRequests.push({
          entry,
          messages,
          evaluatorKey: evaluatorPrompt.key,
          format: evaluatorPrompt.format,
          isEvaluator: true,
        });
      }
    } else {
      // Handle standard evaluation case
      messages = [
        {
          role: 'system',
          content: isLLMEvaluation
            ? LLMEvaluationSystemPrompt
            : classificationEvaluationSystemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `System Prompt: ${context}`,
            },
            {
              type: 'text',
              text: 'User Input:',
            },
            ...(Array.isArray(userContent)
              ? userContent
              : [
                  {
                    type: 'text',
                    text: userContent,
                  },
                ]),
            {
              type: 'text',
              text: `Generated Output: ${parsedOutput}`,
            },
            {
              type: 'text',
              text: isLLMEvaluation
                ? LLMEvaluationUserPrompt
                : classificationEvaluationUserPrompt,
            },
          ],
        },
      ];
      
      batchRequests.push({
        entry,
        messages,
        format: outputStyle === 'LLM' ? LLMEvaluation : ClassificationEvaluation,
        isEvaluator: false,
      });
    }
  }
  
  // Create batch requests for OpenAI
  const openaiBatchRequests = batchRequests.map((req, index) => ({
    custom_id: req.evaluatorKey || `req_${index}`,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model: 'gpt-4o-2024-08-06',
      messages: req.messages,
      response_format: zodResponseFormat(req.format, 'evaluation'),
    },
  }));
  
  // Create and upload the batch file
  const fileId = await createAndUploadBatchFile(openaiBatchRequests);
  
  // Create the batch using the uploaded file
  const batchResponse = await openAi.batches.create({
    input_file_id: fileId,
    endpoint: '/v1/chat/completions',
    completion_window: '24h'
  });
  
  const batchId = batchResponse.id;
  
  // Update all entries with batch ID and set status to processing
  for (const entry of entries) {
    await ModelLog.update(
      {
        batchId,
        evaluationStatus: 'processing',
      },
      {
        where: { id: entry.id }
      }
    );
  }
  
  // Track the batch creation
  await executeTrack(
    evaluator,
    {
      modelId: slug,
      input: {
        batchId,
        entriesCount: entries.length,
      },
      output: {
        status: 'submitted',
      },
    },
    ModelLog
  );
  
  return batchId;
};

/**
 * Processes the results of a batch evaluation
 * @param {String} batchId - The ID of the batch to process
 * @param {Object} ModelLog - The ModelLog model
 * @returns {Object} - Summary of processed results
 */
export const processBatchResults = async (batchId, ModelLog) => {
  // Get all entries with this batch ID
  const entries = await ModelLog.findAll({
    where: {
      batchId,
      evaluationStatus: 'processing',
    },
  });
  
  if (entries.length === 0) {
    return { processed: 0, success: 0, failed: 0 };
  }
  
  // Get the batch results from OpenAI
  const batchResults = await openAi.batches.retrieve(batchId);
  
  if (batchResults.status !== 'completed') {
    return { processed: 0, success: 0, failed: 0, status: batchResults.status };
  }
  
  // Download the results file
  const resultsFile = await openAi.files.retrieve(batchResults.output_file_id);
  const resultsContent = await openAi.files.content(resultsFile.id);
  const fileContents = await resultsContent.text();
  // Parse the results content
  let evaluationsRaw = [];
  const lines = fileContents.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      evaluationsRaw.push(JSON.parse(line));
    }
  }

  
  // Process each result
  let successCount = 0;
  let failedCount = 0;
  let evaluations = [];
  for (const evaluation of evaluationsRaw) {
    const responseContent = JSON.parse(evaluation.response.body.choices[0].message.content);
    const evaluatorKey = evaluation.custom_id;
    evaluations.push({
      ...responseContent,
      evaluator: evaluatorKey,
    });
  };

  evaluations = {
    evaluations,
    type: 'evaluators'
  }

    const entry = entries[0];
    
    if (!entry) {
      console.error(`No entry found for request ID`);
    }    
    try {
      // Get the evaluator for this entry
      const model = await entry.getModel();
      const evaluator = await model.getEvaluator();
      const evaluatorPrompts = evaluationObject[evaluator.parameters.problemType];
      const hasAccuracy = evaluations.evaluations.some(
        (evaluation) => evaluation.evaluator === 'accuracy'
      );
      if (!hasAccuracy && evaluatorPrompts.accuracyEvaluation) {
        const accuracy = evaluatorPrompts.accuracyEvaluation(evaluations.evaluations);
        evaluations.evaluations.push({ ...accuracy, evaluator: 'accuracy' });
      }
      let parsedOutput;

      if (evaluator.parameters.problemType === 'classification') {
        parsedOutput = parseClassificationOutput(evaluations);
      } else {
        parsedOutput = parseEvaluatorsOutput(evaluations.evaluations);
      }

      // Generate summary
      const summary = await summaryEvaluation(
        {
          actual: parsedOutput,
        },
        evaluatorPrompts
      );
      
      const parsedOutputWithSummary = {
        ...parsedOutput,
        summary,
      };
      
      // Update the entry
      await entry.update({
        actual: parsedOutputWithSummary,
        autoEvaluationProcessed: true,
        processed: true,
        status: isCorrect({ actual: parsedOutput }) ? 'success' : 'error',
        evaluationStatus: 'completed',
      });
      
      successCount++;
    } catch (error) {
      console.error(`Error processing batch result for entry ${entry.id}:`, error);
      
      // Update the entry with error status
      await entry.update({
        evaluationStatus: 'failed',
      });
      
      failedCount++;
    }
  
  return {
    processed: entries.length,
    success: successCount,
    failed: failedCount,
    status: 'completed',
  };
};

/**
 * Checks the status of a batch and processes it if complete
 * @param {String} batchId - The ID of the batch to check
 * @param {Object} ModelLog - The ModelLog model
 * @returns {Object} - Status information about the batch
 */
export const checkBatchStatus = async (batchId, ModelLog) => {
  // Get the batch status from OpenAI
  const batchStatus = await openAi.batches.retrieve(batchId);
  
  // If the batch is complete, process the results
  if (batchStatus.status === 'completed') {
    return await processBatchResults(batchId, ModelLog);
  }
  
  // Return the current status
  return {
    status: batchStatus.status,
    processed: batchStatus.processed || 0,
    success: batchStatus.successful || 0,
    failed: batchStatus.failed || 0,
  };
};

/**
 * Checks the status of all pending batches
 * @param {Object} ModelLog - The ModelLog model
 * @returns {Object} - Summary of all batches processed
 */
export const checkAllPendingBatches = async (ModelLog) => {
  // Find all entries with processing status
  const processingEntries = await ModelLog.findAll({
    where: {
      evaluationStatus: 'processing',
      batchId: {
        [Op.not]: null,
      },
      createdAt: {
        [Op.gt]: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2 days ago
      }
    },
    attributes: ['batchId'],
    group: ['batch_id', 'created_at'],
    limit: 50,
    order: [['createdAt', 'DESC']]
  });

  
  if (processingEntries.length === 0) {
    return {
      totalBatches: 0,
      completedBatches: 0,
      pendingBatches: 0,
      totalEntries: 0,
      processedEntries: 0,
    };
  }
  
  // Check each batch
  const batchIds = processingEntries.map(entry => entry.batchId);
  const results = []

  for (const batchId of batchIds) {
    const result = await checkBatchStatus(batchId, ModelLog);
    results.push(result);
  }
  
  
  // Count completed and pending batches
  const completedBatches = results.filter(result => result.status === 'completed').length;
  const pendingBatches = results.filter(result => result.status !== 'completed').length;
  
  // Count total entries processed
  const totalEntries = results.reduce((sum, result) => sum + result.processed, 0);
  const processedEntries = results.reduce((sum, result) => sum + result.success + result.failed, 0);
  
  return {
    totalBatches: batchIds.length,
    completedBatches,
    pendingBatches,
    totalEntries,
    processedEntries,
  };
};

/**
 * Evaluates a random sample of entries using the batch API
 * @param {Array} entries - Array of entries to evaluate
 * @param {Number} entriesCount - Total number of entries
 * @param {Number} evaluationPercentage - Percentage of entries to evaluate
 * @param {Object} evaluator - The evaluator model
 * @param {Object} ModelLog - The ModelLog model
 * @param {Number} limit - Maximum number of entries to evaluate
 * @returns {String} - The batch ID for tracking
 */
export const batchEvaluateSamples = async (
  entries,
  entriesCount,
  evaluationPercentage,
  evaluator,
  ModelLog,
  limit = 5
) => {
  // Select a random sample of entries
  const sample = randomSample(
    entries,
    Math.min(Math.floor((entriesCount * evaluationPercentage) / 100.0), limit)
  );
  
  if (sample.length === 0) {
    return null;
  }
  
  // Use batch evaluation
  const batchId = await batchEvaluate(sample, evaluator, ModelLog);
  
  
  return batchId;
};
