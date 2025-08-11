import GitHubClient from './githubClient.js';
import { generateAIResponse } from './aiService.js';
import path from 'path';
import { mkdtemp, rm, readFile as fsReadFile, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

/**
 * Repo AI Assessment Service (Phase 1 — Heuristic Search MVP)
 *
 * Given a GitHub repo URL and companyId, detects LLM provider/framework usage
 * and locates likely prompts by using the GitHub search API and a minimal
 * fallback recursive scan. Returns an in-memory result set of candidates with
 * basic scoring and metadata. No DB persistence or routes here (Phase 2).
 *
 * Expected usage:
 * const result = await assessRepositoryAI({ repoUrl, companyId, models });
 */

/**
 * Main entry: assess a repository and return detected AI usage and prompt candidates
 * @param {Object} params
 * @param {string} params.repoUrl - GitHub repository URL (or owner/repo)
 * @param {number|string} params.companyId - Company ID to fetch GitHub installation token
 * @param {Object} params.models - Sequelize models (must include Company and GitHubIntegration)
 * @param {string|null} [params.branch] - Optional branch to prefer for context (best-effort)
 * @returns {Promise<Object>} assessment result
 */
export const assessRepositoryAI = async ({
  repoUrl,
  companyId,
  models,
  branch = null,
  preferLocalClone = false,
  hintFilePath = null,
  hintFunctionName = null,
  executionTree = null,
  useHintsFlow = true,
}) => {
  if (!repoUrl) {
    return { success: false, error: 'repoUrl is required' };
  }
  if (!companyId) {
    return { success: false, error: 'companyId is required' };
  }
  if (!models) {
    return { success: false, error: 'models is required' };
  }

  try {
    const repoInfo = parseRepositoryUrl(repoUrl);
    if (!repoInfo) {
      return { success: false, error: 'Invalid repository URL format' };
    }

    // Acquire GitHub App installation token via existing integration
    const company = await models.Company.findByPk(companyId);
    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    console.log('🔍 Company:', company);

    const githubIntegration = await models.GitHubIntegration.findOne({
      where: { companyId },
    });
    console.log('🔍 GitHub Integration:', githubIntegration);
    if (!githubIntegration || !githubIntegration.isConfigured()) {
      return {
        success: false,
        error: 'GitHub integration is not configured for this company',
      };
    }

    const token = await githubIntegration.getInstallationAccessToken();
    if (!token) {
      return {
        success: false,
        error: 'Unable to obtain GitHub installation token',
      };
    }

    const githubClient = new GitHubClient(token);

    // If hints were provided, run the specialized hints-driven flow
    const hasHints = Boolean(
      (hintFilePath && typeof hintFilePath === 'string') ||
        (hintFunctionName && typeof hintFunctionName === 'string') ||
        (executionTree && typeof executionTree === 'object')
    );
    if (useHintsFlow && hasHints) {
      try {
        const hinted = await assessRepositoryWithHintsFlow({
          repoInfo,
          branch,
          token,
          githubClient,
          hintFilePath,
          hintFunctionName,
          executionTree,
        });
        return hinted;
      } catch (e) {
        // Fall through to default heuristic scan if hints flow fails
        // but keep a breadcrumb in meta for debugging
        console.log(
          '⚠️  Hints flow failed, falling back to heuristic scan:',
          e.message
        );
      }
    }

    // Prepare search queries (high-signal, compact)
    const queries = buildHighSignalQueries();
    const fallbackQueries = buildFallbackQueries();

    const usedStrategies = [];
    const fileMap = new Map(); // key: filePath, value: { path, content, sha, indicators: Set<string>, providers: Set<string>, frameworks: Set<string> }
    const providersDetected = new Set();
    const frameworksDetected = new Set();

    let usedLocalClone = false;

    if (!preferLocalClone) {
      // Search API pass
      for (const q of queries) {
        try {
          usedStrategies.push(`search:${q.name}`);
          const results = await githubClient.searchCode(
            repoInfo.owner,
            repoInfo.repo,
            q.query
          );
          for (const item of results.items || []) {
            try {
              const file = await githubClient.getContent(
                repoInfo.owner,
                repoInfo.repo,
                item.path,
                branch || undefined
              );
              if (!file || !file.content) continue;
              const content = Buffer.from(file.content, 'base64').toString(
                'utf-8'
              );
              if (
                !content ||
                !content.includes(
                  q.matchHint || q.queryFragment || extractProbe(q.query)
                )
              )
                continue;

              const record = ensureFileRecord(
                fileMap,
                item.path,
                content,
                file.sha
              );
              if (q.provider) {
                record.providers.add(q.provider);
                providersDetected.add(q.provider);
              }
              if (q.framework) {
                record.frameworks.add(q.framework);
                frameworksDetected.add(q.framework);
              }
              record.indicators.add(q.name);
            } catch {
              // ignore file fetch errors for robustness
            }
          }
        } catch {
          // ignore query errors; continue others
        }
      }
    }

    // If nothing found via search API, attempt a minimal fallback scan
    if (!preferLocalClone && fileMap.size === 0) {
      for (const fq of fallbackQueries) {
        try {
          usedStrategies.push(`fallback:${fq.name}`);
          const fbResults = await githubClient.searchInRepositoryFiles(
            repoInfo.owner,
            repoInfo.repo,
            fq.query
          );
          for (const r of fbResults) {
            const record = ensureFileRecord(fileMap, r.path, r.content, r.sha);
            record.indicators.add(fq.name);
          }
        } catch {
          // ignore and proceed
        }
      }
    }

    // If still empty or local clone preferred, try local clone scan
    if (fileMap.size === 0 || preferLocalClone) {
      try {
        const defaultBranch = await getDefaultBranchName(
          githubClient,
          repoInfo.owner,
          repoInfo.repo
        );
        const branchToUse = branch || defaultBranch;
        const localPath = await cloneRepoShallow({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          token,
          branch: branchToUse,
        });
        usedLocalClone = true;
        usedStrategies.push(`local-clone:${branchToUse}`);

        const localResults = await scanLocalRepository(localPath, {
          queries,
          fallbackQueries,
        });
        for (const result of localResults) {
          const record = ensureFileRecord(
            fileMap,
            result.path,
            result.content,
            null
          );
          for (const ind of result.indicators) record.indicators.add(ind);
          if (result.provider) record.providers.add(result.provider);
          if (result.framework) record.frameworks.add(result.framework);
          if (result.provider) providersDetected.add(result.provider);
          if (result.framework) frameworksDetected.add(result.framework);
        }

        // Cleanup
        await rm(localPath, { recursive: true, force: true });
      } catch {
        // If local clone fails, continue with whatever we have
      }
    }

    // Build candidates
    const candidates = [];
    for (const [path, rec] of fileMap.entries()) {
      const indicators = Array.from(rec.indicators);
      const provider = Array.from(rec.providers)[0] || null;
      const framework = Array.from(rec.frameworks)[0] || null;
      const snippet = buildSnippet(rec.content, indicators);
      const score = scoreCandidate({
        content: rec.content,
        indicators,
        provider,
        framework,
      });

      candidates.push({
        filePath: path,
        provider,
        framework,
        indicators,
        snippet,
        score,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    return {
      success: true,
      repo: {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: branch || null,
      },
      providersDetected: Array.from(providersDetected),
      frameworksDetected: Array.from(frameworksDetected),
      candidates,
      meta: {
        strategiesUsed: usedStrategies,
        queriesTried: queries.map((q) => q.name),
        fallbackTried:
          !usedLocalClone && fileMap.size === 0
            ? fallbackQueries.map((q) => q.name)
            : [],
        usedLocalClone,
      },
    };
  } catch (error) {
    return { success: false, error: error.message, stack: error.stack };
  }
};

// ————— Helpers —————

const parseRepositoryUrl = (repositoryUrl) => {
  try {
    const patterns = [
      /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
      /^([^/]+)\/([^/]+)$/,
    ];
    for (const pattern of patterns) {
      const match = repositoryUrl.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2].replace('.git', '') };
      }
    }
    return null;
  } catch {
    return null;
  }
};

const ensureFileRecord = (map, path, content, sha) => {
  if (!map.has(path)) {
    map.set(path, {
      path,
      content,
      sha,
      indicators: new Set(),
      providers: new Set(),
      frameworks: new Set(),
    });
  }
  return map.get(path);
};

const buildSnippet = (content, indicators) => {
  if (!content) return '';
  const lines = content.split('\n');
  let matchIdx = -1;
  for (const ind of indicators) {
    matchIdx = lines.findIndex((l) =>
      l.toLowerCase().includes(ind.toLowerCase())
    );
    if (matchIdx !== -1) break;
  }
  if (matchIdx === -1) {
    // fallback: look for common prompt phrases
    matchIdx = lines.findIndex((l) =>
      /you are|your task is|messages\s*:\s*\[/i.test(l)
    );
  }
  const start = Math.max(0, matchIdx - 5);
  const end = Math.min(lines.length, matchIdx + 5);
  return lines.slice(start, end).join('\n');
};

const scoreCandidate = ({ content, indicators, provider, framework }) => {
  let score = 0;
  // weights
  const weightIndicator = 1.0;
  const weightProvider = 2.0;
  const weightFramework = 1.5;
  const weightPromptPhrases = 1.25;

  score += indicators.length * weightIndicator;
  if (provider) score += weightProvider;
  if (framework) score += weightFramework;
  if (
    /\byou are\b|\byour task is\b|messages\s*:\s*\[|role\s*:\s*['"]system['"]/i.test(
      content || ''
    )
  ) {
    score += weightPromptPhrases;
  }
  return Number(score.toFixed(2));
};

const buildHighSignalQueries = () => {
  // Each query is intentionally short and provider/framework focused to avoid 422 errors
  return [
    // Providers
    {
      name: 'openai_import',
      query: "import OpenAI from 'openai'",
      provider: 'openai',
    },
    {
      name: 'openai_chat_create',
      query: 'chat.completions.create(',
      provider: 'openai',
      matchHint: 'chat.completions.create(',
    },
    // Python OpenAI
    {
      name: 'py_openai_import',
      query: 'import openai',
      provider: 'openai',
      matchHint: 'import openai',
    },
    {
      name: 'py_openai_chat_create',
      query: 'openai.ChatCompletion.create(',
      provider: 'openai',
      matchHint: 'ChatCompletion.create(',
    },
    {
      name: 'py_openai_client_chat',
      query: 'client.chat.completions.create(',
      provider: 'openai',
      matchHint: 'chat.completions.create(',
    },
    {
      name: 'anthropic_import',
      query: '@anthropic-ai/sdk',
      provider: 'anthropic',
    },
    {
      name: 'anthropic_messages',
      query: 'messages.create(',
      provider: 'anthropic',
      matchHint: 'messages.create(',
    },
    // Python Anthropic
    {
      name: 'py_anthropic_import',
      query: 'import anthropic',
      provider: 'anthropic',
      matchHint: 'import anthropic',
    },
    {
      name: 'py_anthropic_from',
      query: 'from anthropic import',
      provider: 'anthropic',
      matchHint: 'from anthropic import',
    },
    {
      name: 'py_anthropic_messages',
      query: 'client.messages.create(',
      provider: 'anthropic',
      matchHint: 'messages.create(',
    },
    {
      name: 'google_gemini_import',
      query: '@google/generative-ai',
      provider: 'google',
    },
    // Python Google Gemini / Vertex
    {
      name: 'py_google_gemini_import',
      query: 'import google.generativeai as',
      provider: 'google',
      matchHint: 'google.generativeai',
    },
    {
      name: 'py_vertex_generative_model',
      query: 'from vertexai.generative_models import',
      provider: 'google',
      matchHint: 'vertexai',
    },
    { name: 'azure_openai', query: '@azure/openai', provider: 'azure-openai' },
    // Python Azure OpenAI
    {
      name: 'py_azure_openai_import',
      query: 'from azure.ai.openai import',
      provider: 'azure-openai',
      matchHint: 'azure.ai.openai',
    },
    {
      name: 'py_azure_openai_client',
      query: 'OpenAIClient(',
      provider: 'azure-openai',
      matchHint: 'OpenAIClient(',
    },
    {
      name: 'aws_bedrock',
      query: '@aws-sdk/client-bedrock-runtime',
      provider: 'bedrock',
    },
    // Python Bedrock
    {
      name: 'py_bedrock_boto3',
      query: "client('bedrock-runtime')",
      provider: 'bedrock',
      matchHint: 'bedrock-runtime',
    },
    {
      name: 'py_boto3_import',
      query: 'import boto3',
      provider: 'bedrock',
      matchHint: 'boto3',
    },
    { name: 'cohere', query: 'from "cohere"', provider: 'cohere' },
    // Python Cohere
    {
      name: 'py_cohere_import',
      query: 'import cohere',
      provider: 'cohere',
      matchHint: 'import cohere',
    },
    {
      name: 'py_cohere_client',
      query: 'cohere.Client(',
      provider: 'cohere',
      matchHint: 'cohere.Client(',
    },
    { name: 'groq', query: 'from "groq-sdk"', provider: 'groq' },
    // Python Groq
    {
      name: 'py_groq_import',
      query: 'from groq import Groq',
      provider: 'groq',
      matchHint: 'from groq import Groq',
    },
    {
      name: 'mistral',
      query: 'from "@mistralai/mistralai"',
      provider: 'mistral',
    },
    // Python Mistral
    {
      name: 'py_mistral_import',
      query: 'from mistralai',
      provider: 'mistral',
      matchHint: 'from mistralai',
    },
    {
      name: 'py_mistral_client',
      query: 'MistralClient(',
      provider: 'mistral',
      matchHint: 'MistralClient(',
    },
    { name: 'ollama', query: 'from "ollama"', provider: 'ollama' },
    // Python Ollama
    {
      name: 'py_ollama_import',
      query: 'import ollama',
      provider: 'ollama',
      matchHint: 'import ollama',
    },

    // Frameworks
    {
      name: 'langchain_import',
      query: 'from "langchain"',
      framework: 'langchain',
    },
    {
      name: 'langchain_prompttemplate',
      query: 'PromptTemplate',
      framework: 'langchain',
    },
    // Python LangChain
    {
      name: 'py_langchain_import',
      query: 'from langchain',
      framework: 'langchain',
      matchHint: 'from langchain',
    },
    {
      name: 'py_langchain_prompts',
      query: 'from langchain.prompts import',
      framework: 'langchain',
      matchHint: 'langchain.prompts',
    },
    {
      name: 'py_langchain_chatprompt',
      query: 'ChatPromptTemplate',
      framework: 'langchain',
      matchHint: 'ChatPromptTemplate',
    },
    { name: 'vercel_ai_sdk', query: " from 'ai' ", framework: 'ai-sdk' },
    {
      name: 'vercel_generate_text',
      query: 'generateText(',
      framework: 'ai-sdk',
      matchHint: 'generateText(',
    },
    {
      name: 'llamaindex_import',
      query: 'from "llamaindex"',
      framework: 'llamaindex',
    },
    // Python LlamaIndex
    {
      name: 'py_llamaindex_import',
      query: 'from llama_index import',
      framework: 'llamaindex',
      matchHint: 'from llama_index',
    },
    {
      name: 'py_llamaindex_prompttemplate',
      query: 'PromptTemplate',
      framework: 'llamaindex',
      matchHint: 'PromptTemplate',
    },

    // Prompt shapes
    { name: 'messages_array', query: 'messages: [', matchHint: 'messages' },
    { name: 'role_system_single', query: "role: 'system'", matchHint: 'role' },
    { name: 'role_system_double', query: 'role: "system"', matchHint: 'role' },
    {
      name: 'systemPrompt_var',
      query: 'systemPrompt',
      matchHint: 'systemPrompt',
    },
    {
      name: 'promptTemplate_var',
      query: 'promptTemplate',
      matchHint: 'promptTemplate',
    },
    { name: 'basePrompt_var', query: 'basePrompt', matchHint: 'basePrompt' },
    // Python prompt shapes
    { name: 'py_messages_list', query: 'messages = [', matchHint: 'messages' },
    {
      name: 'py_role_system_single',
      query: "'role': 'system'",
      matchHint: 'role',
    },
    {
      name: 'py_role_system_double',
      query: '"role": "system"',
      matchHint: 'role',
    },
    {
      name: 'py_system_prompt_var',
      query: 'system_prompt',
      matchHint: 'system_prompt',
    },
    {
      name: 'py_prompt_template_var',
      query: 'prompt_template',
      matchHint: 'prompt_template',
    },
    {
      name: 'py_base_prompt_var',
      query: 'base_prompt',
      matchHint: 'base_prompt',
    },
  ];
};

const buildFallbackQueries = () => {
  return [
    { name: 'fallback_messages', query: 'messages: [' },
    { name: 'fallback_role_system', query: 'role: "system"' },
    { name: 'fallback_role_system_single', query: "role: 'system'" },
    { name: 'fallback_you_are', query: 'You are' },
    { name: 'fallback_prompt_template', query: 'PromptTemplate' },
    // Python fallbacks
    { name: 'fallback_py_messages', query: 'messages = [' },
    { name: 'fallback_py_role_system_single', query: "'role': 'system'" },
    { name: 'fallback_py_role_system_double', query: '"role": "system"' },
  ];
};

const extractProbe = (searchQuery) => {
  // Try to use a simple token from the search query as an inclusion check in file content
  const tokens = (searchQuery || '').replace(/\s+/g, ' ').trim().split(' ');
  return tokens.find((t) => /[a-zA-Z]/.test(t)) || searchQuery;
};

export default {
  assessRepositoryAI,
  generateComprehensiveAssessmentMarkdown,
  buildAssessmentFromFilesMarkdown,
  generatePromptBestPracticesAssessmentMarkdown,
};

// —— Local clone utilities ——

async function getDefaultBranchName(githubClient, owner, repo) {
  try {
    const info = await githubClient.getRepository(owner, repo);
    return info.default_branch || 'main';
  } catch {
    return 'main';
  }
}

async function cloneRepoShallow({ owner, repo, token, branch }) {
  const tmpBase = tmpdir();
  const dir = await mkdtemp(path.join(tmpBase, `handit-ai-scan-`));
  // Use GitHub App installation token for HTTPS clone
  // URL format: https://x-access-token:TOKEN@github.com/owner/repo.git
  const safeUrl = `https://x-access-token:${encodeURIComponent(
    token
  )}@github.com/${owner}/${repo}.git`;

  await runCmd(
    'git',
    ['clone', '--depth', '1', '--branch', branch, safeUrl, dir],
    { cwd: dir }
  );
  return dir;
}

async function runCmd(cmd, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function scanLocalRepository(baseDir, { queries, fallbackQueries }) {
  const files = await listFilesRecursive(baseDir, 0, 5);
  const results = [];
  for (const filePath of files) {
    if (!isSearchableFileLocal(filePath)) continue;
    try {
      const content = await fsReadFile(filePath, 'utf-8');
      const indicators = new Set();
      let provider = null;
      let framework = null;

      for (const q of queries) {
        const probe = q.matchHint || q.query;
        if (probe && content.includes(probe)) {
          indicators.add(q.name);
          if (q.provider && !provider) provider = q.provider;
          if (q.framework && !framework) framework = q.framework;
        }
      }
      if (indicators.size === 0) {
        for (const fq of fallbackQueries) {
          if (content.includes(fq.query)) indicators.add(fq.name);
        }
      }
      if (indicators.size > 0) {
        results.push({
          path: path.relative(baseDir, filePath),
          content,
          indicators: Array.from(indicators),
          provider,
          framework,
        });
      }
    } catch {
      // ignore read errors
    }
  }
  return results;
}

async function listFilesRecursive(dir, depth, maxDepth) {
  const collected = [];
  if (depth > maxDepth) return collected;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isSearchableDirectoryLocal(entry.name)) continue;
      const sub = await listFilesRecursive(full, depth + 1, maxDepth);
      collected.push(...sub);
    } else if (entry.isFile()) {
      collected.push(full);
    }
  }
  return collected;
}

function isSearchableDirectoryLocal(name) {
  const skip = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.next',
    '__pycache__',
    'vendor',
  ]);
  return !skip.has(name.toLowerCase());
}

