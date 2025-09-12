# GitHub OAuth Login Implementation

This document describes the GitHub OAuth login implementation for the Handit platform, which allows users to authenticate with GitHub and automatically discover their organization's Handit installations.

## Overview

The GitHub OAuth implementation provides a seamless way for users to:
1. **Authenticate with GitHub** using OAuth 2.0
2. **Discover installations** of the Handit GitHub App in their organizations
3. **Auto-link to existing companies** or create new ones
4. **Access Handit features** immediately after authentication

## Architecture

### Backend Components

#### 1. GitHub OAuth Service (`src/services/githubOAuthService.js`)
- **Purpose**: Core service handling GitHub OAuth flow
- **Key Methods**:
  - `exchangeCodeForUserToken(code)` - Exchange OAuth code for access token
  - `getUserProfile(accessToken)` - Get GitHub user profile
  - `getUserInstallations(accessToken)` - Get user's accessible installations
  - `findOrCreateHanditUser(githubUser, installations)` - Create/link Handit user
  - `completeOAuthFlow(code)` - Complete end-to-end OAuth flow

#### 2. GitHub OAuth Controller (`src/controllers/githubOAuthController.js`)
- **Purpose**: HTTP endpoints for GitHub OAuth flow
- **Endpoints**:
  - `GET /api/auth/github/auth` - Initiate OAuth flow
  - `GET /api/auth/github/callback` - Handle OAuth callback
  - `GET /api/auth/github/installations` - Get user installations
  - `POST /api/auth/github/link-company` - Link user to company
  - `POST /api/auth/github/create-company` - Create new company
  - `GET /api/auth/github/config` - Get OAuth configuration

#### 3. Database Schema Updates
- **Migration**: `migrations/202501150000000-add-github-oauth-to-users.js`
- **New User Fields**:
  - `github_user_id` - GitHub user ID (unique)
  - `github_username` - GitHub username
  - `oauth_provider` - OAuth provider (github, google, microsoft)

## OAuth Flow

### Step 1: OAuth Initiation
```
User clicks "Continue with GitHub"
→ GET /api/auth/github/auth
→ Redirect to GitHub OAuth with scopes: read:org, user:email, read:user
```

### Step 2: GitHub Authorization
```
User authorizes on GitHub
→ GitHub redirects to /api/auth/github/callback with code
```

### Step 3: Token Exchange & User Discovery
```
Backend exchanges code for access token
→ Get GitHub user profile
→ Get user's accessible Handit installations
→ Find or create Handit user account
```

### Step 4: Company Mapping
```
For each installation:
→ Check if company exists for that installation
→ Link user to existing company OR create new company
→ Generate JWT token for Handit session
```

### Step 5: Redirect to Dashboard
```
Single installation: Auto-select and redirect to dashboard
Multiple installations: Show organization picker
No installations: Show onboarding flow
```

## Environment Variables

Add these to your `.env` file:

```bash
# GitHub OAuth App (separate from GitHub App)
GITHUB_OAUTH_CLIENT_ID=your_oauth_app_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_oauth_app_client_secret
GITHUB_OAUTH_REDIRECT_URI=https://yourdomain.com/api/auth/github/callback

# Existing GitHub App (for installation tokens)
GITHUB_APP_ID=your_existing_app_id
GITHUB_APP_PRIVATE_KEY=your_existing_private_key

# JWT Secret
JWT_SECRET=your_jwt_secret
```

## GitHub OAuth App Setup

1. **Create GitHub OAuth App**:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Set Application name: "Handit"
   - Set Homepage URL: `https://yourdomain.com`
   - Set Authorization callback URL: `https://yourdomain.com/api/auth/github/callback`

2. **Configure Scopes**:
   - `read:org` - Read organization membership
   - `user:email` - Read user email
   - `read:user` - Read user profile

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add to environment variables

## Database Migration

Run the migration to add GitHub OAuth fields to the User model:

```bash
cd apps/api
npx sequelize-cli db:migrate
```

