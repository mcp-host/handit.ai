import onboardingConfig from './config.json';
import userService from '../../services/userService';

class OnboardingService {
  constructor() {
    this.config = onboardingConfig.tourConfig;
    this.currentTour = null;
    this.currentStepIndex = 0;
    this.formValues = {}; // Track form values across steps
    this.userState = {
      loginCount: 1,
      signupCompleted: true,
      hasSkippedWalkthrough: false,
      hasCompletedWalkthrough: false,
      hasIntegratedSDK: false,
      agentType: null,
      agentName: null,
      integrationToken: null,
    };
    this.analytics = [];
    this.listeners = new Map();
  }

  // Initialize the service
  init(userState = {}) {
    this.userState = { ...this.userState, ...userState };
    this.generateIntegrationToken();
    return this;
  }

  // Generate integration token for user
  generateIntegrationToken() {
    if (!this.userState.integrationToken) {
      this.userState.integrationToken = 'hit_' + Math.random().toString(36).substring(2, 15);
    }
  }

  getTourDefinition() {
    return this.config.tours.map((tour, idx) => {
      return {
        id: tour.id,
        label: tour.name,
        tourId: tour.id,
        tourNumber: idx + 1,
        icon: tour.icon || 'Play',
      };
    });
  }

  getTourOrder() {
    const ids = this.config.tours.map((tour) => tour.id);
    const map = {};
    for (let i = 0; i < ids.length; i++) {
      if (i === ids.length - 1) {
        map[ids[i]] = null;
      } else {
        map[ids[i]] = ids[i + 1];
      }
    }
    return map;
  }

  getInitialTourId() {
    return this.config.tours[0].id;
  }

  // Check triggers and return appropriate tour
  checkTriggers() {
    const triggers = this.config.triggers;

    for (const [triggerName, trigger] of Object.entries(triggers)) {
      if (this.evaluateCondition(trigger.condition)) {
        return this.getTour(trigger.tourId);
      }
    }

    return null;
  }

  // Evaluate trigger conditions
  evaluateCondition(condition) {
    const context = {
      user: this.userState,
      events: {
        firstTrace: this.userState.hasIntegratedSDK,
      },
    };

    try {
      // Simple condition evaluation - in production, use a proper expression evaluator
      return eval(condition.replace(/user\./g, 'context.user.').replace(/events\./g, 'context.events.'));
    } catch (error) {
      console.warn('Error evaluating condition:', condition, error);
      return false;
    }
  }

  // Evaluate step conditions for conditional display
  evaluateStepCondition(condition) {
    if (!condition.field || !condition.value) {
      return true;
    }

    // Check form values first, then user state
    const formValue = this.formValues?.[condition.field] || this.userState[condition.field];
    return formValue === condition.value;
  }

  // Get tour by ID
  getTour(tourId) {
    return this.config.tours.find((tour) => tour.id === tourId);
  }

  // Start a tour
  startTour(tourId) {
    const tour = this.getTour(tourId);
    if (!tour) {
      console.error('Tour not found:', tourId);
      return null;
    }

    this.currentTour = tour;
    this.currentStepIndex = 0;
    this.trackEvent('tour_started', { tourId, userId: this.userState.userId });

    return this.getCurrentStep();
  }

  // Get current step
  getCurrentStep() {
    if (!this.currentTour || this.currentStepIndex >= this.currentTour.steps.length) {
      return null;
    }

    const step = this.currentTour.steps[this.currentStepIndex];
    
    // Check if step should be shown based on conditions
    if (step.showOnlyIf && !this.evaluateStepCondition(step.showOnlyIf)) {
      // Skip this step and move to next
      this.currentStepIndex++;
      return this.getCurrentStep();
    }

    return this.processStepContent(step);
  }

