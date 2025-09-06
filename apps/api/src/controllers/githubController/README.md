# GitHub Controller Module

This module handles all GitHub-related functionality for the handit.ai platform, including GitHub App integration, repository assessment, autonomous engineer setup, and pull request management.

## 📁 File Structure

```
githubController/
├── README.md                    # This documentation
├── githubController.js         # Main controller with API endpoints
└── repoAIAssessmentService.js  # AI-powered repository assessment service
```

## 🎯 Overview

The GitHub Controller module provides comprehensive GitHub integration capabilities:

- **GitHub App Authentication**: OAuth flow and installation management
- **Repository Management**: File browsing, branch listing, and content access
- **AI Assessment**: Automated analysis of repositories for AI/ML usage
- **Autonomous Engineer Setup**: Automated handit.ai integration setup
- **Pull Request Management**: Creation and tracking of optimization PRs

## 📋 Main Controller (`githubController.js`)

### **Authentication & Installation**

#### `initiateGitHubAuth(req, res)`
- **Purpose**: Initiates GitHub App installation flow
- **Method**: `GET /git/auth`
- **Parameters**: `state` (companyId)
- **Returns**: Redirects to GitHub App installation page
- **Security**: Generates secure state parameter for CSRF protection

#### `handleGitHubCallback(req, res)`
- **Purpose**: Handles GitHub App installation callback
- **Method**: `GET /git/callback`
- **Parameters**: `installation_id`, `setup_action`, `state`
- **Returns**: Redirects to dashboard with success/error status
- **Creates**: GitHubIntegration record with installation details

#### `handleGitHubWebhook(req, res)`
- **Purpose**: Processes GitHub webhook events
- **Method**: `POST /git/webhook`
- **Events**: `pull_request`, `installation`
- **Security**: Verifies webhook signature using HMAC-SHA256

### **Repository Access**

#### `listInstallationRepositories(req, res)`
- **Purpose**: Lists repositories accessible to GitHub App installation
- **Method**: `GET /git/installation-repos`
- **Parameters**: `integrationId` or `installationId`
- **Returns**: Array of repositories with metadata
- **Authentication**: Uses GitHub App installation token

#### `getRepositoryBranches(req, res)`
- **Purpose**: Fetches all branches for a repository
- **Method**: `GET /git/repository-branches`
- **Parameters**: `integrationId`, `repositoryFullName`
- **Returns**: Branches with default branch indicator
- **Features**: Sorts with default branch first, includes protection status

#### `getRepositoryFiles(req, res)`
- **Purpose**: Retrieves repository file structure
- **Method**: `GET /git/repository-files`
- **Parameters**: `integrationId`, `repositoryFullName`, `path`, `maxDepth`
- **Returns**: Organized file structure (source, config, directories)
- **Performance**: Uses GitHub Tree API for fast retrieval
- **Filtering**: Excludes node_modules, .git, build directories

### **AI Assessment & Setup**

#### `assessRepoAndSetupHandit(req, res)`
- **Purpose**: Comprehensive repository assessment + handit.ai setup
- **Method**: `POST /git/assess-and-setup-handit`
- **Authentication**: Requires JWT token
- **Parameters**: `integrationId`, `repoUrl`, `agentFile`, `agentFunction`, `agentName`, `branch`
- **Process**:
  1. Assesses repository for AI/ML usage on specified branch
  2. Adds handit.ai monitoring code to specified function
  3. Updates dependency files (package.json, requirements.txt)
  4. Creates PR targeting the specified branch (or default if not specified)
- **Branch Handling**: Uses provided `branch` parameter as target branch for PR
- **Returns**: PR details and assessment summary

#### `assessRepoAndCreatePR(req, res)`
- **Purpose**: Creates assessment-only PR without setup
- **Method**: `POST /git/assess-and-pr`
- **Parameters**: `integrationId`, `repoUrl`, `branch`, `preferLocalClone`
- **Branch Handling**: Uses provided `branch` parameter as target branch for PR
- **Returns**: PR with AI assessment documentation
- **Use Case**: Documentation and analysis without code changes

### **Integration Management**

#### `getGitHubIntegrations(req, res)`
- **Purpose**: Retrieves GitHub integrations for user's company
- **Method**: `GET /git/integrations`
- **Authentication**: Requires JWT token
- **Returns**: List of integrations with recent PRs

#### `updateGitHubIntegration(req, res)`
- **Purpose**: Updates integration configuration
- **Method**: `PUT /git/integrations/:id`
- **Parameters**: `repositoryName`, `promptFilePath`, `branchName`, `active`
- **Returns**: Updated integration details

#### `testGitHubIntegration(req, res)`
- **Purpose**: Tests GitHub App installation access
- **Method**: `POST /git/integrations/:id/test`
- **Returns**: Connection status and repository access info

#### `deleteGitHubIntegration(req, res)`
- **Purpose**: Removes GitHub integration
- **Method**: `DELETE /git/integrations/:id`
- **Returns**: Success confirmation

### **Pull Request Management**

#### `getUserPullRequests(req, res)`
- **Purpose**: Retrieves pull requests for authenticated user
- **Method**: `GET /git/pull-requests`
- **Parameters**: `type` (handit_setup, repo_assessment, etc.)
- **Returns**: Recent PRs with status and metrics

### **Utility Functions**

#### `redirectToAssessmentByEmail(req, res)`
- **Purpose**: Redirects users to assessment based on email
- **Method**: `GET /git/redirect-by-email`
- **Parameters**: `email`
- **Returns**: Redirect to GitHub App installation or assessment

## 🤖 AI Assessment Service (`repoAIAssessmentService.js`)

### **Main Function**