function isSearchableFileLocal(filename) {
  const searchableExtensions = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.py',
    '.java',
    '.go',
    '.php',
    '.rb',
    '.cs',
    '.cpp',
    '.c',
    '.h',
    '.json',
    '.yaml',
    '.yml',
    '.md',
    '.txt',
  ];
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return false;
  const extension = filename.toLowerCase().substring(idx);
  return searchableExtensions.includes(extension);
}

// —— Hints-driven flow ——

async function assessRepositoryWithHintsFlow({
  repoInfo,
  branch,
  token,
  githubClient,
  hintFilePath,
  hintFunctionName,
  executionTree,
}) {
  // 1) Determine branch and clone locally to obtain repository structure
  const defaultBranch = await getDefaultBranchName(
    githubClient,
    repoInfo.owner,
    repoInfo.repo
  );
  const branchToUse = branch || defaultBranch;
  const localPath = await cloneRepoShallow({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    token,
    branch: branchToUse,
  });
  let providersDetected = new Set();
  let frameworksDetected = new Set();

  try {
    const allFiles = await listFilesRecursive(localPath, 0, 6);
    const relativeFiles = allFiles
      .filter(isSearchableFileLocal)
      .map((p) => path.relative(localPath, p));

    // 2) Ask LLM to pick candidate files based on hints + repo structure
    const llmCandidates = await pickCandidatesFromHints({
      repoOwner: repoInfo.owner,
      repoName: repoInfo.repo,
      hintFilePath,
      hintFunctionName,
      executionTree,
      fileList: relativeFiles,
    });

    // Always include the hinted file if present
    const candidateSet = new Set([
      ...(llmCandidates || []),
      ...(hintFilePath ? [hintFilePath] : []),
      ...(executionTree ? executionTree.calls.map((e) => e.file) : []),
    ]);
    console.log('candidateSet', candidateSet);
    const candidates = Array.from(candidateSet).slice(0, 25);

    // 3) Read candidate file contents from local clone
    const candidateFilesWithContent = [];
    for (const rel of candidates) {
      try {
        const abs = path.join(localPath, rel);
        const content = await fsReadFile(abs, 'utf-8');
        candidateFilesWithContent.push({ path: rel, content });
      } catch {
        // skip unreadable
      }
    }

    // 4) Heuristically and (if needed) with LLM, detect up to 2 prompts
    let promptsSelected = [];
    for (const file of candidateFilesWithContent) {
      if (promptsSelected.length >= 2) break;
      const heuristics = extractPromptsFromContent(file.content);
      for (const p of heuristics) {
        if (promptsSelected.length >= 2) break;
        promptsSelected.push({ filePath: file.path, ...p });
      }
    }

    if (promptsSelected.length < 2) {
      const remainingFiles = candidateFilesWithContent.filter(
        (f) => !promptsSelected.some((p) => p.filePath === f.path)
      );
      const llmExtracted = await detectPromptsViaLLM({
        files: remainingFiles,
        maxPrompts: 2 - promptsSelected.length,
      });
      for (const p of llmExtracted) {
        if (promptsSelected.length >= 2) break;
        promptsSelected.push(p);
      }
    }

    // Basic provider/framework detection from candidate contents using existing query hints
    const queries = [...buildHighSignalQueries()];
    for (const f of candidateFilesWithContent) {
      for (const q of queries) {
        const probe = q.matchHint || q.query;
        if (probe && f.content.includes(probe)) {
          if (q.provider) providersDetected.add(q.provider);
          if (q.framework) frameworksDetected.add(q.framework);
        }
      }
    }

    // Build candidates list for parity with heuristic flow
    const scoredCandidates = candidateFilesWithContent.map((f) => ({
      filePath: f.path,
      provider: null,
      framework: null,
      indicators: [],
      snippet: (f.content || '').slice(0, 400),
      score: 1,
    }));

    return {
      success: true,
      repo: {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: branch || null,
      },
      providersDetected: Array.from(providersDetected),
      frameworksDetected: Array.from(frameworksDetected),
      candidates: scoredCandidates,
      selectedFiles: candidateFilesWithContent
        .filter((f) => promptsSelected.some((p) => p.filePath === f.path))
        .slice(0, 2),
      promptsSelected: promptsSelected.slice(0, 2),
      meta: {
        strategiesUsed: ['hints-flow'],
        hints: {
          hintFilePath,
          hintFunctionName,
          hasExecutionTree: Boolean(executionTree),
        },
        candidateCount: candidates.length,
      },
    };
  } finally {
    // Cleanup local clone
    try {
      await rm(localPath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function pickCandidatesFromHints({
  repoOwner,
  repoName,
  hintFilePath,
  hintFunctionName,
  executionTree,
  fileList,
}) {
  const limitedList = fileList.slice(0, 5000); // cap size
  const treePreview = limitedList.join('\n');
  const userContent = [
    `Repository: ${repoOwner}/${repoName}`,
    hintFilePath ? `Hint file path: ${hintFilePath}` : null,
    hintFunctionName ? `Hint function: ${hintFunctionName}` : null,
    executionTree
      ? `Execution tree JSON (may be partial):\n\n\`\`\`json\n${JSON.stringify(
          executionTree
        ).slice(0, 4000)}\n\`\`\``
      : null,
    '',
    'Repository file list (relative paths):',
    '```text',
    treePreview,
    '```',
    '',
    'Task: From the above hints and repository structure, list the most likely files containing prompts, constants, configs, or templates related to the hinted agent. Include the hinted file if relevant. Return STRICT JSON only:',
    '{ "candidates": ["path/one", "path/two", ...], "rationale": "short" }',
    'Limit to 20 candidates, ordered by likelihood.',
  ]
    .filter(Boolean)
    .join('\n');

  const systemContent = `
  You are a code analysis assistant at handit.ai. Your job is to **select repository files most likely to contain LLM prompts** (system/user templates), prompt-building code, constants/strings used as prompts, configuration that embeds prompts, or setup glue that assembles messages.

You will receive:
- Repository owner/name
- Optional hint file path and/or hint function name
- An execution tree (may be partial/incorrect)
- A flat repository **file list** (relative paths only)

## What to return
Return **STRICT JSON** with this exact shape and nothing else:
'''json
{ "candidates": ["path/one", "path/two", "..."], "rationale": "short" }
'''
Rules:
- **Only file paths that appear in the provided file list.** No directories, no guesses outside the list.
- **Order by likelihood** (most likely first).
- **Between 5 and 20 items.** If fewer than 5 are obvious, add best-guess candidates using the heuristics below.
- **No extra fields**, no code fences, no comments, no trailing commas.

## How to pick candidates (use all signals)
Prioritize files by summing the following signals; order by total score (break ties by shorter path and proximity to hints):

### A) Name/Path Heuristics (strong)
Boost files whose **name or folders** suggest prompts or LLM usage:
- Filenames including: 'prompt', 'system', 'template', 'message', 'instruction', 'fewshot', 'persona', 'role', 'conversation', 'chain', 'agent', 'tool', 'planner', 'router', 'formatter'.
- Framework-specific: 'langchain', 'llamaindex', 'semantic-kernel', 'autogen', 'haystack', 'dspy', 'guidance', 'vllm', 'litelm', 'openai', 'anthropic', 'bedrock', 'vertex', 'cohere', 'mistral', 'ollama'.
- Common dirs: 'prompts/', 'templates/', 'llm/', 'ai/', 'agent/', 'chains/', 'flows/', 'pipelines/', 'playbooks/', 'skills/', 'usecases/', 'config/', 'configs/', 'settings/', 'resources/', 'data/', 'instructions/'.
- Neighboring files in the **same directory** as the hint file, especially with names above.

### B) Extension Heuristics (moderate)
Prefer likely text/code containers:
- Code: '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rb', '.java'
- Data/templates: '.json', '.yml', '.yaml', '.md', '.txt', '.jinja', '.jinja2', '.j2', '.hbs', '.ejs', '.liquid', '.tpl'

### C) Execution-Tree Proximity (moderate)
- Files directly listed in the execution tree.
- Files exporting or importing the **hint function** or the **hint file** (by typical co-location or naming).
- Files in the **same module/feature** path segments as the hint (e.g., 'src/agents/order/…').

### D) Framework/Library Patterns (moderate)
Favor files likely to define or assemble prompts:
- LangChain: 'ChatPromptTemplate', 'SystemMessagePromptTemplate', 'load_prompt', 'Runnable*', 'LLMChain'.
- LlamaIndex: 'PromptTemplate', 'ServiceContext', 'Settings', 'PromptHelper'.
- Semantic Kernel: 'skills', 'plugins', 'prompts', '.skprompt.txt'.
- Guidance/DSPy/AutoGen: any '*.jinja', '*.md' templates, “assistant/system/user” role strings.
- Homegrown: functions like 'buildPrompt', 'getSystemPrompt', 'composeMessages', 'fewShot', 'instructions'.

### E) Config-Embedding (light)
Configs that often inline prompts:
- 'config/*', 'configs/*', 'settings/*', '*.config.*', '*.settings.*'
- '*.json'/'*.yaml' containing model, agent, or tool setup (by name/path hints).

### F) Proximity to Hint (light)
- If a **hint file path** is provided, include it **if plausibly relevant**.
- Add siblings with suggestive names (see A).

### G) Exclusions (unless path strongly indicates prompts)
Down-rank or skip:
- Build artifacts: 'dist/', 'build/', 'out/', '.next/', 'target/', 'coverage/', 'node_modules/', 'venv/', '.venv/', '.turbo/', '.pytest_cache/'.
- Tests/mocks/snapshots: '__tests__/', 'tests/', '__mocks__/', '__snapshots__/', '*.spec.*', '*.test.*', '*.snap'.
- Generated/openapi clients, migrations, assets, styles, binary blobs.

## Tie-breakers
1) Stronger name/path match wins.  
2) Closer to hint file/function wins.  
3) Shorter/simpler path wins.  
4) Prefer code + template pairs over generic configs.

## Minimum guarantee
If you find fewer than 5 strong matches, **pad** with best-guess candidates using A–F (but never include excluded directories or files not in the list).

## Output validation (hard rules)
- Exactly two keys: '"candidates"' (array of 5–20 strings) and '"rationale"' (short string).
- Paths must be unique and appear in the provided file list.
- No markdown, no prose outside JSON.
  `;

  const messages = [
    {
      role: 'system',
      content:
        'You are a code analysis assistant at handit.ai. Given hints and a repository tree, select candidate files likely to contain prompts for the agent. Respond with strict JSON only.',
    },
    { role: 'user', content: systemContent },
  ];

  const token = process.env.OPENAI_API_KEY;
  const completion = await generateAIResponse({
    messages,
    model: 'gpt-4o',
    provider: 'OpenAI',
    token,
    temperature: 0.2,
  });

  const text =
    completion.text || completion.choices?.[0]?.message?.content || '';
  console.log('pickCandidatesFromHints', text);
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    return arr.filter((x) => typeof x === 'string');
  } catch {
    // Fallback: simple heuristic from file names
    const heur = limitedList
      .filter((p) =>
        /prompt|prompts|system|instruction|template|config|constant|ai|llm/i.test(
          p
        )
      )
      .slice(0, 20);
    return heur;
  }
}

async function detectPromptsViaLLM({ files, maxPrompts = 2 }) {
  const results = [];
  const token = process.env.OPENAI_API_KEY;
  for (const file of files) {
    if (results.length >= maxPrompts) break;
    const messages = [
      {
        role: 'system',
        content:
        `You are a precise code auditor. Your task is to extract at most TWO prompts from the provided file content.

        A "prompt" can be:
        - A system, user, or assistant message string.
        - A template string intended for LLM input (may contain placeholders like {variable}).
        - A constant that holds or represents a prompt (treat constants as system prompts if role is unclear).
        - A string inside an array/object of messages with a "role" or similar key.
        
        Rules:
        1. Ignore unrelated strings (e.g., labels, UI text, comments, code).
        2. If more than two prompts are found, return the two most central to the LLM’s core behavior.
        3. Do not alter wording, except to trim whitespace and remove code artifacts like quotes or backticks.
        4. If no prompts are found, return an empty array.
        
        Output:
        Return STRICT JSON only, exactly in this shape:
        {
          "prompts": [
            { "role": "system" | "user" | "assistant", "text": "...", "variables": ["..."], "model": "optional" },
            { "role": "system" | "user" | "assistant", "text": "...", "variables": ["..."], "model": "optional" }
          ]
        }
        
        Do not return any other text, comments, or explanations.`
      },
      {
        role: 'user',
        content: [
          `Path: ${file.path}`,
          'Content (truncated to 8k chars):',
          '```',
          (file.content || ''),
          '```',
          '',
          'Return JSON shape:',
          '{ "prompts": [ { "role": "system|user|assistant|null", "text": "...", "variables": ["..."], "model": "optional" } ] }',
        ].join('\n'),
      },
    ];

    const completion = await generateAIResponse({
      messages,
      model: 'gpt-4o',
      provider: 'OpenAI',
      token,
      temperature: 0,
      responseFormat: { type: 'json_object' },
    });
    const text =
      completion.choices?.[0]?.message?.content || '';

      try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed?.prompts) ? parsed.prompts : [];
      for (const p of arr) {
        if (results.length >= maxPrompts) break;
        if (p && typeof p.text === 'string' && p.text.trim().length > 0) {
          results.push({
            filePath: file.path,
            type: 'llm',
            role: p.role || null,
            text: p.text,
            model: p.model || null,
            variables: Array.isArray(p.variables) ? p.variables : [],
          });
        }
      }
    } catch {
      // ignore parsing issues, continue
    }
  }
  return results;
}

// —— AI-generated comprehensive assessment ——

export async function generateComprehensiveAssessmentMarkdown({
  repoOwner,
  repoName,
  providersDetected = [],
  frameworksDetected = [],
  candidates = [],
}) {
  const topCandidates = candidates.slice(0, 30).map((c) => ({
    filePath: c.filePath,
    provider: c.provider,
    framework: c.framework,
    indicators: c.indicators,
    score: c.score,
    snippet: (c.snippet || '').slice(0, 2000),
  }));

  const messages = [
    {
      role: 'system',
      content:
        'You are a senior AI reliability engineer at handit.ai. You analyze repositories to assess LLM usage, prompt hygiene, and risks. Provide actionable, concise recommendations. Output clean Markdown only.',
    },
    {
      role: 'user',
      content: [
        `Repository: ${repoOwner}/${repoName}`,
        `Providers detected: ${providersDetected.join(', ') || 'none'}`,
        `Frameworks detected: ${frameworksDetected.join(', ') || 'none'}`,
        '',
        'Top Prompt Candidates (path, provider, framework, indicators, score, snippet):',
        '```json',
        JSON.stringify(topCandidates, null, 2),
        '```',
        '',
        'Please generate a single Markdown document with the following sections:',
        '- Title: AI Assessment by handit.ai',
        '- Overview (brief findings summary)',
        '- Detected Stack (providers/frameworks with brief notes)',
        '- Prompt Inventory (compact table: file, provider, framework, score)',
        '- Risks & Issues (numbered list with severity: High/Med/Low)',
        '- Improvements & Recommendations (prioritized checklist)',
        '- Prompt Hygiene Checklist (determinism, inputs/outputs, safety, red teaming, logging)',
        '- Next Steps (short, actionable)',
        '',
        'Keep it concise and focused. Use bullet points. Do not invent files. Base on provided data.',
      ].join('\n'),
    },
  ];

  const token = process.env.OPENAI_API_KEY;
  const completion = await generateAIResponse({
    messages,
    model: 'gpt-4o',
    provider: 'OpenAI',
    token,
    temperature: 0.2,
  });

  const md =
    completion.text ||
    completion.choices?.[0]?.message?.content ||
    '# AI Assessment by handit.ai\n\n(No content)';
  return md;
}

// Build assessment using exact file contents (deeper prompt extraction)
export async function buildAssessmentFromFilesMarkdown({
  repoOwner,
  repoName,
  providersDetected = [],
  frameworksDetected = [],
  files = [],
}) {
  const extracted = [];
  for (const file of files) {
    const prompts = extractPromptsFromContent(file.content || '');
    if (prompts.length > 0) {
      extracted.push({
        filePath: file.path,
        prompts: prompts.map((p) => ({
          type: p.type,
          role: p.role || null,
          model: p.model || null,
          variables: p.variables || [],
          text: p.text.length > 4000 ? p.text.slice(0, 4000) + '…' : p.text,
          length: p.text.length,
        })),
      });
    }
  }

  const messages = [
    {
      role: 'system',
      content:
        'You are a senior AI reliability engineer at handit.ai. Perform an in-depth audit of prompts and LLM usage. Identify concrete risks (jailbreak susceptibility, prompt injection vectors, PII leakage, bias, safety gaps), determinism issues, missing output schemas, and improvement opportunities. Reference specific files/prompts. Output clean, well-structured Markdown only.',
    },
    {
      role: 'user',
      content: [
        `Repository: ${repoOwner}/${repoName}`,
        `Providers detected: ${providersDetected.join(', ') || 'none'}`,
        `Frameworks detected: ${frameworksDetected.join(', ') || 'none'}`,
        '',
        'Extracted prompts (per file):',
        '```json',
        JSON.stringify(extracted, null, 2),
        '```',
        '',
        'Produce ONE Markdown report with sections:',
        '## Overview — synthesis of key findings',
        '## Detected Stack — providers/frameworks and usage notes',
        '## Prompt Inventory — table listing: file, type, role, chars, variables',
        '## Deep Findings — for each prompt, list issues (severity High/Med/Low) with rationales and code-aware recommendations',
        '## Actionable Improvements — prioritized checklist (with examples/snippets)',
        '## Hygiene & Safety Checklist — determinism, input validation, schemas, logging, red teaming',
        'Keep it specific and non-generic; base strictly on provided prompts.',
      ].join('\n'),
    },
  ];

  const token = process.env.OPENAI_API_KEY;
  const completion = await generateAIResponse({
    messages,
    model: 'gpt-4o',
    provider: 'OpenAI',
    token,
    temperature: 0.2,
  });

  const md =
    completion.text ||
    completion.choices?.[0]?.message?.content ||
    '# AI Assessment by handit.ai\n\n(No content)';
  return md;
}

// Build a focused assessment of 1-2 prompts using best practices (Claude 4 prompt engineering guidance)
export async function generatePromptBestPracticesAssessmentMarkdown({
  promptsSelected = [],
}) {
  const normalized = (Array.isArray(promptsSelected) ? promptsSelected : [])
    .slice(0, 2)
    .map((p, idx) => ({
      index: idx + 1,
      filePath: p.filePath || null,
      role: p.role || null,
      type: p.type || null,
      model: p.model || null,
      variables: Array.isArray(p.variables) ? p.variables : [],
      text:
        typeof p.text === 'string'
          ? p.text.length > 5000
            ? p.text.slice(0, 5000) + '…'
            : p.text
          : '',
    }));

  const bestPractices = [
    'Be explicit with instructions and desired output',
    'Add context and rationale for better alignment',
    'Use examples that reflect desired behaviors',
    'Control the format of responses (specify structure/sections)',
    'Prefer positive instructions over prohibitions',
    'Use XML-like tags when strict formatting is required',
    'Match prompt style to desired output style',
    'Guide thinking and reflection for multi-step reasoning',
    'Optimize parallel tool calling where applicable',
    'Avoid focusing on passing tests/hard-coding; prefer general solutions',
  ];

  const messages = [
    {
      role: 'system',
      content:
        'You are a senior AI reliability engineer at handit.ai. Assess ONLY the provided prompts against  prompt-engineering best practices. Produce a professional Markdown report. Do NOT include file paths, roles, or metadata. Do NOT propose or rewrite prompts. Identify strengths, potential gaps, and risk indicators with severity. Note that confidence is limited because this is a static, initial assessment. Encourage setup completion so handit can automatically remediate later. Preserve all variable placeholders in any quoted prompt text (e.g., ${var}, {{var}}, {var}).',
    },
    {
      role: 'user',
      content: [
        'Prompts under review (max 2) as JSON (for your analysis only):',
        '```json',
        JSON.stringify(normalized, null, 2),
        '```',
        '',
        'Claude 4 best practices to consider (for your analysis only):',
        '```text',
        bestPractices.map((b, i) => `${i + 1}. ${b}`).join('\n'),
        '```',
        '',
        'Produce ONE professional Markdown document titled "## Prompt Best Practices Assessment". Include:',
        '### Summary',
        '- Brief overview of prompt quality and overall adherence to best practices.',
        '',
        '### Prompts',
        'For each prompt (in order):',
        '#### Original prompt',
        '```text',
        '(include the exact original prompt text here)',
        '```',
        '#### Alignment with best practices',
        '- Bullet list of strengths where the prompt aligns well.',
        '#### Potential gaps and risks',
        '- Bullet list of issues mapped to best practices with severity (High/Med/Low) and a short rationale.',
        '- Add a confidence note (e.g., "Confidence: Low/Medium" due to static analysis).',
        '',
        '### Next steps',
        '- Short checklist to complete setup so handit can automatically remediate prompts (e.g., enable instrumentation, connect providers, run evaluation harness).',
        '',
        'Constraints:',
        '- Do not include file paths, roles, types, or any metadata in the output.',
        '- Do not rewrite or suggest new prompts at this stage.',
        '- Keep it concise and practical.',
      ].join('\n'),
    },
  ];

  const token = process.env.OPENAI_API_KEY;
  const completion = await generateAIResponse({
    messages,
    model: 'gpt-4o',
    provider: 'OpenAI',
    token,
    temperature: 0.2,
  });

  const md =
    completion.text ||
    completion.choices?.[0]?.message?.content ||
    '## Prompt Best Practices Assessment\n\n(No content)';
  return md;
}

// Heuristic prompt extractors for JS/TS/Python
function extractPromptsFromContent(content) {
  const prompts = [];
  if (!content) return prompts;

  // Common model extraction
  const modelMatches = Array.from(
    content.matchAll(/model\s*:\s*['"]([^'"\n]+)['"]/g)
  );
  const modelName = modelMatches?.[0]?.[1] || null;

  // JS/TS: messages array with role/content
  const jsMessages = Array.from(
    content.matchAll(
      /role\s*:\s*['"](system|user|assistant)['"]\s*,\s*content\s*:\s*([`'"])([\s\S]*?)\2/gi
    )
  );
  for (const m of jsMessages) {
    prompts.push({
      type: 'messages',
      role: m[1],
      text: m[3],
      model: modelName,
      variables: extractVariables(m[3]),
    });
  }

  // JS/TS: systemPrompt/basePrompt variables
  const jsVars = Array.from(
    content.matchAll(
      /(systemPrompt|basePrompt|promptTemplate|instructions)\s*=\s*([`'"])([\s\S]*?)\2/gi
    )
  );
  for (const v of jsVars) {
    prompts.push({
      type: 'variable',
      role: inferRoleFromName(v[1]),
      text: v[3],
      model: modelName,
      variables: extractVariables(v[3]),
    });
  }

  // LangChain JS: template field
  const jsTemplates = Array.from(
    content.matchAll(/template\s*:\s*([`'"])([\s\S]*?)\1/gi)
  );
  for (const t of jsTemplates) {
    prompts.push({
      type: 'template',
      role: null,
      text: t[2],
      model: modelName,
      variables: extractVariables(t[2]),
    });
  }

  // Python: messages list entries
  const pyMessages = Array.from(
    content.matchAll(
      /['"]role['"]\s*:\s*['"](system|user|assistant)['"].{0,200}?['"]content['"]\s*:\s*("""|'''|['"])([\s\S]*?)\2/gi
    )
  );
  for (const pm of pyMessages) {
    prompts.push({
      type: 'messages',
      role: pm[1],
      text: pm[3],
      model: modelName,
      variables: extractVariables(pm[3]),
    });
  }

  // Python: system_prompt/base_prompt style
  const pyVars = Array.from(
    content.matchAll(
      /(system_prompt|base_prompt|prompt_template|instructions)\s*=\s*("""|'''|['"])([\s\S]*?)\2/gi
    )
  );
  for (const pv of pyVars) {
    prompts.push({
      type: 'variable',
      role: inferRoleFromName(pv[1]),
      text: pv[3],
      model: modelName,
      variables: extractVariables(pv[3]),
    });
  }

  return prompts;
}

function extractVariables(text) {
  const vars = new Set();
  // JS template literals
  for (const m of text.matchAll(/\$\{([^}]+)\}/g)) vars.add(m[1].trim());
  // Mustache-style
  for (const m of text.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g))
    vars.add(m[1].trim());
  // Python f-string style {var}
  for (const m of text.matchAll(/\{([^}]+)\}/g)) {
    const candidate = m[1].trim();
    if (!candidate.includes(':')) vars.add(candidate);
  }
  return Array.from(vars).slice(0, 20);
}

function inferRoleFromName(name) {
  if (!name) return null;
  if (name.toLowerCase().includes('system')) return 'system';
  if (name.toLowerCase().includes('user')) return 'user';
  return null;
}
