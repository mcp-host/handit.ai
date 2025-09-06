# Onboarding Flow Documentation

This document provides a comprehensive overview of the handit.ai onboarding system, explaining each tour, step, and how to locate them in the configuration file.

## Overview

The onboarding system consists of multiple guided tours that help users understand and set up their autonomous engineer. Each tour is defined in `config.json` with specific steps, triggers, and actions.

## Configuration Structure

The main configuration file is located at:
```
apps/dashboard/src/services/onboarding/config.json
```

### Key Sections:
- **`triggers`**: Defines when each tour should be triggered
- **`tours`**: Contains all tour definitions with their steps
- **`dynamicContent`**: Provides personalized content based on agent type
- **`analytics`**: Defines tracking events
- **`personalizations`**: Agent-specific terminology and examples

## Tour Flow Overview

### 1. Welcome Walkthrough (`welcome-concept-walkthrough`)
**Location**: `config.json` lines 44-95

**Purpose**: Initial welcome and introduction to handit.ai

**Trigger**: 
```json
"firstLogin": {
  "condition": "user.loginCount === 1 && user.signupCompleted === true",
  "tourId": "welcome-concept-walkthrough"
}
```

**Steps**:
1. **Welcome Banner** (lines 66-94)
   - Shows welcome message
   - Single action: "Setup My Engineer" → transitions to `autonomous-engineer-setup`

### 2. Autonomous Engineer Setup (`autonomous-engineer-setup`)
**Location**: `config.json` lines 96-440

**Purpose**: Guide users through setting up their autonomous engineer

**Trigger**:
```json
"wizardSetup": {
  "condition": "user.hasSkippedWalkthrough === true",
  "tourId": "autonomous-engineer-setup"
}
```

**Steps**:
1. **Setup Choice Form** (lines 108-163)
   - Radio buttons: GitHub Setup, CLI Setup, Other
   - Conditional navigation based on choice

2. **GitHub Connect Step** (lines 164-190)
   - Shows GitHub connection instructions
   - Action: Opens GitHub app installation

3. **GitHub Continue Step** (lines 191-224)
   - Success message after GitHub connection
   - Conditional navigation based on setup choice

4. **Repository Selector** (lines 225-279)
   - Shows only if "automatic" setup chosen
   - Form fields: repository, branch, agent file, agent function
   - Action: Calls `/git/assess-and-setup-handit` endpoint

5. **Manual CLI Instructions** (lines 280-316)
   - Shows only if "manual" setup chosen
   - Displays CLI commands
   - Action: "I've Completed Setup"

6. **Expert Contact Step** (lines 317-347)
   - Shows only if "other" setup chosen
   - Action: Opens Calendly scheduling

7. **AI Model Setup Explanation** (lines 348-373)
   - Explains why AI model connection is needed

8. **AI Model Setup Form** (lines 374-412)
   - Form fields: provider, API key
   - Action: Submits model configuration

9. **Setup Complete** (lines 413-439)
   - Success banner
   - Action: "Finish Setup" → triggers `finishTour`

**Important**: This tour explicitly closes onboarding instead of transitioning to the next tour.

### 3. First Trace Tracing & Evaluation (`first-trace-tracing-evaluation`)
**Location**: `config.json` lines 441-837

**Purpose**: Guide users through tracing and evaluation after their first trace

**Trigger**:
```json
"firstTrace": {
  "condition": "user.hasIntegratedSDK === true && events.firstTrace === true && user.hasCompletedWalkthrough === true",
  "tourId": "first-trace-tracing-evaluation"
}
```

**Steps**:
1. **First Trace Celebration** (lines 464-490)
   - Congratulatory banner
   - Action: "Explore Tracing & Evaluation"

2. **Navigate to Tracing** (lines 491-530)
   - Cursor guidance to click Tracing menu
   - Target: `[data-nav-item='Tracing']`
   - Auto-advances on click

3. **Click First Trace** (lines 531-575)
   - Cursor guidance to click first trace row
   - Target: `[data-testid='trace-row-first']`
   - Waits for element with 15s timeout

4. **Trace Execution Explanation** (lines 576-601)
   - Explains the execution flow view

5. **Click Node Details** (lines 602-646)
   - Cursor guidance to click on a node
   - Target: `.react-flow__node:nth-child(2), .react-flow__node:first-child`
   - Prioritizes second node, falls back to first

6. **Node Details Explanation** (lines 647-672)
   - Explains the node details panel

7. **Navigate to Evaluation Suite** (lines 673-712)
   - Cursor guidance to click Evaluation Suite menu
   - Target: `[data-nav-item='Evaluation Suite']`

8. **Evaluation Suite Explanation** (lines 713-738)
   - Explains the evaluation management hub

9. **Click First Evaluator** (lines 739-783)
   - Cursor guidance to click first evaluator
   - Target: `[data-evaluator-index='0']`

10. **Evaluator Configuration Explanation** (lines 784-809)
    - Explains evaluator configuration options

11. **Tour Complete** (lines 810-836)
    - Final celebration banner
    - Action: "Let's Fix Some AI!"

**Important**: This tour explicitly closes onboarding instead of transitioning to the next tour.

### 4. First Optimization Celebration (`first-optimization-celebration`)
**Location**: `config.json` lines 838-889

**Purpose**: Celebrate the user's first AI optimization