#### `assessRepositoryAI(params)`
- **Purpose**: Comprehensive AI-powered repository analysis
- **Parameters**:
  - `repoUrl`: GitHub repository URL
  - `companyId`: Company ID for GitHub token access
  - `models`: Sequelize models object
  - `branch`: Optional branch preference
  - `preferLocalClone`: Use local git clone for analysis
  - `hintFilePath`: Specific file to focus on
  - `hintFunctionName`: Specific function to analyze
  - `executionTree`: Execution flow data
  - `useHintsFlow`: Enable hints-based analysis

### **Assessment Process**

1. **Repository Access**: Uses GitHub App installation token
2. **File Discovery**: Searches for AI/ML related files and patterns
3. **Content Analysis**: Analyzes code for prompts, providers, frameworks
4. **AI Processing**: Uses LLM to extract and categorize findings
5. **Result Compilation**: Returns structured assessment data

### **Detection Capabilities**

- **LLM Providers**: OpenAI, Anthropic, Google, Azure, etc.
- **Frameworks**: LangChain, LlamaIndex, Transformers, etc.
- **Prompt Patterns**: System prompts, user prompts, templates
- **Code Patterns**: API calls, model usage, prompt engineering

### **Output Format**

```javascript
{
  success: true,
  repo: { owner, name, fullName },
  providersDetected: ['OpenAI', 'Anthropic'],
  frameworksDetected: ['LangChain', 'Transformers'],
  promptsSelected: [
    {
      filePath: 'src/prompts.py',
      content: 'You are a helpful assistant...',
      type: 'system_prompt',
      confidence: 0.95
    }
  ],
  selectedFiles: [
    {
      path: 'src/main.py',
      content: '...',
      relevanceScore: 0.87
    }
  ],
  candidates: [...],
  hintsUsed: true,
  localCloneUsed: false
}
```

## 🔧 Helper Functions

### **Code Integration**

#### `addHanditIntegrationToFile(content, filePath, functionName, agentName)`
- **Purpose**: AI-powered code modification to add handit monitoring
- **Supports**: Python, JavaScript, TypeScript, JSX, TSX
- **Process**: Uses LLM to intelligently integrate monitoring code
- **Fallback**: Simple string replacement if AI fails

#### `generateHanditIntegrationCode(filePath, functionName, agentName)`
- **Purpose**: Generates handit integration code templates
- **Languages**: Python (decorators), JavaScript (tracing calls)

### **Dependency Management**

#### `findAndUpdateDependencyFiles(github, owner, repo, agentFilePath, branch)`
- **Purpose**: Finds and updates dependency files
- **Files**: package.json, requirements.txt
- **Process**: Adds handit-ai package to dependencies

#### `addNpmDependency(content)`
- **Purpose**: Adds @handit.ai/handit-ai to package.json
- **Version**: ^0.0.32

#### `addPipDependency(content)`
- **Purpose**: Adds handit-ai to requirements.txt
- **Version**: >=0.0.62

### **File Organization**

#### `organizeRepositoryFiles(files)`
- **Purpose**: Organizes files by type for better UX
- **Categories**: sourceFiles, configFiles, directories, otherFiles
- **Sorting**: Prioritizes executable files and directories

#### `getRepositoryFilesTree(github, owner, repo, maxDepth)`
- **Purpose**: Fast repository file retrieval using Tree API
- **Performance**: Single API call vs recursive requests
- **Fallback**: Recursive method if Tree API fails

## 🔐 Security Features

- **GitHub App Authentication**: Secure OAuth flow with state parameters
- **Webhook Verification**: HMAC-SHA256 signature validation
- **Token Management**: Automatic installation token refresh
- **Access Control**: Company-scoped integration access
- **Input Validation**: Comprehensive parameter validation

## 🚀 Performance Optimizations

- **Parallel Processing**: Concurrent GitHub API calls
- **Tree API Usage**: Single call for complete repository structure
- **Local Cloning**: Optional local git clone for faster analysis
- **Caching**: GitHub token caching and reuse
- **Batch Operations**: Multiple file operations in single commits

## 📊 Error Handling

- **Graceful Degradation**: Fallback methods for failed operations
- **Detailed Logging**: Comprehensive error logging with context
- **User-Friendly Messages**: Clear error messages for frontend
- **Retry Logic**: Automatic retry for transient failures

## 🔄 Integration Flow

```
1. User initiates GitHub App installation
   ↓
2. GitHub redirects to callback with installation_id
   ↓
3. System creates GitHubIntegration record
   ↓
4. User selects repository and branch
   ↓
5. System fetches repository structure
   ↓
6. User selects agent file and function
   ↓
7. System runs AI assessment
   ↓
8. System adds handit monitoring code
   ↓
9. System creates PR with changes
   ↓
10. System tracks PR status via webhooks
```

## 🛠️ Development Guidelines

### **Adding New Endpoints**
1. Define function in `githubController.js`
2. Add route in `githubRoutes.js`
3. Update this README
4. Add proper error handling
5. Include authentication if needed

### **Modifying Assessment Logic**
1. Update `assessRepositoryAI` function
2. Test with various repository types
3. Update output format documentation
4. Consider backward compatibility

### **Security Considerations**
- Always validate GitHub webhook signatures
- Use company-scoped access controls
- Implement rate limiting for API calls
- Log all sensitive operations

## 📈 Monitoring & Analytics

- **PR Creation Tracking**: All PRs stored in database
- **Integration Status**: Active/inactive integration monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: API call timing and success rates

---

This module is central to handit.ai's GitHub integration capabilities, providing seamless setup and ongoing management of autonomous engineer monitoring across user repositories.
