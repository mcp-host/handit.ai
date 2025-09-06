# Onboarding Configuration Guide

This guide explains how to write and structure the `config.json` file for the handit.ai onboarding system. It covers all available features, patterns, and best practices.

## Table of Contents

1. [Basic Structure](#basic-structure)
2. [Tours Configuration](#tours-configuration)
3. [Step Types](#step-types)
4. [Conditional Logic](#conditional-logic)
5. [Form Configuration](#form-configuration)
6. [Cursor Guidance](#cursor-guidance)
7. [Element Targeting](#element-targeting)
8. [Skip Logic](#skip-logic)
9. [Analytics Integration](#analytics-integration)
10. [Dynamic Content](#dynamic-content)
11. [Best Practices](#best-practices)

## Basic Structure

The `config.json` file follows this structure:

```json
{
  "triggers": { ... },
  "tours": [ ... ],
  "dynamicContent": { ... },
  "analytics": { ... },
  "personalizations": { ... }
}
```

### Triggers Section

Defines when tours should be triggered based on user state or events:

```json
{
  "triggers": {
    "firstLogin": {
      "condition": "user.loginCount === 1 && user.signupCompleted === true",
      "tourId": "welcome-concept-walkthrough"
    },
    "firstTrace": {
      "condition": "user.hasIntegratedSDK === true && events.firstTrace === true",
      "tourId": "first-trace-tracing-evaluation"
    }
  }
}
```

**Available Variables:**
- `user.*` - User properties (loginCount, hasIntegratedSDK, etc.)
- `events.*` - Event flags (firstTrace, optimizationCompleted, etc.)

## Tours Configuration

Each tour is defined with steps, settings, and metadata:

```json
{
  "tours": [
    {
      "id": "tour-id",
      "title": "Tour Title",
      "description": "Tour description",
      "settings": {
        "showAssistant": true,
        "allowSkip": true
      },
      "steps": [ ... ]
    }
  ]
}
```

### Tour Settings

- `showAssistant`: Whether to show the AI assistant during the tour
- `allowSkip`: Whether users can skip the entire tour
- `autoStart`: Whether the tour starts automatically when triggered

## Step Types

### 1. Banner Steps

Simple informational banners with actions:

```json
{
  "stepNumber": 1,
  "id": "welcome-banner",
  "type": "banner",
  "title": "Welcome",
  "target": "body",
  "placement": "top",
  "content": {
    "heading": "Welcome to handit.ai!",
    "description": "Let's get you started with your autonomous engineer.",
    "variant": "success",
    "showCloseButton": false,
    "autoHide": false,
    "icon": "🚀"
  },
  "actions": [
    {
      "text": "Get Started",
      "type": "primary",
      "action": "nextStep",
      "analytics": "welcome_banner_clicked"
    }
  ]
}
```

**Content Properties:**
- `heading`: Main title text
- `description`: Subtitle or explanation text
- `variant`: Visual style (`success`, `info`, `warning`, `error`)
- `showCloseButton`: Whether to show X button
- `autoHide`: Whether banner auto-hides after duration
- `icon`: Emoji or icon to display
- `duration`: Auto-hide duration in milliseconds

**Action Types:**
- `nextStep`: Move to next step
- `finishTour`: Complete the tour
- `skipTour`: Skip the entire tour
- `openURL`: Open external URL
- `customAction`: Trigger custom handler

### 2. Form Steps

Interactive forms for data collection:

```json
{
  "stepNumber": 2,
  "id": "setup-form",
  "type": "form",
  "title": "Setup Configuration",
  "target": "body",
  "placement": "center",
  "content": {
    "heading": "Configure Your Setup",
    "description": "Choose how you want to set up your autonomous engineer.",
    "form": {
      "fields": [
        {
          "id": "setupChoice",
          "type": "radio",
          "label": "Setup Method",
          "required": true,
          "options": [
            { "value": "automatic", "label": "GitHub Setup (Recommended)" },
            { "value": "manual", "label": "Manual CLI Setup" },
            { "value": "other", "label": "Other / Need Help" }
          ]
        }
      ]
    }
  },
  "actions": [
    {
      "text": "Continue",
      "type": "primary",
      "action": "nextStep",
      "analytics": "setup_form_submitted"
    }
  ],
  "conditionalNavigation": {
    "field": "setupChoice",
    "branches": {
      "automatic": "github-connect-step",
      "manual": "manual-cli-instructions",
      "other": "expert-contact-step"
    }
  }
}
```

### 3. Cursor-Only Steps

Steps that guide users to click specific elements:

```json
{
  "stepNumber": 3,
  "id": "click-tracing-menu",
  "type": "cursor-only",
  "title": "Navigate to Tracing",
  "target": "[data-nav-item='Tracing']",
  "placement": "right",
  "content": {
    "heading": "Go to Tracing",
    "description": "Click on the Tracing menu to see your traces and evaluations."
  },
  "actions": [
    {
      "text": "Skip",
      "type": "secondary",
      "action": "nextStep",
      "analytics": "tracing_navigation_skipped"
    }
  ],
  "advanceOnClick": {
    "target": "[data-nav-item='Tracing']",
    "description": "Click on Tracing in the navigation"
  },
  "waitForElement": {
    "target": "[data-nav-item='Tracing']",
    "timeout": 10000,
    "checkInterval": 1000
  },
  "cursorGuidance": {
    "enabled": true,
    "delay": 1000,
    "steps": [
      {
        "target": "[data-nav-item='Tracing']",
        "targetText": "Tracing",
        "highlight": { "style": "glow", "intensity": "high", "duration": 3000 },
        "animation": { "duration": 1200, "easing": "ease-in-out", "path": "curved" },
        "action": { "type": "hover" },
        "instruction": {
          "title": "Click on Tracing",
          "description": "This will take you to the tracing interface where you can see all your AI executions.",
          "tip": "Tracing helps you understand how your AI makes decisions",
          "position": "top",
          "showNearTarget": true
        },
        "delay": 100
      }
    ]
  }
}
```

## Conditional Logic

### showOnlyIf Conditions

Show steps only when certain conditions are met:

```json
{
  "stepNumber": 4,
  "id": "pr-ready-banner",
  "type": "banner",
  "showOnlyIf": {
    "field": "hasOptimizationPRs",
    "value": true
  },
  "content": {
    "heading": "Your Optimization PR is Ready!",
    "description": "Check out your optimization in the GitHub Pull Request."
  }
}
```

**Available Fields:**
- Form field values: `formValues.fieldName`
- User state: `userState.fieldName`
- Event data: `eventData.fieldName`

### Conditional Navigation

Navigate to different steps based on form data:

```json
{
  "conditionalNavigation": {
    "field": "setupChoice",
    "branches": {
      "automatic": "github-connect-step",
      "manual": "manual-cli-instructions",
      "other": "expert-contact-step"
    }
  }
}
```

## Form Configuration

### Field Types

#### Radio Buttons
```json
{
  "id": "setupChoice",
  "type": "radio",
  "label": "Setup Method",
  "required": true,
  "options": [
    { "value": "automatic", "label": "GitHub Setup" },
    { "value": "manual", "label": "Manual Setup" }
  ]
}
```

#### Text Input
```json
{
  "id": "apiKey",
  "type": "text",
  "label": "API Key",
  "placeholder": "Enter your API key",
  "required": true,
  "validation": {
    "minLength": 10,
    "pattern": "^sk-[a-zA-Z0-9]+$"
  }
}
```

#### Select Dropdown
```json
{
  "id": "provider",
  "type": "select",
  "label": "AI Provider",
  "required": true,
  "options": [
    { "value": "openai", "label": "OpenAI" },
    { "value": "anthropic", "label": "Anthropic" }
  ]
}
```

#### Dynamic Fields

Fields that depend on other fields:

```json
{
  "id": "repository",
  "type": "repository-search",
  "label": "Repository",
  "required": true,
  "apiEndpoint": "/git/repositories",
  "dependsOn": "githubConnected"
}
```

**Dynamic Field Types:**
- `repository-search`: Search and select GitHub repositories
- `branch-search`: Select branches for a repository
- `file-search`: Search files within a repository

### Form Validation

```json
{
  "validation": {
    "required": true,
    "minLength": 5,
    "maxLength": 100,
    "pattern": "^[a-zA-Z0-9]+$",
    "custom": "validateApiKey"
  }
}
```

## Cursor Guidance

### Basic Configuration

```json
{
  "cursorGuidance": {
    "enabled": true,
    "delay": 1000,
    "steps": [
      {
        "target": "[data-testid='button']",
        "targetText": "Button",
        "highlight": { 
          "style": "glow", 
          "intensity": "high", 
          "duration": 3000 
        },
        "animation": { 
          "duration": 1200, 
          "easing": "ease-in-out", 
          "path": "curved" 
        },
        "action": { "type": "hover" },
        "instruction": {
          "title": "Click Here",
          "description": "This button will start the process.",
          "tip": "Make sure you're ready to proceed",
          "position": "top",
          "showNearTarget": true
        },
        "delay": 100
      }
    ]
  }
}
```

### Highlight Styles

- `glow`: Glowing effect around element
- `pulse`: Pulsing animation
- `border`: Border highlight
- `background`: Background color change

### Animation Types

- `hover`: Mouse hovers over element
- `click`: Mouse clicks on element
- `scroll`: Scrolls to element

## Element Targeting

### CSS Selectors

```json
{
  "target": "[data-testid='trace-row-first']",
  "target": "[data-nav-item='Tracing']",
  "target": ".react-flow__node:nth-child(2)",
  "target": "#specific-id"
}
```

### Fallback Selectors

```json
{
  "target": ".react-flow__node:nth-child(2), .react-flow__node:first-child"
}
```

### Wait for Elements

```json
{
  "waitForElement": {
    "target": "[data-testid='trace-row-first']",
    "timeout": 15000,
    "checkInterval": 1000
  }
}
```

**Properties:**
- `target`: CSS selector for element to wait for
- `timeout`: Maximum time to wait (milliseconds)
- `checkInterval`: How often to check for element (milliseconds)

## Skip Logic

### Auto-Skip on Timeout

When `waitForElement` times out, the step automatically advances:

```json
{
  "waitForElement": {
    "target": "[data-testid='missing-element']",
    "timeout": 10000,
    "checkInterval": 1000
  }
}
```

### Manual Skip Buttons

```json
{
  "actions": [
    {
      "text": "Skip",
      "type": "secondary",
      "action": "nextStep",
      "analytics": "step_skipped"
    }
  ]
}
```

### Skip Entire Walkthrough

```json
{
  "actions": [
    {
      "text": "Skip Walkthrough",
      "type": "secondary",
      "action": "finishTour",
      "analytics": "walkthrough_skipped"
    }
  ]
}
```

## Analytics Integration

### Action Analytics

```json
{
  "actions": [
    {
      "text": "Continue",
      "type": "primary",
      "action": "nextStep",
      "analytics": "setup_form_continue"
    }
  ]
}
```

### Custom Analytics Events

```json
{
  "analytics": {
    "stepStarted": "first_trace_step_started",
    "stepCompleted": "first_trace_step_completed",
    "stepSkipped": "first_trace_step_skipped"
  }
}
```

## Dynamic Content

### Personalization

```json
{
  "personalizations": {
    "agentTypes": {
      "data_extraction": {
        "terminology": {
          "ai": "Data Extraction AI",
          "prompt": "Extraction Template",
          "model": "Extraction Engine"
        },
        "examples": {
          "useCase": "extracting customer data from invoices",
          "benefit": "automated data processing"
        }
      }
    }
  }
}
```

### Dynamic Content Replacement

```json
{
  "content": {
    "heading": "Welcome to {{agentType.terminology.ai}}",
    "description": "Your {{agentType.terminology.ai}} will help with {{agentType.examples.useCase}}."
  }
}
```

## Best Practices

### 1. Element Targeting

- **Use data attributes**: `[data-testid='element']` is more reliable than CSS classes
- **Provide fallbacks**: `".primary-button, .btn-primary"` for robustness
- **Test selectors**: Verify selectors work in all states (loading, empty, populated)

### 2. Conditional Logic

- **Use showOnlyIf**: For conditional step display
- **Use conditionalNavigation**: For branching based on form data
- **Test all branches**: Ensure all conditional paths work correctly

### 3. Skip Logic

- **Always provide skip options**: Users should be able to exit at any time
- **Use appropriate timeouts**: 10-15 seconds for most elements
- **Handle missing elements**: Auto-skip when elements don't exist

### 4. Form Design

- **Progressive disclosure**: Show fields as needed based on previous selections
- **Clear validation**: Provide helpful error messages
- **Required vs optional**: Clearly mark required fields

### 5. Cursor Guidance

- **Smooth animations**: Use easing functions for natural movement
- **Clear instructions**: Provide helpful tooltips and descriptions
- **Appropriate delays**: Give users time to read instructions

### 6. Error Handling

- **Graceful degradation**: Handle missing elements and failed API calls
- **User feedback**: Provide clear error messages and recovery options
- **Fallback paths**: Always have alternative flows when possible

### 7. Performance

- **Lazy loading**: Load content only when needed
- **Efficient selectors**: Use specific selectors to avoid conflicts
- **Minimal DOM queries**: Cache element references when possible

## Common Patterns

### Setup Wizard Pattern

```json
{
  "steps": [
    {
      "id": "choice-form",
      "type": "form",
      "conditionalNavigation": { "field": "choice", "branches": { ... } }
    },
    {
      "id": "option-a-step",
      "type": "banner",
      "showOnlyIf": { "field": "choice", "value": "optionA" }
    },
    {
      "id": "option-b-step", 
      "type": "form",
      "showOnlyIf": { "field": "choice", "value": "optionB" }
    }
  ]
}
```

### Guided Navigation Pattern

```json
{
  "steps": [
    {
      "id": "navigate-step",
      "type": "cursor-only",
      "advanceOnClick": { "target": "[data-nav-item='target']" },
      "waitForElement": { "target": "[data-nav-item='target']", "timeout": 10000 }
    },
    {
      "id": "explanation-step",
      "type": "banner",
      "content": { "description": "This is what you'll see here..." }
    }
  ]
}
```

### Celebration Pattern

```json
{
  "steps": [
    {
      "id": "celebration",
      "type": "banner",
      "content": {
        "heading": "🎉 Congratulations!",
        "description": "You've completed the setup!",
        "variant": "success"
      },
      "actions": [
        {
          "text": "Explore Features",
          "action": "nextStep"
        }
      ]
    }
  ]
}
```

---

This guide should be updated whenever new features are added to the onboarding system. For specific implementation details, refer to the main README.md file.