  // Process step content with dynamic replacements
  processStepContent(step) {
    const processed = JSON.parse(JSON.stringify(step));

    // Replace dynamic content placeholders
    const replacements = {
      '{{user.agentName}}': this.userState.agentName || 'Your Agent',
      '{{user.agentType}}': this.userState.agentType || 'custom-agent',
      '{{user.integrationToken}}': this.userState.integrationToken,
      '{{recommendedEvaluator.name}}': this.getRecommendedEvaluator()?.name || 'Quality Evaluator',
      '{{recommendedEvaluator.description}}':
        this.getRecommendedEvaluator()?.description || 'Evaluates response quality',
      '{{recommendedEvaluator.defaultCriteria}}':
        this.getRecommendedEvaluator()?.defaultCriteria || 'Check for accuracy and completeness',
    };

    return this.replaceContentRecursively(processed, replacements);
  }

  // Recursively replace content
  replaceContentRecursively(obj, replacements) {
    if (typeof obj === 'string') {
      let result = obj;
      for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      }
      return result;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replaceContentRecursively(item, replacements));
    }

    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceContentRecursively(value, replacements);
      }
      return result;
    }

    return obj;
  }

  // Get recommended evaluator based on agent type
  getRecommendedEvaluator() {
    const agentType = this.userState.agentType || 'custom-agent';
    return this.config.dynamicContent?.recommendedEvaluators?.[agentType];
  }

  // Move to next step
  nextStep() {
    if (!this.currentTour) return null;

    const currentStep = this.getCurrentStep();
    if (currentStep) {
      this.trackEvent('step_completed', {
        tourId: this.currentTour.id,
        stepId: currentStep.id,
        userId: this.userState.userId,
      });

      // Handle conditional navigation
      if (currentStep.conditionalNavigation) {
        const fieldValue = this.formValues[currentStep.conditionalNavigation.field];
        const targetStepId = currentStep.conditionalNavigation.branches[fieldValue];
        
        if (targetStepId) {
          console.log(`Conditional navigation: ${fieldValue} -> ${targetStepId}`);
          const targetStep = this.setCurrentStepById(targetStepId);
          if (targetStep) {
            return targetStep;
          }
        }
      }
    }

    this.currentStepIndex++;

    if (this.currentStepIndex >= this.currentTour.steps.length) {
      this.completeTour();
      return null;
    }

    return this.getCurrentStep();
  }

  // Move to previous step
  previousStep() {
    if (!this.currentTour || this.currentStepIndex <= 0) return null;

    this.currentStepIndex--;
    return this.getCurrentStep();
  }

  // Complete current tour
  completeTour() {
    if (!this.currentTour) return;

    this.trackEvent('tour_completed', {
      tourId: this.currentTour.id,
      userId: this.userState.userId,
    });

    // Update user state based on completed tour
    if (this.currentTour.id === this.getInitialTourId()) {
      this.userState.hasCompletedWalkthrough = true;
    }

    this.currentTour = null;
    this.currentStepIndex = 0;

    // Trigger listeners
    this.emit('tourCompleted', this.currentTour);
  }

  // Transition to next tour without emitting completion event
  async transitionTour() {
    if (!this.currentTour) return;

    this.trackEvent('tour_transitioned', {
      tourId: this.currentTour.id,
      userId: this.userState.userId,
    });

    // Update user state based on completed tour
    if (this.currentTour.id === this.getInitialTourId()) {
      this.userState.hasCompletedWalkthrough = true;
    }

    // Don't emit 'tourCompleted' event during transitions
    console.log('Tour transitioned without UI reset');

    userService.updateOnboardingProgress(this.currentTour.id)
      .then(() => {
        console.log('Onboarding progress updated to next tour:', this.currentTour.id);
      })
      .catch((error) => {
        console.error('Failed to update onboarding progress:', error);
      });


    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  // Skip current tour
  skipTour(reason = 'user_skip') {
    if (!this.currentTour) return;

    this.trackEvent('tour_skipped', {
      tourId: this.currentTour.id,
      stepId: this.getCurrentStep()?.id,
      userId: this.userState.userId,
      reason,
    });

    if (this.currentTour.id === this.getInitialTourId()) {
      this.userState.hasSkippedWalkthrough = true;
    }

    this.currentTour = null;
    this.currentStepIndex = 0;

    this.emit('tourSkipped', { reason });
  }

  // Handle form submissions
  submitForm(stepId, formData) {
    if (stepId === 'agent-type-selection') {
      this.userState = { ...this.userState, ...formData };
      this.trackEvent('integration_completed', {
        userId: this.userState.userId,
        agentType: formData.agentType,
      });
    }

    return this.nextStep();
  }

  // Handle SDK integration
  handleSDKIntegration() {
    this.userState.hasIntegratedSDK = true;
    this.trackEvent('first_trace_received', {
      userId: this.userState.userId,
      traceId: 'trace_' + Date.now(),
    });
  }

  // Handle evaluator creation
  createEvaluator(criteria, threshold) {
    this.trackEvent('evaluator_created', {
      userId: this.userState.userId,
      evaluatorType: this.userState.agentType,
    });

    return this.nextStep();
  }

  // Get terminology based on agent type
  getTerminology() {
    const agentType = this.userState.agentType || 'custom-agent';
    return (
      this.config.personalizations?.agentType?.[agentType]?.terminology || {
        agent: 'AI agent',
        inputs: 'inputs',
        outputs: 'outputs',
      }
    );
  }

  // Get examples based on agent type
  getExamples() {
    const agentType = this.userState.agentType || 'custom-agent';
    return (
      this.config.personalizations?.agentType?.[agentType]?.examples || {
        inputExample: 'user query',
        outputExample: 'agent response',
      }
    );
  }

  // Track analytics events
  trackEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.analytics.push(event);

    if (eventType === 'tour_completed') {
      const nextTourId = data.tourId;
      userService
        .updateOnboardingProgress(nextTourId)
        .then(() => {
          console.log('Onboarding progress updated to next tour:', this.currentTour.id);
        })
        .catch((error) => {
          console.error('Failed to update onboarding progress:', error);
        });
    }
  }

  // Event system
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  emit(eventName, data) {
    const callbacks = this.listeners.get(eventName) || [];
    callbacks.forEach((callback) => callback(data));
  }

  // Get current tour info
  getCurrentTourInfo() {
    if (!this.currentTour) return null;

    return {
      tourId: this.currentTour.id,
      tourName: this.currentTour.name,
      currentStep: this.currentStepIndex + 1,
      totalSteps: this.currentTour.steps.length,
      progress: ((this.currentStepIndex + 1) / this.currentTour.steps.length) * 100,
    };
  }

  // Get current tour
  getCurrentTour() {
    return this.currentTour;
  }

  // Set current step by ID
  setCurrentStepById(stepId) {
    if (!this.currentTour) return null;
    
    const stepIndex = this.currentTour.steps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      this.currentStepIndex = stepIndex;
      return this.getCurrentStep();
    }
    return null;
  }

  // Update form values
  updateFormValue(fieldName, value) {
    this.formValues[fieldName] = value;
    console.log('Updated form values:', this.formValues);
  }

  // Get form values
  getFormValues() {
    return this.formValues;
  }

  // Reset service
  reset() {
    this.currentTour = null;
    this.currentStepIndex = 0;
    this.formValues = {};
    this.analytics = [];
    this.userState = {
      loginCount: 1,
      signupCompleted: true,
      hasSkippedWalkthrough: false,
      hasCompletedWalkthrough: false,
      hasIntegratedSDK: false,
      agentType: null,
      agentName: null,
      integrationToken: null,
    };
  }

  // Clear onboarding state from localStorage
  clearOnboardingState() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboardingState');
    }
  }
}

// Create singleton instance
const onboardingService = new OnboardingService();

export default onboardingService;