## Testing

Run the test script to verify the implementation:

```bash
cd apps/api
node src/test-github-oauth.js
```

## API Endpoints

### Public Endpoints (No Authentication Required)

#### `GET /api/auth/github/auth`
Initiates GitHub OAuth flow.

**Query Parameters**:
- `redirect_uri` (optional): Custom redirect URI

**Response**: Redirects to GitHub OAuth authorization page

#### `GET /api/auth/github/callback`
Handles GitHub OAuth callback.

**Query Parameters**:
- `code`: Authorization code from GitHub
- `state`: State parameter for CSRF protection
- `error` (optional): OAuth error
- `error_description` (optional): Error description

**Response**: Redirects to appropriate page based on installation status

#### `GET /api/auth/github/config`
Returns OAuth configuration for frontend.

**Response**:
```json
{
  "clientId": "your_client_id",
  "redirectUri": "your_redirect_uri",
  "scopes": ["read:org", "user:email", "read:user"]
}
```

### Protected Endpoints (Authentication Required)

#### `GET /api/auth/github/installations`
Gets user's accessible GitHub installations.

**Headers**: `Authorization: Bearer <jwt_token>`

**Response**:
```json
{
  "installations": [
    {
      "id": 123,
      "company": {
        "id": 456,
        "name": "acme-corp"
      },
      "integration": {
        "id": 789,
        "configured": true,
        "active": true
      }
    }
  ]
}
```

#### `POST /api/auth/github/link-company`
Links user to existing company via installation.

**Headers**: `Authorization: Bearer <jwt_token>`

**Body**:
```json
{
  "installationId": 123
}
```

**Response**:
```json
{
  "success": true,
  "user": { ... },
  "company": { ... },
  "integration": { ... },
  "token": "new_jwt_token"
}
```

#### `POST /api/auth/github/create-company`
Creates new company for installation.

**Headers**: `Authorization: Bearer <jwt_token>`

**Body**:
```json
{
  "installationId": 123,
  "companyName": "New Company"
}
```

**Response**:
```json
{
  "success": true,
  "user": { ... },
  "company": { ... },
  "integration": { ... },
  "token": "new_jwt_token"
}
```

## Security Considerations

1. **CSRF Protection**: State parameter prevents CSRF attacks
2. **Token Encryption**: User access tokens are encrypted before storage
3. **Scope Limitation**: Minimal scopes requested (read:org, user:email, read:user)
4. **JWT Expiration**: JWT tokens expire after 1 year
5. **Rate Limiting**: Consider implementing rate limiting on OAuth endpoints

## Error Handling

The implementation handles various error scenarios:

- **OAuth Errors**: Invalid code, expired code, insufficient scopes
- **API Errors**: GitHub API rate limits, network issues
- **User Errors**: No installations found, multiple installations
- **System Errors**: Database issues, configuration problems

All errors are logged and appropriate error messages are returned to the client.

## Next Steps

1. **Frontend Implementation**: Create GitHub OAuth login components
2. **Organization Picker**: Build UI for multiple installation selection
3. **Testing**: Comprehensive testing with real GitHub accounts
4. **Monitoring**: Add logging and monitoring for OAuth flows
5. **Documentation**: Update API documentation and user guides

## Troubleshooting

### Common Issues

1. **"GitHub OAuth error: bad_verification_code"**
   - Code has expired (10 minutes) or already used
   - Check OAuth App configuration

2. **"No installations found"**
   - User doesn't have access to any Handit installations
   - Guide user to install Handit GitHub App

3. **"Invalid client_id"**
   - Check GITHUB_OAUTH_CLIENT_ID environment variable
   - Verify OAuth App is properly configured

4. **"Redirect URI mismatch"**
   - Check GITHUB_OAUTH_REDIRECT_URI environment variable
   - Verify callback URL in OAuth App settings

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=github-oauth:*
```

This will provide detailed logging of the OAuth flow for troubleshooting.