**Trigger**:
```json
"firstOptimization": {
  "condition": "user.hasOptimizations === true && user.hasCompletedWalkthrough === true",
  "tourId": "first-optimization-celebration"
}
```

**Steps**:
1. **Optimization Celebration** (lines 862-887)
   - Congratulatory banner with rocket emoji
   - Action: "Explore Optimizations" → triggers `finishTour`

## Key Features

### Cursor Guidance
Many steps include cursor guidance with:
- **Target elements**: CSS selectors for elements to highlight
- **Animation**: Smooth cursor movement with easing
- **Instructions**: Tooltips with helpful text
- **Auto-advance**: Automatically moves to next step on click

### Conditional Navigation
Some steps have conditional navigation based on form data:
```json
"conditionalNavigation": {
  "field": "setupChoice",
  "branches": {
    "automatic": "github-connect-step",
    "manual": "manual-cli-instructions",
    "other": "expert-contact-step"
  }
}
```

### Element Targeting
Steps use various targeting strategies:
- **Data attributes**: `[data-nav-item='Tracing']`, `[data-testid='trace-row-first']`
- **CSS selectors**: `.react-flow__node:nth-child(2), .react-flow__node:first-child`
- **Index-based**: `[data-evaluator-index='0']`

### Wait for Elements
Some steps wait for elements to appear:
```json
"waitForElement": {
  "target": "[data-testid='trace-row-first']",
  "timeout": 15000,
  "checkInterval": 1000
}
```

## Integration Points

### Layout Integration
The main layout (`apps/dashboard/src/app/(dashboard)/layout.js`) handles:
- Automatic tour triggering based on user state
- Optimization checking and celebration tour triggering
- Event dispatching for tour starts

### OnboardingOrchestrator
The orchestrator (`apps/dashboard/src/components/onboarding/OnboardingOrchestrator.js`) manages:
- Tour state and navigation
- Step rendering and interactions
- Event handling and completion tracking

### API Endpoints
- **Optimization Check**: `GET /api/users/me/optimizations` - Returns optimization status and PR information
- **GitHub Setup**: `POST /git/assess-and-setup-handit`
- **Repository Branches**: `GET /git/repository-branches`
- **Repository Files**: `GET /git/repository-files`
- **Model Setup**: Various model-related endpoints

## Optimization Flows

### First Optimization Celebration
**Tour ID**: `first-optimization-celebration`  
**Trigger**: User has optimizations  
**Steps**: 
1. **Celebration banner** with "Check Optimization" action → **Conditional Navigation**
2. **If PRs exist**: PR ready banner with "View PR" action → **Opens PR and completes tour**
3. **If no PRs**: Navigate to Release Hub with cursor guidance and skip button
4. **If no PRs**: Click first optimized model with cursor guidance and skip button
5. **If no PRs**: Optimization comparison guide banner → **Complete**

### Conditional Logic
The tour uses `showOnlyIf` conditions to show steps based on PR presence:
- `hasOptimizationPRs: true` → Shows PR banner, skips walkthrough steps
- `hasOptimizationPRs: false` → Shows walkthrough steps (Release Hub → Model → Comparison), skips PR banner

### Skip Logic
The optimization walkthrough includes robust skip mechanisms:
- **Auto-skip**: Elements not found within timeout automatically advance to next step
- **Manual skip**: Skip buttons on cursor-only steps allow users to bypass navigation
- **Walkthrough skip**: Intro banner allows users to skip the entire walkthrough
- **Element targeting**: Uses `waitForElement` with timeouts for reliable element detection

## Development Guidelines

### Adding New Tours
1. Add trigger condition in `triggers` section
2. Define tour structure in `tours` array
3. Implement steps with proper targeting
4. Add analytics events if needed
5. Update layout logic for triggering

### Modifying Existing Steps
1. Locate the step in the config file using line numbers above
2. Modify the step definition
3. Test cursor guidance and element targeting
4. Update any related logic in OnboardingOrchestrator

### Element Targeting Best Practices
- Use data attributes when possible (`data-testid`, `data-nav-item`)
- Provide fallback selectors for robustness
- Test selectors in different states (loading, empty, populated)
- Use specific selectors to avoid conflicts

### Analytics Integration
Each action can include analytics tracking:
```json
"analytics": "first_trace_celebration_continue"
```

## Troubleshooting

### Common Issues
1. **Cursor not moving**: Check element selectors and ensure elements exist
2. **Tour not triggering**: Verify trigger conditions and user state
3. **Steps not advancing**: Check `advanceOnClick` targets and `waitForElement` settings
4. **Infinite loops**: Ensure proper dependency management in useEffect hooks

### Debug Tips
- Check browser console for onboarding service logs
- Verify element selectors in browser dev tools
- Test trigger conditions with different user states
- Use React DevTools to inspect onboarding state

## Future Enhancements

### Potential Additions
- More personalized content based on agent type
- Additional celebration tours for milestones
- Integration with more external services
- Enhanced analytics and user behavior tracking
- A/B testing for different onboarding flows

### Configuration Extensions
- Dynamic content loading
- Multi-language support
- Theme customization
- Advanced conditional logic
- Integration with external APIs for dynamic content

---

This documentation should be updated whenever the onboarding flow is modified to ensure it remains accurate and helpful for future development.
