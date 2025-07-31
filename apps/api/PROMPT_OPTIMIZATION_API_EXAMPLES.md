# Prompt Optimization API Examples

This document provides examples of how to use the prompt optimization testing endpoints.

## 🚀 Test Prompt Optimization PR Creation

### Endpoint
```
POST /api/prompt-optimization/test-pr
```

### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Request Body
```json
{
  "agentId": 123,
  "originalPrompt": "You are a helpful assistant that answers questions about products. Please provide accurate and detailed information. Always be polite and professional.",
  "optimizedPrompt": "You are an expert product consultant with deep knowledge of our catalog. Your goal is to provide comprehensive, accurate product information that helps customers make informed decisions.\n\nGuidelines:\n- Always be professional, friendly, and helpful\n- Provide specific details about features, benefits, and use cases\n- If you don't know something, say so clearly\n- Ask clarifying questions when needed to better assist the customer",
  "metrics": {
    "accuracy": 0.92,
    "improvement": 0.18,
    "totalEvaluations": 150,
    "successfulEvaluations": 138
  }
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Successfully created GitHub PR for prompt optimization",
  "data": {
    "prNumber": 42,
    "prUrl": "https://github.com/username/repo/pull/42",
    "branchName": "handit/prompt-optimization-1704067200000",
    "filesChanged": 2,
    "locationsFound": 2,
    "agent": {
      "id": 123,
      "name": "Customer Support Agent",
      "repository": "https://github.com/username/customer-support-bot"
    },
    "metrics": {
      "accuracy": 0.92,
      "improvement": 0.18,
      "totalEvaluations": 150,
      "successfulEvaluations": 138,
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  },
  "error": null,
  "debug": {
    "agentId": 123,
    "hasRepository": true,
    "originalPromptLength": 123,
    "optimizedPromptLength": 456,
    "metricsProvided": true
  }
}
```

### Error Response (400)
```json
{
  "success": false,
  "message": "Failed to create GitHub PR: Original prompt not found in repository",
  "data": null,
  "error": "Original prompt not found in repository",
  "debug": {
    "agentId": 123,
    "hasRepository": true,
    "originalPromptLength": 123,
    "optimizedPromptLength": 456,
    "metricsProvided": true
  }
}
```

## 📊 Get Agent Status

### Endpoint
```
GET /api/prompt-optimization/status/:agentId
```

### Example
```
GET /api/prompt-optimization/status/123
```

### Response
```json
{
  "success": true,
  "data": {
    "agent": {
      "id": 123,
      "name": "Customer Support Agent",
      "repository": "https://github.com/username/customer-support-bot",
      "hasRepository": true
    },
    "company": {
      "id": 1,
      "name": "Acme Corp"
    },
    "githubIntegration": {
      "id": 1,
      "active": true,
      "tokenExpired": false,
      "repositoryOwner": "username",
      "repositoryName": "customer-support-bot"
    },
    "recentPRs": [
      {
        "id": 1,
        "prNumber": 42,
        "prUrl": "https://github.com/username/repo/pull/42",
        "status": "open",
        "metricsImprovement": {
          "accuracy": 0.92,
          "improvement": 0.18
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "canCreatePR": true
  }
}
```

## 📋 List All Agents

### Endpoint
```
GET /api/prompt-optimization/agents
```

### Response
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": 123,
        "name": "Customer Support Agent",
        "repository": "https://github.com/username/customer-support-bot",
        "hasRepository": true,
        "canCreatePR": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": 124,
        "name": "Sales Assistant",
        "repository": null,
        "hasRepository": false,
        "canCreatePR": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalAgents": 2,
    "agentsWithRepositories": 1,
    "githubIntegration": {
      "active": true,
      "tokenExpired": false
    }
  }
}
```

## 🧪 Testing with cURL

### Test PR Creation
```bash
curl -X POST http://localhost:3001/api/prompt-optimization/test-pr \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": 123,
    "originalPrompt": "You are a helpful assistant.",
    "optimizedPrompt": "You are an expert consultant with deep knowledge.",
    "metrics": {
      "accuracy": 0.92,
      "improvement": 0.18
    }
  }'
```

### Get Agent Status
```bash
curl -X GET http://localhost:3001/api/prompt-optimization/status/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### List Agents
```bash
curl -X GET http://localhost:3001/api/prompt-optimization/agents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Prerequisites

1. **Agent Setup**: The agent must have a `repository` field configured
2. **GitHub Integration**: Company must have an active GitHub integration
3. **Valid Token**: GitHub access token must not be expired
4. **Authentication**: Valid JWT token for API access

## ⚠️ Common Issues

### "Agent does not have a repository URL configured"
- Set the `repository` field on your agent to a valid GitHub repository URL
- Supported formats: `https://github.com/owner/repo`, `owner/repo`

### "No GitHub integration found"
- Complete the GitHub OAuth flow first: `/api/git/auth`
- Ensure the integration is marked as `active`

### "GitHub token expired"
- Re-authenticate through the GitHub OAuth flow
- Check token expiration in the integration settings

### "Original prompt not found in repository"
- Ensure the prompt text exists in your repository files
- The service uses multiple search strategies but may not find very modified prompts
- Try with a shorter, more distinctive part of your prompt

## 📝 Notes

- The service will create a new branch with timestamp: `handit/prompt-optimization-{timestamp}`
- PRs include detailed metrics and before/after comparisons
- The service uses AI to intelligently locate and replace prompts while preserving code structure
- All operations are logged for debugging purposes