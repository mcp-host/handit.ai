import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import onboardingService from '../../services/onboarding/onboardingService';
import { useGetProvidersQuery } from '../../services/providerService';
import { useCreateIntegrationTokenMutation } from '../../services/integrationTokenService';
import { OnboardingAssistant, OnboardingMenu, useInvisibleMouse, useOnboardingBanners } from './index';



const OnboardingOrchestrator = ({
  autoStart = false,
  triggerOnMount = true,
  userState = {},
  enableAutomaticStart = true,
  isLoadingAutomaticStart = false,
  onComplete = () => {},
  onSkip = () => {},
  updateOnboardingProgress = () => {},
}) => {
  // Core state
  const [isActive, setIsActive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [tourInfo, setTourInfo] = useState(null);
  const [formData, setFormData] = useState({});
  const [formValues, setFormValues] = useState({}); // Form values for all steps
  
  // AI Model Setup hooks
  const { data: providers = [] } = useGetProvidersQuery();
  const [createIntegrationToken] = useCreateIntegrationTokenMutation();

  // Component states
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [chatIsOpen, setChatIsOpen] = useState(false); // Track chat state
  const banners = useOnboardingBanners();
  const mouse = useInvisibleMouse();

  // Ref to track if we've already started onboarding for a new user
  const hasStartedNewUserOnboarding = useRef(false);

  // Trigger highlighting when mouse targets a menu item
  const highlightMenuItem = (menuTitle) => {
    window.dispatchEvent(
      new CustomEvent('onboardingMouseTarget', {
        detail: { menuTitle },
      })
    );
  };

  // Remove highlighting when mouse leaves a menu item
  const unhighlightMenuItem = () => {
    window.dispatchEvent(new CustomEvent('onboardingMouseLeave'));
  };

  // Tour completion handler
  const handleTourComplete = useCallback(() => {
    // Mark tour as complete in the service
    onboardingService.completeTour('tour_complete');
    
    setIsActive(false);
    setMenuOpen(false);
    setCurrentStep(null);
    setTourInfo(null);
    setAssistantVisible(false);

    // Remove any highlighting
    unhighlightMenuItem();

    // Hide mouse and banners
    mouse.hideMouse();
    banners.hideAllBanners();

    // Clear global onboarding flag and localStorage
    window.__onboardingActive = false;
    localStorage.removeItem('onboardingState');
    window.dispatchEvent(
      new CustomEvent('onboardingStateChange', {
        detail: { active: false },
      })
    );

    onComplete();
  }, [mouse, banners, onComplete]);

  // Helper function to handle tour completion with next tour checking
  const handleTourEndWithNextTourCheck = useCallback(
    (forceNextTour = false) => {
      // Check if there are more steps in current tour
      if (onboardingService.getCurrentStep() && !forceNextTour) {
        // Still have steps, don't complete
        return;
      }


      // No more steps in current tour, check if there's a next tour
      const currentTourId = tourInfo?.tourId;
      let nextTourId = null;

      // Define the tour progression order
      const tourOrder = onboardingService.getTourOrder();

      nextTourId = tourOrder[currentTourId];
      window.dispatchEvent(
        new CustomEvent('onboarding:change-tour', {
          detail: { tourId: nextTourId },
        })
      );

      if (nextTourId) {
        // Special case: If we just completed autonomous-engineer-setup, always close onboarding
        // Don't automatically transition to first-trace-tracing-evaluation
        if (currentTourId === 'autonomous-engineer-setup') {
          console.log('Completed autonomous-engineer-setup, closing onboarding instead of transitioning to:', nextTourId);
          handleTourComplete();
          return;
        }
        
        // Special case: If we just completed first-trace-tracing-evaluation, always close onboarding
        // Don't automatically transition to first-optimization-celebration
        if (currentTourId === 'first-trace-tracing-evaluation') {
          console.log('Completed first-trace-tracing-evaluation, closing onboarding instead of transitioning to:', nextTourId);
          handleTourComplete();
          return;
        }
        
        // Check if the next tour should actually be started
        // For first-trace-tracing-evaluation, only start if user hasn't completed it and meets trigger conditions
        if (nextTourId === 'first-trace-tracing-evaluation') {
          // Check if user has already completed this tour or doesn't meet trigger conditions
          const suggestedTour = onboardingService.checkTriggers();
          if (!suggestedTour || suggestedTour.id !== 'first-trace-tracing-evaluation') {
            // Don't start the first trace tour, complete onboarding instead
            handleTourComplete();
            return;
          }
        }
        
        // There's a next tour, advance to it
        onboardingService.transitionTour();
        const nextStep = onboardingService.startTour(nextTourId);
        if (nextStep) {
          setCurrentStep(nextStep);
          const tourInfo = onboardingService.getCurrentTourInfo();
          setTourInfo(tourInfo);

          // Show assistant if tour settings specify it
          if (tourInfo?.settings?.showAssistant) {
            setAssistantVisible(true);
          }

          // Update user's onboarding progress in database
          updateOnboardingProgress(nextTourId);

          // Update localStorage with new tour state
          const onboardingState = {
            isActive: true,
            tourId: nextTourId,
            currentStepId: nextStep.id,
            assistantVisible: tourInfo?.settings?.showAssistant || false,
          };
          localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
        }
      } else {
        // No more tours, complete all tours
        handleTourComplete();
      }
    },
    [tourInfo, handleTourComplete, updateOnboardingProgress]
  );

  // Tour skip handler
  const handleTourSkip = useCallback(() => {
    setIsActive(false);
    setMenuOpen(false);
    setCurrentStep(null);
    setTourInfo(null);
    setAssistantVisible(false);

    // Remove any highlighting
    unhighlightMenuItem();

    // Hide mouse and banners
    mouse.hideMouse();
    banners.hideAllBanners();

    // Clear global onboarding flag and localStorage
    window.__onboardingActive = false;
    localStorage.removeItem('onboardingState');
    window.dispatchEvent(
      new CustomEvent('onboardingStateChange', {
        detail: { active: false },
      })
    );

    onSkip();
  }, [mouse, banners, onSkip]);

  // Start onboarding flow
  const startOnboarding = useCallback((tourId = onboardingService.getInitialTourId(), optimizationData = {}) => {
    // Set optimization data in onboarding service for conditional navigation
    if (optimizationData.hasOptimizationPRs !== undefined) {
      onboardingService.formValues.hasOptimizationPRs = optimizationData.hasOptimizationPRs;
    }
    
    const step = onboardingService.startTour(tourId);
    
    if (step) {
      setCurrentStep(step);
      const tourInfo = onboardingService.getCurrentTourInfo();
      setTourInfo(tourInfo);
      setIsActive(true);

      // Show assistant if tour settings specify it
      if (tourInfo?.settings?.showAssistant) {
        setAssistantVisible(true);
      }

      // Update user's onboarding progress in database
      updateOnboardingProgress(tourId);

      // Persist onboarding state to localStorage
      const onboardingState = {
        isActive: true,
        tourId: tourId,
        currentStepId: step.id,
        assistantVisible: tourInfo?.settings?.showAssistant || false,
      };
      localStorage.setItem('onboardingState', JSON.stringify(onboardingState));

      // Set global onboarding flag for layout components
      window.__onboardingActive = true;
      window.dispatchEvent(
        new CustomEvent('onboardingStateChange', {
          detail: { active: true },
        })
      );
    }
  }, []);

  // Persist state when step changes
  useEffect(() => {
    if (isActive && currentStep) {
      const onboardingState = {
        isActive: true,
        tourId: tourInfo?.tourId,
        currentStepId: currentStep.id,
        assistantVisible: assistantVisible,
      };
      localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
    }
  }, [isActive, currentStep, tourInfo, assistantVisible]);

  // Restore onboarding state on page load
  useEffect(() => {
    const savedState = localStorage.getItem('onboardingState');
    if (savedState && !isActive) {
      try {
        const state = JSON.parse(savedState);
        if (state.isActive) {
          // Add a small delay to ensure the page is fully loaded
          setTimeout(() => {
            // Restore the tour from the saved step
            const step = onboardingService.startTour(state.tourId);
            if (step) {
              // Navigate to the correct step
              let currentStepInService = step;
              while (currentStepInService && currentStepInService.id !== state.currentStepId) {
                onboardingService.nextStep();
                currentStepInService = onboardingService.getCurrentStep();
                if (!currentStepInService || currentStepInService.id === step.id) break;
              }

              const restoredStep = onboardingService.getCurrentStep();
              if (restoredStep) {
                setCurrentStep(restoredStep);
                setTourInfo(onboardingService.getCurrentTourInfo());
                setIsActive(true);
                setAssistantVisible(state.assistantVisible);

                // Set global flag
                window.__onboardingActive = true;
                window.dispatchEvent(
                  new CustomEvent('onboardingStateChange', {
                    detail: { active: true },
                  })
                );
              }
            }
          }, 500); // Small delay to ensure DOM is ready
        }
      } catch (error) {
        console.error('Error restoring onboarding state:', error);
        localStorage.removeItem('onboardingState');
      }
    }
  }, []);

  // Also check for state restoration when the component updates
  useEffect(() => {
    if (!isActive) {
      const savedState = localStorage.getItem('onboardingState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          if (state.isActive && !isActive) {
            // Trigger restoration
            setTimeout(() => {
              const step = onboardingService.getCurrentStep();
              if (!step) {
                // Service needs to be reinitialized
                const restoredStep = onboardingService.startTour(state.tourId);
                if (restoredStep) {
                  // Navigate to correct step
                  let currentStepInService = restoredStep;
                  while (currentStepInService && currentStepInService.id !== state.currentStepId) {
                    onboardingService.nextStep();
                    currentStepInService = onboardingService.getCurrentStep();
                    if (!currentStepInService) break;
                  }

                  const finalStep = onboardingService.getCurrentStep();
                  if (finalStep) {
                    setCurrentStep(finalStep);
                    setTourInfo(onboardingService.getCurrentTourInfo());
                    setIsActive(true);
                    setAssistantVisible(state.assistantVisible);

                    window.__onboardingActive = true;
                    window.dispatchEvent(
                      new CustomEvent('onboardingStateChange', {
                        detail: { active: true },
                      })
                    );
                  }
                }
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error in state restoration check:', error);
        }
      }
    }
  }, [isActive]);

  // Listen for chat open/close events to hide/show onboarding elements
  useEffect(() => {
    const handleChatOpened = () => {
      setChatIsOpen(true);
      // Hide all banners when chat opens
      banners.hideAllBanners();
    };

    const handleChatClosed = () => {
      setChatIsOpen(false);
      // Banners will be restored automatically by the onboarding flow
      
      // Check if we should advance to next step when chat closes
      if (currentStep?.id === 'open-evaluators-chat') {
        // Advance to next step
        onboardingService.nextStep();
        const nextStep = onboardingService.getCurrentStep();

        if (nextStep) {
          // Update state and localStorage for the next step
          setCurrentStep(nextStep);
          setTourInfo(onboardingService.getCurrentTourInfo());

          const onboardingState = {
            isActive: true,
            tourId: tourInfo?.tourId,
            currentStepId: nextStep.id,
            assistantVisible: assistantVisible,
          };
          localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
        } else {
          // No more steps, complete tour
          handleTourEndWithNextTourCheck();
        }
      }
    };

    const handleEvaluatorsDetected = () => {
      // Check if onboarding is currently active
      if (isActive && currentStep) {
        // Small delay to show the message, then auto-close chat and advance
        setTimeout(() => {
          // Tell the chat component to close itself
          window.dispatchEvent(new CustomEvent('onboarding:close-chat'));
        }, 2000); // 2 second delay to let user see the confirmation
      }
    };

    window.addEventListener('onboarding:chat-opened', handleChatOpened);
    window.addEventListener('onboarding:chat-closed', handleChatClosed);
    window.addEventListener('onboarding:evaluators-detected', handleEvaluatorsDetected);

    return () => {
      window.removeEventListener('onboarding:chat-opened', handleChatOpened);
      window.removeEventListener('onboarding:chat-closed', handleChatClosed);
      window.removeEventListener('onboarding:evaluators-detected', handleEvaluatorsDetected);
    };
  }, [banners, currentStep, tourInfo, assistantVisible, handleTourEndWithNextTourCheck, isActive]);

  // Global flag to force navigation open only when assistant is visible
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const showAssistant = assistantVisible || (currentStep && isActive);
      window.__onboardingActive = showAssistant;

      // Trigger a custom event so layout can listen for changes
      window.dispatchEvent(
        new CustomEvent('onboardingStateChange', {
          detail: { active: showAssistant },
        })
      );
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.__onboardingActive = false;
        window.dispatchEvent(
          new CustomEvent('onboardingStateChange', {
            detail: { active: false },
          })
        );
      }
    };
  }, [assistantVisible, currentStep, isActive]);

  // Handle connection success event
  const handleConnectionSuccess = useCallback(
    (event) => {
      console.log('handleConnectionSuccess', event);
      console.log('currentStep', currentStep);
      // Check if we should advance: either on the test-connection-button step or on docs page during onboarding
      const shouldAdvance = (
        currentStep?.id === 'test-connection-button' || 
        (window.location.pathname === '/docs' && currentStep && event.detail?.success)
      ) && event.detail?.success;
      
      if (shouldAdvance) {
        // Remove highlighting
        console.log('unhighlightMenuItem');
        unhighlightMenuItem();

        // Hide instruction banners
        banners.hideAllBanners();

        // Advance to next step
        onboardingService.nextStep();
        const nextStep = onboardingService.getCurrentStep();

        if (nextStep) {
          // Update state and localStorage for the next step
          setCurrentStep(nextStep);
          setTourInfo(onboardingService.getCurrentTourInfo());

          const onboardingState = {
            isActive: true,
            tourId: tourInfo?.tourId,
            currentStepId: nextStep.id,
            assistantVisible: assistantVisible,
          };
          localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
        } else {
          // No more steps, complete tour
          handleTourEndWithNextTourCheck();
        }
      }
    },
    [currentStep, tourInfo, assistantVisible, banners, handleTourEndWithNextTourCheck]
  );

  // Handle loading state changes to prevent banner re-renders
  const handleLoadingStateChange = useCallback((event) => {
    // Don't re-render banners during loading states
    if (event.detail?.loading) {
      // Prevent banner updates during loading
      return;
    }
  }, []);

  // Handle step change events
  const handleStepChanged = useCallback((event) => {
    const { step } = event.detail;
    if (step) {
      setCurrentStep(step);
      setTourInfo(onboardingService.getCurrentTourInfo());

      // Update localStorage with new step
      const onboardingState = {
        isActive: true,
        tourId: tourInfo?.id || onboardingService.getCurrentTourInfo()?.id,
        currentStepId: step.id,
        assistantVisible: assistantVisible,
      };
      localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
    }
  }, [tourInfo, assistantVisible]);

  // Initialize service
  useEffect(() => {
    onboardingService.init(userState);

    // Listen for tour events
    onboardingService.on('tourCompleted', handleTourEndWithNextTourCheck);
    onboardingService.on('tourSkipped', handleTourSkip);

    // Listen for onboarding menu trigger from sidebar
    const handleOpenOnboardingMenu = () => {
      setIsActive(true);
      setMenuOpen(true);
    };

    window.addEventListener('openOnboardingMenu', handleOpenOnboardingMenu);
    window.addEventListener('onboarding:connection-success', handleConnectionSuccess);
    window.addEventListener('onboarding:loading-state-change', handleLoadingStateChange);
    window.addEventListener('onboarding:step-changed', handleStepChanged);
    
    // Listen for direct tour start events
    const handleStartTourEvent = (event) => {
      const { tourId, optimizationPRs, optimizedModels, hasOptimizationPRs } = event.detail;
      
      // Store event detail globally for action handlers to access
      window.lastOnboardingEventDetail = event.detail;
      
      // Store optimization data for conditional navigation
      if (hasOptimizationPRs !== undefined) {
        formValues.hasOptimizationPRs = hasOptimizationPRs;
      }
      
      if (tourId) {
        // Clear any existing onboarding state before starting new tour
        setIsActive(false);
        setMenuOpen(false);
        setCurrentStep(null);
        setTourInfo(null);
        setAssistantVisible(false);
        
        // Clear localStorage state
        localStorage.removeItem('onboardingState');
        
        // Clear any highlighting and banners
        unhighlightMenuItem();
        mouse.hideMouse();
        banners.hideAllBanners();
        
        // Start the new tour with optimization data
        startOnboarding(tourId, { hasOptimizationPRs });
      }
    };
    window.addEventListener('onboarding:start-tour', handleStartTourEvent);

    // Check if user is new (onboardingCurrentTour is null) and start onboarding immediately
    // Only start if we haven't already started onboarding for this new user
    // AND automatic start is enabled (passed from parent to determine business logic)
    if (userState.onboardingCurrentTour === null && !hasStartedNewUserOnboarding.current && enableAutomaticStart && !isLoadingAutomaticStart) {
      console.log('starting onboarding');
      hasStartedNewUserOnboarding.current = true;
      
      // Use trigger system to determine which tour to start
      const suggestedTour = onboardingService.checkTriggers();
      const tourId = suggestedTour ? suggestedTour.id : 'welcome-concept-walkthrough';
      
      console.log('Starting tour based on triggers:', tourId);
      startOnboarding(tourId);
      window.dispatchEvent(new CustomEvent('onboarding:start-tour', {
        detail: { tourId: tourId },
      }));
      return;
    }

    // Auto-trigger if enabled
    if (triggerOnMount) {
      const suggestedTour = onboardingService.checkTriggers();
      if (suggestedTour && autoStart) {
        startOnboarding('autonomous-engineer-setup');
        return;
      }
    }

    // Direct start if autoStart is true (bypass triggers entirely)
    if (autoStart) {
      startOnboarding('autonomous-engineer-setup');
    }

    return () => {
      // Cleanup listeners
      window.removeEventListener('openOnboardingMenu', handleOpenOnboardingMenu);
      window.removeEventListener('onboarding:connection-success', handleConnectionSuccess);
      window.removeEventListener('onboarding:loading-state-change', handleLoadingStateChange);
      window.removeEventListener('onboarding:step-changed', handleStepChanged);
      window.removeEventListener('onboarding:start-tour', handleStartTourEvent);
    };
      }, [userState, autoStart, triggerOnMount, enableAutomaticStart, isLoadingAutomaticStart, handleConnectionSuccess, handleLoadingStateChange, handleStepChanged]);
  // Navigation functions
  const handleNext = useCallback(() => {
    // Clear any existing banners and highlighting before advancing
    banners.hideAllBanners();
    unhighlightMenuItem();

    // Let the service handle navigation logic (including conditional branching)
    const nextStep = onboardingService.nextStep();
    
    if (nextStep) {
      setCurrentStep(nextStep);
      setTourInfo(onboardingService.getCurrentTourInfo());
    } else {
      // No more steps, handle tour completion
      console.log('handleNext: No more steps, current tour:', tourInfo?.tourId);
      handleTourEndWithNextTourCheck();
    }
  }, [banners, handleTourEndWithNextTourCheck, tourInfo]);

  const handlePrevious = useCallback(() => {
    // Clear any existing banners and highlighting before going back
    banners.hideAllBanners();
    unhighlightMenuItem();

    onboardingService.previousStep();
    setCurrentStep(onboardingService.getCurrentStep());
    setTourInfo(onboardingService.getCurrentTourInfo());
  }, [banners]);

  const handleSkip = useCallback(() => {
    onboardingService.skipTour('user_skip');
    handleTourSkip();
  }, [handleTourSkip]);

  const handleFinish = useCallback(() => {
    onboardingService.completeTour('tour_complete');
    handleTourEndWithNextTourCheck(true);
  }, [handleTourEndWithNextTourCheck]);

  // Form handling
  const handleFormSubmit = useCallback(
    (stepId, data) => {
      const nextStep = onboardingService.submitForm(stepId, data);
      setCurrentStep(nextStep);
      setTourInfo(onboardingService.getCurrentTourInfo());
      setFormData({ ...formData, ...data });
    },
    [formData]
  );

  // Form change handler
  const handleFormChange = useCallback((fieldName, value) => {
    console.log('🔍 handleFormChange called:', fieldName, value);
    console.log('🔍 Previous formValues:', formValues);
    setFormValues(prev => {
      const newValues = { ...prev, [fieldName]: value };
      console.log('🔍 New formValues:', newValues);
      return newValues;
    });
    // Also update the service's form values
    onboardingService.updateFormValue(fieldName, value);
    console.log('🔍 Service form values updated');
  }, [formValues]);

  // Execute cursor guidance when a step changes
  const executeCursorGuidance = useCallback((step) => {
    if (!step.cursorGuidance?.enabled) return;

    const guidance = step.cursorGuidance;
    let currentStepIndex = 0;

    const executeGuidanceStep = () => {
      if (currentStepIndex >= guidance.steps.length) {
        return;
      }

      const guidanceStep = guidance.steps[currentStepIndex];

      // Find the target element
      const targetElement = findTargetElement(guidanceStep.target, guidanceStep.targetText);
      if (!targetElement) {
        console.warn('Target element not found for guidance step:', guidanceStep);
        return;
      }

      // Remove highlighting from previous target
      if (currentStepIndex > 0) {
        unhighlightMenuItem();
      }

      // Execute smooth cursor animation to target (from current position)
      const mousePosition = mouse.animateToElement(guidanceStep.target, {
        duration: 2000,
        onComplete: () => {
          // Highlight the target menu item when mouse reaches it
          const menuTitle = targetElement.getAttribute('data-nav-item');
          if (menuTitle) {
            highlightMenuItem(menuTitle);
          }
        },
      });

      if (mousePosition) {
        // Show instruction banner after animation completes
        if (guidanceStep.instruction) {
          setTimeout(() => {
            const rect = targetElement.getBoundingClientRect();
            const position = calculateBannerPosition(rect, guidanceStep.instruction.position);

            banners.showBanner({
              title: guidanceStep.instruction.title,
              message: guidanceStep.instruction.description,
              position,
              variant: 'info',
              autoHide: guidanceStep.instruction.actions ? false : true,
              autoHideDelay: guidanceStep.instruction.actions ? 0 : 12000,
              showCloseButton: false,
              actions: guidanceStep.instruction.actions?.map((action) => ({
                text: action.text,
                type: action.type,
                onClick: () => {
                  // Hide current banner immediately when any action is clicked
                  banners.hideAllBanners();
                  console.log('action', action);
                  if (action.action === 'nextStep') {
                    // Handle special case for closing connect dialog
                    if (currentStep?.id === 'close-connect-dialog') {
                      // Dispatch event to close connect dialog
                      window.dispatchEvent(new CustomEvent('onboarding:close-connect-dialog'));

                      // Small delay to allow dialog to close before advancing
                      setTimeout(() => {
                        onboardingService.nextStep();
                        setCurrentStep(onboardingService.getCurrentStep());
                        setTourInfo(onboardingService.getCurrentTourInfo());

                        if (!onboardingService.getCurrentStep()) {
                          updateOnboardingProgress(action.nextTourId);

                          handleTourEndWithNextTourCheck();
                        }
                      }, 500);
                    } else {

                      // Directly advance step without causing re-renders
                      onboardingService.nextStep();
                      setCurrentStep(onboardingService.getCurrentStep());
                      setTourInfo(onboardingService.getCurrentTourInfo());

                      if (!onboardingService.getCurrentStep()) {
                        updateOnboardingProgress(action.nextTourId);

                        handleTourEndWithNextTourCheck();
                      }
                    }
                  } else if (action.action === 'skipTour') {
                    onboardingService.skipTour('user_skip');
                    handleTourSkip();
                  } else if (action.action === 'nextTour') {
                    // Use transition method to avoid emitting completion event
                    onboardingService.transitionTour();
                    const nextStep = onboardingService.startTour(action.nextTourId);
                    console.log('nextStep', nextStep);
                    console.log('action.nextTourId', action);
                    if (nextStep) {
                      setCurrentStep(nextStep);
                      const tourInfo = onboardingService.getCurrentTourInfo();
                      setTourInfo(tourInfo);

                      console.log('action.nextTourId', action.nextTourId);
                      window.dispatchEvent(
                        new CustomEvent('onboarding:change-tour', {
                          detail: { tourId: action.nextTourId },
                        })
                      );

                      // Show assistant if tour settings specify it
                      if (tourInfo?.settings?.showAssistant) {
                        setAssistantVisible(true);
                      }

                      // Update localStorage with new tour state
                      const onboardingState = {
                        isActive: true,
                        tourId: action.nextTourId,
                        currentStepId: nextStep.id,
                        assistantVisible: tourInfo?.settings?.showAssistant || false,
                      };
                      localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
                    }
                  } else if (action.action === 'finishTour') {
                    // Special case: If we're finishing autonomous-engineer-setup, close onboarding directly
                    if (tourInfo?.tourId === 'autonomous-engineer-setup') {
                      console.log('Finishing autonomous-engineer-setup via finishTour action, closing onboarding');
                      onboardingService.completeTour('tour_complete');
                      handleTourComplete();
                    } else {
                      onboardingService.completeTour('tour_complete');
                      handleTourEndWithNextTourCheck();
                    }
                  }
                },
              })),
            });
          }, 1800); // Reduced delay for faster appearance
        }

        // Move to next step after delay
        setTimeout(() => {
          currentStepIndex++;
          executeGuidanceStep();
        }, guidance.steps[currentStepIndex].delay || 100);
      }
    };

    // Start guidance execution after initial delay
    setTimeout(executeGuidanceStep, guidance.delay || 500);
  }, []);

  // Helper function to find target elements
  const findTargetElement = (selector, targetText) => {
    if (targetText) {
      // Find element containing specific text
      const elements = document.querySelectorAll(selector);
      for (let element of elements) {
        if (element.textContent?.includes(targetText)) {
          return element;
        }
      }
    }

    const element = document.querySelector(selector);
    return element;
  };

  // Helper function to calculate banner position
  const calculateBannerPosition = (elementRect, position) => {
    const offset = 20;

    switch (position) {
      case 'right':
        return { top: elementRect.top, left: elementRect.right + offset };
      case 'left':
        return { top: elementRect.top, left: elementRect.left - 300 - offset };
      case 'bottom':
        return { top: elementRect.bottom + offset, left: elementRect.left };
      case 'top':
        return { top: elementRect.top - 120 - offset, left: elementRect.left };
      default:
        return { top: elementRect.top, left: elementRect.right + offset };
    }
  };

  // Execute cursor guidance when step changes
  useEffect(() => {
    if (currentStep && currentStep.type === 'cursor-only') {
      // Handle waitForElement if specified
      if (currentStep.waitForElement) {
        const checkForElement = () => {
          const element = document.querySelector(currentStep.waitForElement.target);
          if (element) {
            // Element found, proceed with the step
            // Handle scrollIntoView if specified
            if (currentStep.scrollIntoView) {
              const targetElement = document.querySelector(currentStep.scrollIntoView.target);
              if (targetElement) {
                targetElement.scrollIntoView({
                  behavior: currentStep.scrollIntoView.behavior || 'smooth',
                  block: currentStep.scrollIntoView.block || 'center',
                  inline: currentStep.scrollIntoView.inline || 'nearest',
                });
              }
            }

            // Mouse will be shown during animation - no need to show immediately
            executeCursorGuidance(currentStep);
          } else {
            // Element not found, check again after interval
            setTimeout(checkForElement, currentStep.waitForElement.checkInterval || 1000);
          }
        };

        // Start checking for element with timeout
        const timeoutId = setTimeout(() => {
          // Auto-skip to next step when element is not found within timeout
          onboardingService.nextStep();
          setCurrentStep(onboardingService.getCurrentStep());
          setTourInfo(onboardingService.getCurrentTourInfo());
        }, currentStep.waitForElement.timeout || 10000);

        checkForElement();

        return () => clearTimeout(timeoutId);
      } else {
        // Handle scrollIntoView if specified
        if (currentStep.scrollIntoView) {
          const targetElement = document.querySelector(currentStep.scrollIntoView.target);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: currentStep.scrollIntoView.behavior || 'smooth',
              block: currentStep.scrollIntoView.block || 'center',
              inline: currentStep.scrollIntoView.inline || 'nearest',
            });
          }
        }

        // Mouse will be shown during animation - no need to show immediately
        executeCursorGuidance(currentStep);
      }
    }
  }, [currentStep, executeCursorGuidance]);

  // Set up click listeners for advanceOnClick targets
  useEffect(() => {
    if (currentStep && currentStep.advanceOnClick) {
      const handleTargetClick = (event) => {
        // Check if the clicked element or any parent matches our target
        let target = event.target.closest(currentStep.advanceOnClick.target);
        
        // If not found with closest, try direct match
        if (!target && event.target.matches && event.target.matches(currentStep.advanceOnClick.target)) {
          target = event.target;
        }
        if (target) {
          // Remove highlighting when user clicks (mouse will move to next target)
          unhighlightMenuItem();

          // Hide instruction banners when user clicks menu item (but keep center banners)
          banners.hideAllBanners();

          // Add delay if specified
          const delay = currentStep.advanceDelay || 0;

          setTimeout(() => {
            // Advance to next step BEFORE navigation happens
            onboardingService.nextStep();
            const nextStep = onboardingService.getCurrentStep();

            if (nextStep) {
              // Update state and localStorage for the next step
              setCurrentStep(nextStep);
              setTourInfo(onboardingService.getCurrentTourInfo());

              const onboardingState = {
                isActive: true,
                tourId: tourInfo?.tourId,
                currentStepId: nextStep.id,
                assistantVisible: assistantVisible,
              };
              localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
            } else {
              // No more steps, complete tour
              handleTourEndWithNextTourCheck();
            }
          }, delay);
        }
      };

      // Add click listener to document
      document.addEventListener('click', handleTargetClick);

      // Cleanup
      return () => {
        document.removeEventListener('click', handleTargetClick);
      };
    }
  }, [currentStep, banners, tourInfo, assistantVisible, handleTourEndWithNextTourCheck]);

  // Set up change listeners for advanceOnChange targets
  useEffect(() => {
    if (currentStep && currentStep.advanceOnChange) {
      const handleTargetChange = (event) => {
        const target = event.target.closest(currentStep.advanceOnChange.target);
        // Also check if the event target itself matches or if it's a child of the target
        const directTarget = document.querySelector(currentStep.advanceOnChange.target);
        const isWithinTarget = directTarget && (directTarget.contains(event.target) || event.target === directTarget);

        if (target || isWithinTarget) {
          // Remove highlighting when user makes selection
          unhighlightMenuItem();

          // Hide instruction banners
          banners.hideAllBanners();

          // Add delay if specified
          const delay = currentStep.advanceDelay || 1000; // Default 1s delay for form changes

          setTimeout(() => {
            // Advance to next step
            onboardingService.nextStep();
            const nextStep = onboardingService.getCurrentStep();

            if (nextStep) {
              // Update state and localStorage for the next step
              setCurrentStep(nextStep);
              setTourInfo(onboardingService.getCurrentTourInfo());

              const onboardingState = {
                isActive: true,
                tourId: tourInfo?.tourId,
                currentStepId: nextStep.id,
                assistantVisible: assistantVisible,
              };
              localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
            } else {
              // No more steps, complete tour
              handleTourEndWithNextTourCheck();
            }
          }, delay);
        }
      };

      // Also try with input event for better MUI compatibility
      const handleTargetInput = (event) => {
        const target = event.target.closest(currentStep.advanceOnChange.target);
        // Also check if the event target itself matches or if it's a child of the target
        const directTarget = document.querySelector(currentStep.advanceOnChange.target);
        const isWithinTarget = directTarget && (directTarget.contains(event.target) || event.target === directTarget);

        if (target || isWithinTarget) {
          // Remove highlighting when user makes selection
          unhighlightMenuItem();

          // Hide instruction banners
          banners.hideAllBanners();

          // Add delay if specified
          const delay = currentStep.advanceDelay || 1000; // Default 1s delay for form changes

          setTimeout(() => {
            // Advance to next step
            onboardingService.nextStep();
            const nextStep = onboardingService.getCurrentStep();

            if (nextStep) {
              // Update state and localStorage for the next step
              setCurrentStep(nextStep);
              setTourInfo(onboardingService.getCurrentTourInfo());

              const onboardingState = {
                isActive: true,
                tourId: tourInfo?.tourId,
                currentStepId: nextStep.id,
                assistantVisible: assistantVisible,
              };
              localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
            } else {
              // No more steps, complete tour
              handleTourEndWithNextTourCheck();
            }
          }, delay);
        }
      };

      // MUI Select specific event handler
      const handleMuiSelectChange = (event) => {
        const target = event.target.closest(currentStep.advanceOnChange.target);
        const directTarget = document.querySelector(currentStep.advanceOnChange.target);
        const isWithinTarget = directTarget && (directTarget.contains(event.target) || event.target === directTarget);

        if (target || isWithinTarget) {
          // Remove highlighting when user makes selection
          unhighlightMenuItem();

          // Hide instruction banners
          banners.hideAllBanners();

          // Add delay if specified
          const delay = currentStep.advanceDelay || 1000; // Default 1s delay for form changes

          setTimeout(() => {
            // Advance to next step
            onboardingService.nextStep();
            const nextStep = onboardingService.getCurrentStep();

            if (nextStep) {
              // Update state and localStorage for the next step
              setCurrentStep(nextStep);
              setTourInfo(onboardingService.getCurrentTourInfo());

              const onboardingState = {
                isActive: true,
                tourId: tourInfo?.tourId,
                currentStepId: nextStep.id,
                assistantVisible: assistantVisible,
              };
              localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
            } else {
              // No more steps, complete tour
              handleTourEndWithNextTourCheck();
            }
          }, delay);
        }
      };

      // Add multiple event listeners for better compatibility
      document.addEventListener('change', handleTargetChange);
      document.addEventListener('input', handleTargetInput);
      // Also listen for click events on MUI Select options
      document.addEventListener('click', handleMuiSelectChange);

      // Cleanup
      return () => {
        document.removeEventListener('change', handleTargetChange);
        document.removeEventListener('input', handleTargetInput);
        document.removeEventListener('click', handleMuiSelectChange);
      };
    }
  }, [currentStep, banners, tourInfo, assistantVisible, handleTourEndWithNextTourCheck]);

  // Set up focus listeners for advanceOnFocus targets
  useEffect(() => {
    if (currentStep && currentStep.advanceOnFocus) {
      const handleTargetFocus = (event) => {
        const target = event.target.closest(currentStep.advanceOnFocus.target);
        if (target) {
          // Remove highlighting when user focuses input
          unhighlightMenuItem();

          // Hide instruction banners
          banners.hideAllBanners();

          // Add delay if specified
          const delay = currentStep.advanceDelay || 500; // Default 0.5s delay for focus

          setTimeout(() => {
            // Advance to next step
            onboardingService.nextStep();
            const nextStep = onboardingService.getCurrentStep();

            if (nextStep) {
              // Update state and localStorage for the next step
              setCurrentStep(nextStep);
              setTourInfo(onboardingService.getCurrentTourInfo());

              const onboardingState = {
                isActive: true,
                tourId: tourInfo?.tourId,
                currentStepId: nextStep.id,
                assistantVisible: assistantVisible,
              };
              localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
            } else {
              // No more steps, complete tour
              handleTourEndWithNextTourCheck();
            }
          }, delay);
        }
      };

      // Add focus listener to document (with capture to catch events on all elements)
      document.addEventListener('focus', handleTargetFocus, true);

      // Cleanup
      return () => {
        document.removeEventListener('focus', handleTargetFocus, true);
      };
    }
  }, [currentStep, banners, tourInfo, assistantVisible, handleTourEndWithNextTourCheck]);

  // Handle banner-type steps
  const [lastBannerStepId, setLastBannerStepId] = useState(null);

  // Reset lastBannerStepId when step changes to ensure banners re-render
  useEffect(() => {
    if (currentStep && currentStep.id !== lastBannerStepId) {
      setLastBannerStepId(null); // Reset to allow re-rendering
    }
  }, [currentStep, lastBannerStepId]);

  useEffect(() => {
    if (currentStep && currentStep.type === 'banner' && currentStep.id !== lastBannerStepId) {
      const position = calculateBannerPositionForPlacement(currentStep.placement);

      banners.showBanner({
        title: currentStep.content.heading,
        message: currentStep.content.description,
        position,
        variant: currentStep.content.variant || 'info',
        autoHide: currentStep.content.autoHide !== false,
        autoHideDelay: currentStep.content.autoHideDelay || 10000,
        showCloseButton: currentStep.content.showCloseButton !== false,
        content: currentStep.content,
        actions: currentStep.actions?.map((action) => ({
          text: action.text,
          type: action.type,
          onClick: async () => {
            // Hide current banner immediately when any action is clicked
            banners.hideAllBanners();
            console.log('action', action);
            console.log('currentStep?.id:', currentStep?.id);
            if (action.action === 'nextStep') {
              // Handle special case for closing connect dialog
              if (currentStep?.id === 'close-connect-dialog') {
                // Dispatch event to close connect dialog
                window.dispatchEvent(new CustomEvent('onboarding:close-connect-dialog'));

                // Small delay to allow dialog to close before advancing
                setTimeout(() => {
                  onboardingService.nextStep();
                  setCurrentStep(onboardingService.getCurrentStep());
                  setTourInfo(onboardingService.getCurrentTourInfo());

                  if (!onboardingService.getCurrentStep()) {
                    handleTourEndWithNextTourCheck();
                  }
                }, 500);
              } else {


                // Directly advance step without causing re-renders
                onboardingService.nextStep();
                setCurrentStep(onboardingService.getCurrentStep());
                setTourInfo(onboardingService.getCurrentTourInfo());

                if (!onboardingService.getCurrentStep()) {
                  handleTourEndWithNextTourCheck();
                }
              }
            } else if (action.action === 'skipTour') {
              onboardingService.skipTour('user_skip');
              handleTourSkip();
            } else if (action.action === 'nextTour') {
              // Use transition method to avoid emitting completion event
              onboardingService.transitionTour();
              const nextStep = onboardingService.startTour(action.nextTourId);
              window.dispatchEvent(
                new CustomEvent('onboarding:change-tour', {
                  detail: { tourId: action.nextTourId },
                })
              );
              if (nextStep) {
                setCurrentStep(nextStep);
                const tourInfo = onboardingService.getCurrentTourInfo();
                setTourInfo(tourInfo);

                // Show assistant if tour settings specify it
                if (tourInfo?.settings?.showAssistant) {
                  setAssistantVisible(true);
                }

                // Update localStorage with new tour state
                const onboardingState = {
                  isActive: true,
                  tourId: action.nextTourId,
                  currentStepId: nextStep.id,
                  assistantVisible: tourInfo?.settings?.showAssistant || false,
                };
                localStorage.setItem('onboardingState', JSON.stringify(onboardingState));
              }
            } else if (action.action === 'finishTour') {
              // Special case: If we're finishing autonomous-engineer-setup, close onboarding directly
              if (tourInfo?.tourId === 'autonomous-engineer-setup') {
                console.log('Finishing autonomous-engineer-setup via finishTour action, closing onboarding');
                onboardingService.completeTour('tour_complete');
                handleTourComplete();
              } else {
                onboardingService.completeTour('tour_complete');
                handleTourEndWithNextTourCheck();
              }
            } else if (action.action === 'openChat') {
              // Open chat with specified message
              window.dispatchEvent(new CustomEvent('openOnboardingChat', { 
                detail: { mode: 'assistant', message: action.chatMessage || 'How can I help you?' } 
              }));
              
              // Show additional banner if specified
              if (action.showAdditionalBanner) {
                const additionalPosition = calculateBannerPositionForPlacement(action.showAdditionalBanner.placement);
                
                // Small delay to avoid banner collision with chat opening
                setTimeout(() => {
                  banners.showBanner({
                    title: action.showAdditionalBanner.content.heading,
                    message: action.showAdditionalBanner.content.description,
                    position: additionalPosition,
                    variant: action.showAdditionalBanner.content.variant || 'info',
                    autoHide: action.showAdditionalBanner.content.autoHide !== false,
                    autoHideDelay: action.showAdditionalBanner.content.autoHideDelay || 10000,
                    showCloseButton: action.showAdditionalBanner.content.showCloseButton !== false,
                    icon: action.showAdditionalBanner.content.icon,
                  });
                }, 1000); // Delay to let chat open first
              }
            } else if (action.action === 'openGitHub') {
              // Open GitHub installation URL in new window
              const companyId = userState.companyId || 'default';
              const githubUrl = action.url.replace('${companyId}', companyId);
              
              console.log('Opening GitHub URL:', githubUrl, 'with companyId:', companyId);
              window.open(githubUrl, '_blank', 'noopener,noreferrer');
              
              // Track analytics
              if (action.analytics) {
                onboardingService.trackEvent(action.analytics, {
                  action: 'openGitHub',
                  url: githubUrl,
                  companyId: companyId
                });
              }

              // Advance to next step after opening GitHub
              setTimeout(() => {
                onboardingService.nextStep();
                setCurrentStep(onboardingService.getCurrentStep());
                setTourInfo(onboardingService.getCurrentTourInfo());

                if (!onboardingService.getCurrentStep()) {
                  handleTourEndWithNextTourCheck();
                }
              }, 500); // Small delay to ensure GitHub opens first
            } else if (action.action === 'openCalendly') {
              // Open Calendly scheduling URL in new window
              window.open(action.url, '_blank', 'noopener,noreferrer');
              
              // Track analytics
              if (action.analytics) {
                onboardingService.trackEvent(action.analytics, {
                  action: 'openCalendly',
                  url: action.url
                });
              }
            } else if (action.action === 'openCalendlyAndNext') {
              // Open Calendly scheduling URL in new window
              window.open(action.url, '_blank', 'noopener,noreferrer');
              
              // Track analytics
              if (action.analytics) {
                onboardingService.trackEvent(action.analytics, {
                  action: 'openCalendlyAndNext',
                  url: action.url
                });
              }
              
              // Also advance to next step
              setTimeout(() => {
                handleNext();
              }, 100); // Small delay to ensure Calendly opens first
            } else if (action.action === 'openPR') {
              // Open the optimization PR in new window
              // Get the PR URL from the tour data or event detail
              const eventDetail = window.lastOnboardingEventDetail || {};
              const optimizationPRs = eventDetail.optimizationPRs || [];
              
              if (optimizationPRs.length > 0) {
                // Open the most recent PR
                const latestPR = optimizationPRs[0];
                window.open(latestPR.prUrl, '_blank', 'noopener,noreferrer');
                
                // Track analytics
                if (action.analytics) {
                  onboardingService.trackEvent(action.analytics, {
                    action: 'openPR',
                    prNumber: latestPR.prNumber,
                    prUrl: latestPR.prUrl
                  });
                }
                
                // Finish the tour after opening PR
                setTimeout(() => {
                  handleTourComplete();
                }, 500); // Small delay to ensure PR opens first
              } else {
                console.warn('No optimization PRs found to open');
                // Still finish the tour even if no PR found
                handleTourComplete();
              }
            } else if (action.action === 'navigateToReleaseHub') {
              // Navigate to Release Hub page
              window.location.href = '/release-hub';
              
              // Track analytics
              if (action.analytics) {
                onboardingService.trackEvent(action.analytics, {
                  action: 'navigateToReleaseHub'
                });
              }
            } else if (action.action === 'setupHanditAgent') {
              // Real API call to setup handit agent with assessment
              const setupHanditAgent = async () => {
                try {
                  console.log('🤖 Setting up handit agent with form data:', formValues);
                  
                  // Get form data
                  const { repository, agentFile, agentFunction, branch } = formValues;
                  
                  if (!repository || !agentFile || !agentFunction) {
                    console.error('Missing required form data:', { repository, agentFile, agentFunction });
                    return;
                  }
                  
                  // Get user's GitHub integration
                  const token = localStorage.getItem('custom-auth-token');
                  const headers = { 'Content-Type': 'application/json' };
                  if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                  }

                  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
                  const integrationsResponse = await fetch(`${apiBase}/git/integrations`, { headers });
                  
                  if (!integrationsResponse.ok) {
                    console.error('Failed to get integrations');
                    return;
                  }
                  
                  const integrationsData = await integrationsResponse.json();
                  const integrations = integrationsData.integrations || [];
                  const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
                  
                  if (!activeIntegration) {
                    console.error('No active GitHub integration found');
                    return;
                  }
                  
                  // Construct repository URL
                  const repoUrl = `https://github.com/${repository}`;
                  
                  // Call the new handit setup endpoint
                  const setupResponse = await fetch(`${apiBase}${action.endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      integrationId: activeIntegration.id,
                      repoUrl,
                      agentFile,
                      agentFunction,
                      agentName: agentFunction,
                      branch: branch,
                    }),
                  });
                  
                  if (setupResponse.ok) {
                    const result = await setupResponse.json();
                    console.log('🤖 Handit setup completed:', result);
                    
                    // Show success message with PR link
                    banners.showBanner({
                      title: '🎉 Setup Complete!',
                      message: `Your autonomous engineer is now set up! Check out the PR: ${result.prUrl}`,
                      position: { top: 20, left: '50%', transform: 'translateX(-50%)' },
                      variant: 'success',
                      autoHide: false,
                      showCloseButton: true,
                      actions: [{
                        text: 'View PR',
                        type: 'primary',
                        onClick: () => window.open(result.prUrl, '_blank')
                      }]
                    });
                    
                    // Advance to next step
                    onboardingService.nextStep();
                    setCurrentStep(onboardingService.getCurrentStep());
                    setTourInfo(onboardingService.getCurrentTourInfo());

                    if (!onboardingService.getCurrentStep()) {
                      handleTourEndWithNextTourCheck();
                    }
                    
                    // Track analytics
                    if (action.analytics) {
                      onboardingService.trackEvent(action.analytics, {
                        action: 'setupHanditAgent',
                        agentData: { repository, agentFile, agentFunction },
                        prUrl: result.prUrl
                      });
                    }
                  } else {
                    const error = await setupResponse.text();
                    console.error('🤖 Handit setup failed:', error);
                  }
                } catch (error) {
                  console.error('🤖 Error setting up handit agent:', error);
                }
              };
              
              setupHanditAgent();
            } else if (action.action === 'submitForm' && currentStep?.id === 'ai-model-setup-form') {
              // Handle AI model setup form submission
              console.log('🤖 AI Model setup form submitted!', { action, currentStep, formValues });
              const setupAIModel = async () => {
                try {
                  console.log('🤖 Setting up AI model with form data:', formValues);
                  
                  // Get form data
                  const { providerId, apiKey } = formValues;
                  
                  if (!providerId || !apiKey) {
                    console.error('Missing required AI model data:', { providerId, apiKey });
                    return;
                  }
                  
                  // Get provider name for default naming
                  const selectedProvider = providers?.data?.find(p => p.id === providerId);
                  const providerName = selectedProvider?.name || 'AI Provider';
                  
                  // Create integration token for the AI model
                  const submitData = {
                    providerId: providerId,
                    name: `${providerName} - Evaluation Token`,
                    type: 'token',
                    token: apiKey
                  };
                  
                  console.log('Creating AI model token:', submitData);
                  await createIntegrationToken(submitData);
                  
                  // Track analytics
                  if (action.analytics) {
                    onboardingService.trackEvent(action.analytics, {
                      action: 'ai_model_connected',
                      providerId: providerId,
                      providerName: providerName
                    });
                  }
                  
                  // Move to next step
                  onboardingService.nextStep();
                  setCurrentStep(onboardingService.getCurrentStep());
                  setTourInfo(onboardingService.getCurrentTourInfo());
                  
                } catch (error) {
                  console.error('Error setting up AI model:', error);
                }
              };
              
              await setupAIModel();
            } else if (action.action === 'apiCall') {
              // Make API call
              const makeApiCall = async () => {
                try {
                  const token = localStorage.getItem('custom-auth-token');
                  const headers = {
                    'Content-Type': 'application/json',
                  };
                  
                  if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                  }

                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/${action.endpoint}`, {
                    method: action.method || 'GET',
                    headers,
                    body: action.method === 'POST' ? JSON.stringify({}) : undefined
                  });
                  
                  if (response.ok) {
                    // API call successful, advance to next step
                    onboardingService.nextStep();
                    setCurrentStep(onboardingService.getCurrentStep());
                    setTourInfo(onboardingService.getCurrentTourInfo());

                    if (!onboardingService.getCurrentStep()) {
                      handleTourEndWithNextTourCheck();
                    }
                  } else {
                    console.error('API call failed:', response.status);
                  }
                } catch (error) {
                  console.error('Error making API call:', error);
                }
              };
              
              makeApiCall();
            }
          },
        })),
        icon: currentStep.content.icon,
      });

      setLastBannerStepId(currentStep.id);
    }
  }, [currentStep, lastBannerStepId]);

  // Handle navigation-type steps
  useEffect(() => {
    if (currentStep && currentStep.type === 'navigation') {
      const navigation = currentStep.navigation;

      if (navigation?.url) {
        // Navigate to the specified URL
        window.location.href = navigation.url;

        // Auto-advance after navigation if specified
        if (currentStep.autoAdvance && currentStep.duration) {
          setTimeout(() => {
            onboardingService.nextStep();
            setCurrentStep(onboardingService.getCurrentStep());
            setTourInfo(onboardingService.getCurrentTourInfo());

            if (!onboardingService.getCurrentStep()) {
              handleTourEndWithNextTourCheck();
            }
          }, currentStep.duration);
        }
      }
    }
  }, [currentStep]);

  // Helper function to calculate banner position from placement
  const calculateBannerPositionForPlacement = (placement) => {
    switch (placement) {
      case 'top-center':
        return { top: 20, left: '50%', transform: 'translateX(-50%)' };
      case 'top-left':
        return { top: 20, left: 20 };
      case 'top-right':
        return { top: 20, right: 20 };
      case 'bottom-center':
        return { bottom: 20, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'bottom-right':
        return { bottom: 20, right: 20 };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      default:
        return { top: 20, left: '50%', transform: 'translateX(-50%)' };
    }
  };

  // Render current step content
  const renderStepContent = () => {
    if (!currentStep) return null;


    switch (currentStep.type) {
      case 'fullscreen-modal':
        return <FullscreenModal step={currentStep} onNext={handleNext} onSkip={handleSkip} />;

      case 'modal':
        return (
          <StepModal
            step={currentStep}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            onFormSubmit={handleFormSubmit}
            formValues={formValues}
            onFormChange={handleFormChange}
            providers={providers}
            createIntegrationToken={createIntegrationToken}
          />
        );

      case 'form':
        return (
          <StepModal
            step={currentStep}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            onFormSubmit={handleFormSubmit}
            formValues={formValues}
            onFormChange={handleFormChange}
            providers={providers}
            createIntegrationToken={createIntegrationToken}
          />
        );

      case 'banner':
        // Banner is handled through banners system, no separate component needed
        return null;

      case 'cursor-only':
        // Cursor guidance is handled in useEffect, no visual component needed
        return null;

      case 'tooltip':
        return <StepTooltip step={currentStep} onNext={handleNext} onPrevious={handlePrevious} />;

      default:
        return null;
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <>
      {/* Main Menu */}
      <OnboardingMenu
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setIsActive(false);
        }}
        onStartTour={(tourId) => {
          const step = onboardingService.startTour(tourId);
          window.dispatchEvent(
            new CustomEvent('onboarding:start-tour', {
              detail: { tourId: tourId },
            })
          );
          if (step) {
            setCurrentStep(step);
            const tourInfo = onboardingService.getCurrentTourInfo();
            setTourInfo(tourInfo);
            setMenuOpen(false);

            // Show assistant if tour settings specify it
            if (tourInfo?.settings?.showAssistant) {
              setAssistantVisible(true);
            }

            // Update user's onboarding progress in database
            updateOnboardingProgress(tourId);
          }
        }}
        userOnboardingCurrentTour={userState.onboardingCurrentTour}
        userCompletedTours={userState.completedTours || []}
      />

      {/* Assistant - Always show during onboarding but hide when chat is open */}
      {(assistantVisible || (currentStep && isActive)) && !chatIsOpen && (
        <OnboardingAssistant
          visible={true}
          currentStep={tourInfo ? tourInfo.currentStep - 1 : 0}
          totalSteps={tourInfo ? tourInfo.totalSteps : 0}
          stepTitle={currentStep?.content?.heading || currentStep?.title || 'Onboarding Step'}
          position="bottom-center"
          onNext={handleNext}
          onPrevious={handlePrevious}
          onFinish={handleFinish}
        />
      )}

      {/* Step Content */}
      {renderStepContent()}

      {/* Banner Container - banners are hidden via hideAllBanners() when chat opens */}
      <banners.BannerContainer />

      {/* Mouse Component - hide when chat is open */}
      {!chatIsOpen && <mouse.MouseComponent />}

    </>
  );
};

// Fullscreen Modal Component
const FullscreenModal = ({ step, onNext, onSkip }) => (
  <Dialog
    open={true}
    fullScreen
    PaperProps={{
      sx: {
        bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    }}
  >
    <DialogContent sx={{ textAlign: 'center', color: 'white', maxWidth: 700 }}>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
        {step.content.heading}
      </Typography>
      <Typography variant="h5" sx={{ mb: 3, opacity: 0.9 }}>
        {step.content.subheading}
      </Typography>
      <Typography variant="body1" sx={{ mb: 6, fontSize: '1.2rem', opacity: 0.8 }}>
        {step.content.description}
      </Typography>

      <Stack direction="row" spacing={3} justifyContent="center">
        {step.actions?.map((action, index) => (
          <Button
            key={index}
            variant={action.type === 'primary' ? 'contained' : 'outlined'}
            size="large"
            onClick={action.action === 'nextStep' ? onNext : onSkip}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              bgcolor: action.type === 'primary' ? 'white' : 'transparent',
              color: action.type === 'primary' ? '#667eea' : 'white',
              border: action.type !== 'primary' ? '2px solid white' : 'none',
              '&:hover': {
                bgcolor: action.type === 'primary' ? '#f5f5f5' : 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            {action.text}
          </Button>
        ))}
      </Stack>
    </DialogContent>
  </Dialog>
);

// Step Modal Component
const StepModal = ({ step, onNext, onPrevious, onSkip, onFormSubmit, formValues, onFormChange, providers, createIntegrationToken }) => {
  console.log('StepModal rendered with step:', step);
  console.log('StepModal form values:', formValues);
  
  // Setup progress state for handit agent setup
  const [setupProgress, setSetupProgress] = useState({
    isRunning: false,
    currentStep: -1,
    completedSteps: new Set(),
    error: null,
    result: null
  });

  const setupSteps = [
    'Understanding your code structure',
    'Detecting AI components and frameworks', 
    'Assessing your AI system quality',
    'Connecting your code to handit.ai'
  ];
  
  const handleSetupAgent = async () => {
    const { repository, agentFile, agentFunction, branch } = formValues;
    
    if (!repository || !agentFile || !agentFunction) {
      console.error('Missing required form data:', { repository, agentFile, agentFunction });
      return;
    }

    setSetupProgress({
      isRunning: true,
      currentStep: 0,
      completedSteps: new Set(),
      error: null,
      result: null
    });

    try {
      // Start the API call immediately in parallel
      const apiCallPromise = (async () => {
        // Get user's GitHub integration
        const token = localStorage.getItem('custom-auth-token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const integrationsResponse = await fetch(`${apiBase}/git/integrations`, { headers });
        
        if (!integrationsResponse.ok) {
          throw new Error('Failed to get GitHub integrations');
        }
        
        const integrationsData = await integrationsResponse.json();
        const integrations = integrationsData.integrations || [];
        const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
        
        if (!activeIntegration) {
          throw new Error('No active GitHub integration found');
        }
        
        // Construct repository URL
        const repoUrl = `https://github.com/${repository}`;
        
        // Call the handit setup endpoint
        const setupHeaders = { 'Content-Type': 'application/json' };
        if (token) {
          setupHeaders['Authorization'] = `Bearer ${token}`;
        }
        
        const setupResponse = await fetch(`${apiBase}/git/assess-and-setup-handit`, {
          method: 'POST',
          headers: setupHeaders,
          body: JSON.stringify({
            integrationId: activeIntegration.id,
            repoUrl,
            agentFile,
            agentFunction,
            agentName: agentFunction,
            branch: branch,
          }),
        });
        
        if (!setupResponse.ok) {
          const errorText = await setupResponse.text();
          throw new Error(errorText || 'Setup failed');
        }
        
        const result = await setupResponse.json();
        console.log('🤖 Handit setup completed:', result);
        return result;
      })();

      // Run UI steps in parallel with API call
      const uiStepsPromise = (async () => {
        // Step 1: Understanding your code structure (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 10000));
        setSetupProgress(prev => ({
          ...prev,
          completedSteps: new Set([...prev.completedSteps, 0]),
          currentStep: 1
        }));

        // Step 2: Detecting AI components (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 10000));
        setSetupProgress(prev => ({
          ...prev,
          completedSteps: new Set([...prev.completedSteps, 1]),
          currentStep: 2
        }));

        // Step 3: Assessing AI system (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 20000));
        setSetupProgress(prev => ({
          ...prev,
          completedSteps: new Set([...prev.completedSteps, 2]),
          currentStep: 3
        }));
      })();

      // Wait for both the API call and UI steps to complete
      const [result] = await Promise.all([apiCallPromise, uiStepsPromise]);
      
      // Complete final step
      setSetupProgress(prev => ({
        ...prev,
        completedSteps: new Set([...prev.completedSteps, 3]),
        currentStep: -1,
        isRunning: false,
        result
      }));

    } catch (error) {
      console.error('🤖 Error setting up handit agent:', error);
      setSetupProgress(prev => ({
        ...prev,
        isRunning: false,
        currentStep: -1,
        error: error.message || 'Setup failed'
      }));
    }
  };

  const handleSetupAIModel = async () => {
    try {
      console.log('🤖 Setting up AI model with form data:', formValues);
      
      // Get form data
      const { providerId, apiKey } = formValues;
      
      if (!providerId || !apiKey) {
        console.error('Missing required AI model data:', { providerId, apiKey });
        return;
      }
      
      // Get provider name for default naming
      const selectedProvider = providers?.data?.find(p => p.id === providerId);
      const providerName = selectedProvider?.name || 'AI Provider';
      
      // Create integration token for the AI model
      const submitData = {
        providerId: providerId,
        name: `${providerName} - Evaluation Token`,
        type: 'token',
        token: apiKey
      };
      
      console.log('Creating AI model token:', submitData);
      await createIntegrationToken(submitData);
      
      console.log('✅ AI model token created successfully!');
      
      // Move to next step
      onNext();
      
    } catch (error) {
      console.error('Error setting up AI model:', error);
    }
  };

  const handleSubmit = () => {
    console.log('StepModal handleSubmit called');
    console.log('Step ID:', step.id);
    console.log('Form values:', formValues);
    
    // Check if this is the agent setup step
    if (step.id === 'automatic-repository-selector-step') {
      handleSetupAgent();
      return;
    }
    
    // Check if this is the AI model setup step
    if (step.id === 'ai-model-setup-form') {
      handleSetupAIModel();
      return;
    }
    
    if (step.content.form || step.content.fields) {
      // For form steps, advance to next step (service handles branching)
      console.log('Form step - calling onNext');
      onNext();
    } else {
      console.log('No form - calling onNext');
      onNext();
    }
  };

  return (
    <Dialog
      open={true}
      maxWidth="md"
      fullWidth={false}
      PaperProps={{
        sx: { 
          bgcolor: '#2a2a2a',
          color: 'white',
          borderRadius: 1.5,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          minWidth: '500px',
          maxWidth: '500px',
          overflow: 'hidden',
          zIndex: 9999
        },
      }}
      sx={{
        '& .MuiDialog-paper': {
          margin: '20px auto',
          transform: 'translateY(-50px)'
        }
      }}
    >
      <DialogContent sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'white', fontWeight: 600 }}>
          {step.content.heading}
        </Typography>

        <Typography variant="body2" sx={{ mb: 2, color: '#ccc', lineHeight: 1.4 }}>
          {setupProgress.isRunning ? 
            'Setting up your autonomous engineer with the selected configuration...' :
            setupProgress.result ?
            'Setup completed successfully! Your autonomous engineer is now active.' :
            step.content.description
          }
        </Typography>

        {/* Form Content - Hide when setup is running */}
        {(step.content.form || step.content.fields) && (
          <Box sx={{ mb: 2, display: (setupProgress.isRunning || setupProgress.result) ? 'none' : 'block' }}>
            {step.content.form?.type === 'multiple-choice' && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <RadioGroup
                  value={formValues[step.content.form.field] || ''}
                  onChange={(e) => onFormChange(step.content.form.field, e.target.value)}
                >
                  {step.content.form.options.map((option) => (
                    <Card
                      key={option.value}
                      sx={{
                        p: 2,
                        mb: 2,
                        bgcolor:
                          formValues[step.content.form.field] === option.value
                            ? 'rgba(113, 242, 175, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                        border:
                          formValues[step.content.form.field] === option.value
                            ? '2px solid #71f2af'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                        cursor: 'pointer',
                      }}
                      onClick={() => onFormChange(step.content.form.field, option.value)}
                    >
                      <FormControlLabel
                        value={option.value}
                        control={<Radio sx={{ color: 'white' }} />}
                        label={
                          <Box>
                            <Typography variant="h6" sx={{ color: 'white' }}>
                              {option.label}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc', mt: 1 }}>
                              {option.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </Card>
                  ))}
                </RadioGroup>
              </FormControl>
            )}

            {(step.content.form?.type === 'form' || step.content.fields) && (
              <Box>
                {(step.content.form?.fields || step.content.fields)?.map((field) => (
                  field.type === 'radio' ? (
                    <FormControl key={field.name} fullWidth sx={{ mb: 3 }}>
                      <Typography variant="h6" sx={{ mb: 2, color: 'white' }}>
                        {field.label}
                      </Typography>
                      <RadioGroup
                        value={formValues[field.name] || ''}
                        onChange={(e) => onFormChange(field.name, e.target.value)}
                      >
                        {field.options.map((option) => (
                          <Card
                            key={option.value}
                            sx={{
                              p: 1,
                              mb: 1,
                              bgcolor:
                                formValues[field.name] === option.value
                                  ? 'rgba(113, 242, 175, 0.2)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              border:
                                formValues[field.name] === option.value
                                  ? '2px solid #71f2af'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer',
                              borderRadius: 1,
                            }}
                            onClick={() => onFormChange(field.name, option.value)}
                          >
                            <FormControlLabel
                              value={option.value}
                              control={<Radio sx={{ color: 'white', p: 0.25 }} />}
                              label={
                                <Box>
                                  <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, fontSize: '0.875rem' }}>
                                    {option.label}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#ccc', mt: 0.25, display: 'block', fontSize: '0.75rem' }}>
                                    {option.description}
                                  </Typography>
                                </Box>
                              }
                            />
                          </Card>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  ) : field.type === 'select' ? (
                    <FormControl key={field.name} fullWidth sx={{ mb: 3 }}>
                      <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {field.label}
                      </InputLabel>
                      <Select
                        value={formValues[field.name] || ''}
                        onChange={(e) => {
                          console.log('🔍 Select onChange triggered:', field.name, e.target.value);
                          onFormChange(field.name, e.target.value);
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              bgcolor: '#2a2a2a',
                              color: 'white',
                              maxHeight: 300,
                              minWidth: '100%', // Ensure minimum width matches Select
                              maxWidth: 550, // Prevent excessive width from long names
                              '&::-webkit-scrollbar': {
                                width: '8px',
                              },
                              '&::-webkit-scrollbar-track': {
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                              },
                              '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(255, 255, 255, 0.3)',
                                borderRadius: '4px',
                                '&:hover': {
                                  background: 'rgba(255, 255, 255, 0.5)',
                                },
                              },
                              // For Firefox
                              scrollbarWidth: 'thin',
                              scrollbarColor: 'rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)',
                            },
                          },
                          anchorOrigin: {
                            vertical: 'bottom',
                            horizontal: 'left',
                          },
                          transformOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          },
                        }}
                        sx={{
                          color: 'white',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#71f2af',
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>{field.placeholder}</em>
                        </MenuItem>
                        {field.options === 'dynamic:userRepositories' ? 
                          useRepositoryOptionsWithSearch() : 
                          field.name === 'providerId' && step && step.id === 'ai-model-setup-form' ? (
                            providers?.data?.map((provider) => (
                              <MenuItem key={provider.id} value={provider.id}>
                                {provider.name}
                              </MenuItem>
                            ))
                          ) : (
                            field.options?.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))
                          )}
                      </Select>
                    </FormControl>
                  ) : field.type === 'file-selector' ? (
                    <FileSelector
                      key={field.name}
                      field={field}
                      value={formValues[field.name] || ''}
                      onChange={(value) => onFormChange(field.name, value)}
                      dependentValue={formValues[field.dependsOn]}
                      formValues={formValues}
                    />
                  ) : field.type === 'repository-search' ? (
                    <RepositorySearch
                      key={field.name}
                      field={field}
                      value={formValues[field.name] || ''}
                      onChange={(value) => onFormChange(field.name, value)}
                    />
                  ) : field.type === 'file-search' ? (
                    <FileSearch
                      key={field.name}
                      field={field}
                      value={formValues[field.name] || ''}
                      onChange={(value) => onFormChange(field.name, value)}
                      dependentValue={formValues[field.dependsOn]}
                      formValues={formValues}
                    />
                  ) : field.type === 'branch-search' ? (
                    <BranchSearch
                      key={field.name}
                      field={field}
                      value={formValues[field.name] || ''}
                      onChange={(value) => onFormChange(field.name, value)}
                      dependentValue={formValues[field.dependsOn]}
                    />
                  ) : (
                    <TextField
                      key={field.name}
                      fullWidth
                      label={field.label}
                      placeholder={field.placeholder}
                      multiline={field.type === 'textarea'}
                      rows={field.type === 'textarea' ? 3 : 1}
                      required={field.required}
                      value={formValues[field.name] || ''}
                      onChange={(e) => onFormChange(field.name, e.target.value)}
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          color: 'white',
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                          '&.Mui-focused fieldset': { borderColor: '#71f2af' },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                      }}
                    />
                  )
                ))}
              </Box>
            )}

            {/* Additional Fields */}
            {(step.content.form?.additionalFields || step.content.additionalFields)?.map((field) => (
              <TextField
                key={field.name}
                fullWidth
                label={field.label}
                placeholder={field.placeholder}
                multiline={field.type === 'textarea'}
                rows={field.type === 'textarea' ? 3 : 1}
                required={field.required}
                value={formValues[field.name] || ''}
                onChange={(e) => onFormChange(field.name, e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#71f2af' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                }}
              />
            ))}
          </Box>
        )}

        {/* Code Snippet */}
        {step.content.codeSnippet && (
          <Card sx={{ bgcolor: 'rgba(0, 0, 0, 0.3)', p: 3, mb: 4 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#00ff00' }}>
              {step.content.codeSnippet.tabs?.[0]?.content || step.content.codeSnippet}
            </Typography>
          </Card>
        )}

        {/* Setup Progress */}
        {setupProgress.isRunning && (
          <Box sx={{ mb: 3 }}>

            <Stack spacing={2}>
              {setupSteps.map((stepLabel, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {setupProgress.completedSteps.has(index) ? (
                    <Box sx={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      bgcolor: '#71f2af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Typography variant="caption" sx={{ color: 'white', fontSize: '12px' }}>
                        ✓
                      </Typography>
                    </Box>
                  ) : setupProgress.currentStep === index ? (
                    <Box sx={{ 
                      width: 20, 
                      height: 20, 
                      border: '2px solid #71f2af',
                      borderRadius: '50%',
                      borderTopColor: 'transparent',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }} />
                  ) : (
                    <Box sx={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>
                        {index + 1}
                      </Typography>
                    </Box>
                  )}
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: setupProgress.completedSteps.has(index) ? 600 : 400,
                      color: setupProgress.completedSteps.has(index) ? '#71f2af' : 
                             setupProgress.currentStep === index ? '#71f2af' : 'rgba(255, 255, 255, 0.7)'
                    }}
                  >
                    {stepLabel}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Success Result */}
        {setupProgress.result && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(113, 242, 175, 0.1)', borderRadius: 1, border: '1px solid #71f2af' }}>
            <Typography variant="subtitle2" sx={{ color: '#71f2af', mb: 1, fontWeight: 600 }}>
              🎉 Setup Complete!
            </Typography>
            <Typography variant="body2" sx={{ color: 'white', mb: 2 }}>
              Your autonomous engineer is now monitoring your {setupProgress.result.agentFunction} function.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.open(setupProgress.result.prUrl, '_blank')}
              sx={{ 
                color: '#71f2af', 
                borderColor: '#71f2af',
                '&:hover': { borderColor: '#71f2af', bgcolor: 'rgba(113, 242, 175, 0.1)' }
              }}
            >
              View Setup PR →
            </Button>
          </Box>
        )}

        {/* Error Message */}
        {setupProgress.error && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: 1, border: '1px solid #f44336' }}>
            <Typography variant="subtitle2" sx={{ color: '#f44336', mb: 1, fontWeight: 600 }}>
              ❌ Setup Failed
            </Typography>
            <Typography variant="body2" sx={{ color: 'white' }}>
              {setupProgress.error}
            </Typography>
          </Box>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {setupProgress.result ? (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                // Advance to next step after successful setup
                onNext();
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.875rem',
                color: '#71f2af',
                bgcolor: 'rgba(113, 242, 175, 0.1)',
                border: '1px solid #71f2af',
                px: 2,
                py: 0.5,
                '&:hover': {
                  bgcolor: 'rgba(113, 242, 175, 0.2)',
                  color: '#71f2af'
                }
              }}
            >
              Continue →
            </Button>
          ) : step.actions?.map((action, index) => (
            <Button
              key={index}
              variant="text"
              size="small"
              onClick={handleSubmit}
              disabled={setupProgress.isRunning}
              sx={{
                textTransform: 'none',
                fontSize: '0.875rem',
                color: setupProgress.isRunning ? 'rgba(255, 255, 255, 0.5)' : 'white',
                bgcolor: setupProgress.isRunning ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                px: 2,
                py: 0.5,
                '&:hover': {
                  bgcolor: setupProgress.isRunning ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                  color: setupProgress.isRunning ? 'rgba(255, 255, 255, 0.5)' : 'white'
                },
                '&:focus': {
                  bgcolor: setupProgress.isRunning ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.15)'
                }
              }}
            >
              {setupProgress.isRunning ? 'Setting up...' : action.text}
            </Button>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

// Step Tooltip Component
const StepTooltip = ({ step, onNext, onPrevious }) => (
  <Box
    sx={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10000,
          bgcolor: '#2a2a2a',
      color: 'white',
      p: 3,
      borderRadius: 2,
      maxWidth: 400,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }}
  >
    <Typography variant="h6" sx={{ mb: 2 }}>
      {step.content.heading}
    </Typography>
    <Typography variant="body2" sx={{ mb: 3, color: '#ccc' }}>
      {step.content.description}
    </Typography>

    <Stack direction="row" spacing={2} justifyContent="flex-end">
      <Button variant="outlined" onClick={onPrevious} size="small">
        Previous
      </Button>
      <Button variant="contained" onClick={onNext} size="small">
        Next
      </Button>
    </Stack>
  </Box>
);

// File Selector Component
const FileSelector = ({ field, value, onChange, dependentValue, formValues }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastRepository, setLastRepository] = useState(null);
  const [lastBranch, setLastBranch] = useState(null);

  // Fetch files when dependent value changes (e.g., repository selection) or branch changes
  useEffect(() => {
    if (dependentValue && field.dependsOn) {
      const currentBranch = formValues?.branch || null;
      // Only fetch if repository changed, branch changed, or not loaded yet
      if (dependentValue !== lastRepository || currentBranch !== lastBranch || !hasLoaded) {
        setLastRepository(dependentValue);
        setLastBranch(currentBranch);
        setHasLoaded(false);
        fetchRepositoryFiles();
      }
    }
  }, [dependentValue, formValues?.branch, lastRepository, lastBranch, hasLoaded]);

  const fetchRepositoryFiles = async () => {
    if (!dependentValue) return;

    setLoading(true);
    try {
      const repositoryFullName = dependentValue;
      const branch = formValues?.branch || null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      
      console.log(`🔍 FileSelector: Fetching files for ${repositoryFullName}${branch ? ` (branch: ${branch})` : ' (default branch)'}`);
      
      // Get user's GitHub integrations to find the correct integration ID
      const token = localStorage.getItem('custom-auth-token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // First, get the user's GitHub integrations
      const integrationsResponse = await fetch(`${apiBase}/git/integrations`, {
        headers,
      });
      
      let integrationId = null;
      
      if (integrationsResponse.ok) {
        const integrationsData = await integrationsResponse.json();
        const integrations = integrationsData.integrations || [];
        
        if (integrations.length > 0) {
          // Use the first active integration
          const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
          if (activeIntegration) {
            integrationId = activeIntegration.id;
          }
        }
      }
      
      if (!integrationId) {
        // Fallback: try URL params
        const urlParams = new URLSearchParams(window.location.search);
        const installationId = urlParams.get('installation_id') || urlParams.get('installationId');
        
        if (installationId) {
          // Use installationId parameter instead
          const response = await fetch(
            `${apiBase}${field.apiEndpoint}?repositoryFullName=${encodeURIComponent(repositoryFullName)}&installationId=${installationId}&maxDepth=5${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setFiles(data.files);
            }
          }
          return;
        }
        
        console.warn('No GitHub integration found - files cannot be loaded');
        return;
      }
      
      // Fetch repository files using the integration ID
      const response = await fetch(
        `${apiBase}${field.apiEndpoint}?repositoryFullName=${encodeURIComponent(repositoryFullName)}&integrationId=${integrationId}&maxDepth=5${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFiles(data.files);
        }
      }
    } catch (error) {
      console.error('Error fetching repository files:', error);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleRefreshFiles = () => {
    setHasLoaded(false);
    fetchRepositoryFiles();
  };

  // Filter files based on search term and field requirements
  const filteredFiles = useMemo(() => {
    console.log('🔍 Files received:', files);
    if (!files.sourceFiles && !files.configFiles && !files.otherFiles) {
      console.log('🔍 No files found in any category');
      return [];
    }

    let allFiles = [
      ...(files.sourceFiles || []),
      ...(files.configFiles || []),
      ...(files.otherFiles || [])
    ];

    console.log('🔍 All files before filtering:', allFiles.length);

    // More inclusive filtering - show more file types for agent files
    if (field.fileTypes && field.fileTypes.includes('source')) {
      allFiles = allFiles.filter(file => {
        // Include source code files
        if (file.isSourceCode) return true;
        // Include executable files even if not marked as source
        if (file.isExecutable) return true;
        // Include common entry point files
        const name = file.name.toLowerCase();
        if (['main.py', 'main.js', 'index.js', 'index.ts', 'app.py', 'app.js', 'server.js', 'server.py'].includes(name)) return true;
        return false;
      });
    }

    console.log('🔍 Files after type filtering:', allFiles.length);

    // Prioritize executable files if specified
    if (field.prioritizeExecutable) {
      allFiles.sort((a, b) => {
        if (a.isExecutable && !b.isExecutable) return -1;
        if (!a.isExecutable && b.isExecutable) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    // Filter by search term
    if (searchTerm) {
      allFiles = allFiles.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    console.log('🔍 Final filtered files:', allFiles.length);
    return allFiles;
  }, [files, searchTerm, field.fileTypes, field.prioritizeExecutable]);

  const handleFileSelect = (file) => {
    onChange(file.path);
    setOpen(false);
  };

  const getFileIcon = (file) => {
    // Only show icon for executable files
    if (file.isExecutable) return '🚀';
    return null; // No icon for regular files
  };

  return (
    <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        {field.label}
      </InputLabel>
      <Select
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        value={value}
        displayEmpty
        disabled={!dependentValue || loading}
        sx={{
          color: 'white',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#71f2af',
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              bgcolor: '#2a2a2a',
              color: 'white',
              maxHeight: 250, // Shorter height for file selector only
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.5)',
                },
              },
              // For Firefox
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)',
            },
          },
        }}
        renderValue={(selected) => {
          if (!selected) {
            return <em style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{field.placeholder}</em>;
          }
          const fileName = selected.split('/').pop();
          const fileExtension = fileName.split('.').pop();
          const isExecutable = ['main.py', 'main.js', 'index.js', 'index.ts', 'app.py', 'app.js', 'server.js', 'server.py'].includes(fileName.toLowerCase());
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isExecutable && <span>🚀</span>}
              <span>{fileName}</span>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', ml: 1 }}>
                {selected}
              </Typography>
            </Box>
          );
        }}
      >
        {/* Search Box */}
        <Box sx={{ p: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#71f2af' },
              },
            }}
          />
        </Box>

        {loading ? (
          <MenuItem disabled>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Loading files...</Typography>
            </Box>
          </MenuItem>
        ) : filteredFiles.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2">
              {!dependentValue ? 'Select a repository first' : 'No files found'}
            </Typography>
          </MenuItem>
        ) : [
          ...filteredFiles.map((file) => (
            <MenuItem
              key={file.path}
              value={file.path}
              onClick={() => handleFileSelect(file)}
              sx={{
                '&:hover': { bgcolor: 'rgba(113, 242, 175, 0.1)' },
                ...(file.isExecutable && {
                  bgcolor: 'rgba(113, 242, 175, 0.1)',
                  '&:hover': { bgcolor: 'rgba(113, 242, 175, 0.2)' },
                }),
              }}
                          >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  {getFileIcon(file) && <span>{getFileIcon(file)}</span>}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: file.isExecutable ? 600 : 400 }}>
                      {file.name}
                      {file.isExecutable && <span style={{ color: '#71f2af', marginLeft: 4 }}>★</span>}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                      {file.path}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                    {file.extension?.toUpperCase()}
                  </Typography>
                </Box>
            </MenuItem>
          )),
          
          // Refresh option at the bottom
          ...(filteredFiles.length > 0 ? [
            <MenuItem 
              key="refresh-files"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRefreshFiles();
              }}
              sx={{ 
                borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                mt: 1,
                '&:hover': { bgcolor: 'rgba(113, 242, 175, 0.1)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', width: '100%' }}>
                <span>🔄</span>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Refresh files ({filteredFiles.length} found)
                </Typography>
              </Box>
            </MenuItem>
          ] : [])
        ]}
      </Select>
    </FormControl>
  );
};

// Simple hook to get repository options
const useRepositoryOptions = () => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  console.log('🔍 useRepositoryOptions called:', { 
    repositoriesCount: repositories.length, 
    loading, 
    hasLoaded
  });

  useEffect(() => {
    if (!hasLoaded) {
      fetchRepositories();
    }
  }, [hasLoaded]);

  const fetchRepositories = async () => {
    console.log('🔍 fetchRepositories in hook called');
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const token = localStorage.getItem('custom-auth-token');
      const headers = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const integrationsResponse = await fetch(`${apiBase}/git/integrations`, { headers });
      
      if (integrationsResponse.ok) {
        const integrationsData = await integrationsResponse.json();
        const integrations = integrationsData.integrations || [];
        
        if (integrations.length > 0) {
          const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
          
          if (activeIntegration && activeIntegration.githubAppInstallationId) {
            const reposResponse = await fetch(
              `${apiBase}/git/installation-repos?integrationId=${activeIntegration.id}`
            );
            
            if (reposResponse.ok) {
              const reposData = await reposResponse.json();
              if (reposData.success && reposData.repositories) {
                console.log('🔍 Hook setting repositories:', reposData.repositories.length);
                setRepositories(reposData.repositories);
                setHasLoaded(true);
                setLoading(false);
                return;
              }
            }
          }
        }
      }
      
      console.warn('🔍 Hook: No GitHub integration found');
    } catch (error) {
      console.error('🔍 Hook error:', error);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  if (loading) {
    return [
      <MenuItem key="loading-hook" disabled>
        Loading repositories...
      </MenuItem>
    ];
  }

  if (repositories.length === 0) {
    return [
      <MenuItem key="empty-hook" disabled>
        No repositories found
      </MenuItem>
    ];
  }

  console.log('🔍 Hook returning repositories:', repositories.map(r => r.fullName));
  return repositories.map((repo) => (
    <MenuItem 
      key={repo.fullName} 
      value={repo.fullName}
      sx={{ py: 1, px: 2 }}
    >
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant="body2" sx={{ 
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {repo.name}
        </Typography>
        <Typography variant="caption" sx={{ 
          color: 'rgba(255, 255, 255, 0.5)', 
          display: 'block',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {repo.fullName} {repo.private && '(Private)'}
        </Typography>
      </Box>
    </MenuItem>
  ));
};

// Repository options hook with search functionality
const useRepositoryOptionsWithSearch = () => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!hasLoaded) {
      fetchRepositories();
    }
  }, [hasLoaded]);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const token = localStorage.getItem('custom-auth-token');
      const headers = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const integrationsResponse = await fetch(`${apiBase}/git/integrations`, { headers });
      
      if (integrationsResponse.ok) {
        const integrationsData = await integrationsResponse.json();
        const integrations = integrationsData.integrations || [];
        
        if (integrations.length > 0) {
          const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
          
          if (activeIntegration && activeIntegration.githubAppInstallationId) {
            const reposResponse = await fetch(
              `${apiBase}/git/installation-repos?integrationId=${activeIntegration.id}`
            );
            
            if (reposResponse.ok) {
              const reposData = await reposResponse.json();
              if (reposData.success && reposData.repositories) {
                setRepositories(reposData.repositories);
                setHasLoaded(true);
                setLoading(false);
                return;
              }
            }
          }
        }
      }
      
      console.warn('No GitHub integration found');
    } catch (error) {
      console.error('Hook error:', error);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  // Filter repositories based on search term
  const filteredRepositories = useMemo(() => {
    if (!searchTerm) return repositories;
    return repositories.filter(repo => 
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [repositories, searchTerm]);

  if (loading) {
    return [
      <MenuItem key="loading-hook" disabled>
        Loading repositories...
      </MenuItem>
    ];
  }

  if (repositories.length === 0) {
    return [
      <MenuItem key="empty-hook" disabled>
        No repositories found
      </MenuItem>
    ];
  }

  return [
    // Search box at the top
    <Box key="search-box" sx={{ p: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search repositories..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        sx={{
          '& .MuiOutlinedInput-root': {
            color: 'white',
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#71f2af' },
          },
        }}
      />
    </Box>,
    
    // Repository list
    ...filteredRepositories.map((repo) => (
      <MenuItem 
        key={repo.fullName} 
        value={repo.fullName}
        sx={{ py: 1, px: 2 }}
      >
        <Box sx={{ width: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {repo.name}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            display: 'block'
          }}>
            {repo.fullName} {repo.private && '(Private)'}
          </Typography>
        </Box>
      </MenuItem>
    )),

    // Show message if search has no results
    ...(searchTerm && filteredRepositories.length === 0 ? [
      <MenuItem key="no-search-results" disabled>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          No repositories match "{searchTerm}"
        </Typography>
      </MenuItem>
    ] : [])
  ];
};

// Repository Search Component
const RepositorySearch = ({ field, value, onChange }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [repositories, setRepositories] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Update search term when value changes
  useEffect(() => {
    if (value && value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open]);

  // Fetch repositories on mount
  useEffect(() => {
    const fetchRepositories = async () => {
      setLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const token = localStorage.getItem('custom-auth-token');
        const headers = { 'Content-Type': 'application/json' };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const integrationsResponse = await fetch(`${apiBase}/git/integrations`, { headers });
        
        if (integrationsResponse.ok) {
          const integrationsData = await integrationsResponse.json();
          const integrations = integrationsData.integrations || [];
          
          if (integrations.length > 0) {
            const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
            
            if (activeIntegration && activeIntegration.githubAppInstallationId) {
              const reposResponse = await fetch(
                `${apiBase}/git/installation-repos?integrationId=${activeIntegration.id}`
              );
              
              if (reposResponse.ok) {
                const reposData = await reposResponse.json();
                if (reposData.success && reposData.repositories) {
                  setRepositories(reposData.repositories);
                  setFilteredRepos(reposData.repositories);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching repositories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();
  }, []);

  // Filter repositories based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredRepos(repositories);
    } else {
      const filtered = repositories.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRepos(filtered);
    }
  }, [searchTerm, repositories]);

  const handleSelect = (repo) => {
    console.log('🎯 Selecting repository:', repo.name, repo.fullName);
    onChange(repo.fullName);
    setSearchTerm(repo.fullName); // Set the search term to show the selected value
    setOpen(false);
  };

  return (
    <FormControl fullWidth sx={{ mb: 3 }} ref={containerRef}>
      <TextField
        fullWidth
        label={field.label}
        placeholder={field.placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1,
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
            '&.Mui-focused fieldset': { borderColor: '#71f2af' },
          },
          '& .MuiOutlinedInput-input': {
            color: 'white',
            '&::placeholder': {
              color: 'rgba(255, 255, 255, 0.5)',
              opacity: 1
            }
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': { color: '#71f2af' }
          }
        }}
      />
      
      {open && (
        <Box sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          bgcolor: '#2a2a2a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 1,
          maxHeight: 150,
          overflow: 'auto',
          zIndex: 1000,
          mt: 1,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.3)',
          }
        }}>
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
              Loading repositories...
            </Box>
          ) : filteredRepos.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
              No repositories found
            </Box>
          ) : (
            filteredRepos.map((repo) => (
              <Box
                key={repo.fullName}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🖱️ Clicked on repository:', repo.name);
                  handleSelect(repo);
                }}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(113, 242, 175, 0.1)' },
                  '&:last-child': { borderBottom: 'none' }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {repo.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  {repo.fullName} {repo.private && '(Private)'}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      )}
    </FormControl>
  );
};

// File Search Component
const FileSearch = ({ field, value, onChange, dependentValue, formValues }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [lastRepository, setLastRepository] = useState(null);
  const [lastBranch, setLastBranch] = useState(null);

  // Update search term when value changes
  useEffect(() => {
    if (value && value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open]);

  // Helper function to sort files with recommended files first
  const sortFiles = (filesArray) => {
    return filesArray.sort((a, b) => {
      const aRecommended = a.isExecutable === true && a.isSourceCode === true;
      const bRecommended = b.isExecutable === true && b.isSourceCode === true;
      
      // Recommended files go to the top
      if (aRecommended && !bRecommended) return -1;
      if (!aRecommended && bRecommended) return 1;
      return 0;
    });
  };

  // Fetch files when repository or branch changes
  useEffect(() => {
    if (dependentValue) {
      const currentBranch = formValues?.branch || null;
      // Only fetch if repository changed, branch changed, or not loaded yet
      if (dependentValue !== lastRepository || currentBranch !== lastBranch) {
        setLastRepository(dependentValue);
        setLastBranch(currentBranch);
        
        const fetchFiles = async () => {
          setLoading(true);
          try {
            const repositoryFullName = dependentValue;
            const branch = formValues?.branch || null;
            const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
            
            console.log(`🔍 FileSearch: Fetching files for ${repositoryFullName}${branch ? ` (branch: ${branch})` : ' (default branch)'}`);
            
            // Get user's GitHub integrations to find the correct integration ID
          const token = localStorage.getItem('custom-auth-token');
          const headers = {
            'Content-Type': 'application/json',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          // First, get the user's GitHub integrations
          const integrationsResponse = await fetch(`${apiBase}/git/integrations`, {
            headers,
          });
          
          let integrationId = null;
          
          if (integrationsResponse.ok) {
            const integrationsData = await integrationsResponse.json();
            const integrations = integrationsData.integrations || [];
            
            if (integrations.length > 0) {
              // Use the first active integration
              const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
              if (activeIntegration) {
                integrationId = activeIntegration.id;
              }
            }
          }
          
          if (!integrationId) {
            // Fallback: try URL params
            const urlParams = new URLSearchParams(window.location.search);
            const installationId = urlParams.get('installation_id') || urlParams.get('installationId');
            
            if (installationId) {
              // Use installationId parameter instead
              const response = await fetch(
                `${apiBase}/git/repository-files?repositoryFullName=${encodeURIComponent(repositoryFullName)}&installationId=${installationId}&maxDepth=5${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.success) {
                  // Handle the new response structure where files are nested under sourceFiles
                  const filesArray = data.files?.sourceFiles || [];
                  const sortedFiles = sortFiles(filesArray);
                  setFiles(sortedFiles);
                  setFilteredFiles(sortedFiles);
                }
              }
              return;
            }
            
            console.warn('No GitHub integration found - files cannot be loaded');
            return;
          }
          
          // Fetch repository files using the integration ID
          const response = await fetch(
            `${apiBase}/git/repository-files?repositoryFullName=${encodeURIComponent(repositoryFullName)}&integrationId=${integrationId}&maxDepth=5${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Handle the new response structure where files are nested under sourceFiles
              const filesArray = data.files?.sourceFiles || [];
              const sortedFiles = sortFiles(filesArray);
              setFiles(sortedFiles);
              setFilteredFiles(sortedFiles);
            }
          }
        } catch (error) {
          console.error('Error fetching files:', error);
        } finally {
          setLoading(false);
        }
      };

        fetchFiles();
      }
    }
  }, [dependentValue, formValues?.branch, lastRepository, lastBranch]);

  // Filter files based on search term
  useEffect(() => {
    const filesArray = Array.isArray(files) ? files : [];
    let filtered = filesArray;
    
    // Debug: Log first few files to see their structure
    if (filesArray.length > 0) {
      console.log('🔍 First 3 files:', filesArray.slice(0, 3).map(f => ({
        name: f.name,
        isExecutable: f.isExecutable,
        isSourceCode: f.isSourceCode,
        recommended: f.isExecutable === true && f.isSourceCode === true
      })));
    }
    
    if (searchTerm) {
      filtered = filesArray.filter(file => 
        file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sort: recommended files (isExecutable && isSourceCode) first, then others
    filtered = sortFiles(filtered);
    
    // Debug: Log sorted results
    console.log('🚀 Sorted files (first 5):', filtered.slice(0, 5).map(f => ({
      name: f.name,
      recommended: f.isExecutable === true && f.isSourceCode === true
    })));
    
    setFilteredFiles(filtered);
  }, [searchTerm, files]);

  const handleSelect = (file) => {
    console.log('🎯 Selecting file:', file.name, file.path);
    onChange(file.path);
    setSearchTerm(file.path); // Set the search term to show the selected value
    setOpen(false);
  };

  const isRecommended = (file) => {
    return file.isExecutable === true && file.isSourceCode === true;
  };

  return (
    <FormControl fullWidth sx={{ mb: 3 }} ref={containerRef}>
      <TextField
        fullWidth
        label={field.label}
        placeholder={dependentValue ? field.placeholder : 'Select a repository first'}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => dependentValue && setOpen(true)}
        disabled={!dependentValue}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1,
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
            '&.Mui-focused fieldset': { borderColor: '#71f2af' },
          },
          '& .MuiOutlinedInput-input': {
            color: 'white',
            '&::placeholder': {
              color: 'rgba(255, 255, 255, 0.5)',
              opacity: 1
            }
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': { color: '#71f2af' }
          }
        }}
      />
      
      {open && dependentValue && (
        <Box sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          bgcolor: '#2a2a2a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 1,
          maxHeight: 150,
          overflow: 'auto',
          zIndex: 1000,
          mt: 1,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.3)',
          }
        }}>
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
              Loading files...
            </Box>
          ) : !Array.isArray(filteredFiles) || filteredFiles.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
              No files found
            </Box>
          ) : (
            filteredFiles.map((file) => {
              const recommended = isRecommended(file);
              return (
                <Box
                  key={file.path}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Clicked on file:', file.name);
                    handleSelect(file);
                  }}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:hover': { bgcolor: 'rgba(113, 242, 175, 0.1)' },
                    '&:last-child': { borderBottom: 'none' },
                    ...(recommended && {
                      bgcolor: 'rgba(113, 242, 175, 0.1)',
                      borderLeft: '3px solid #71f2af'
                    })
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {recommended && (
                      <Box
                        component="img"
                        src="/assets/logo 2.svg"
                        alt="handit"
                        sx={{
                          width: 16,
                          height: 16
                        }}
                      />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        {file.path}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      )}
    </FormControl>
  );
};

// Branch Search Component
const BranchSearch = ({ field, value, onChange, dependentValue }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [branches, setBranches] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Update search term when value changes
  useEffect(() => {
    if (value && value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open]);

  // Fetch branches when repository changes
  useEffect(() => {
    if (dependentValue) {
      const fetchBranches = async () => {
        setLoading(true);
        try {
          const repositoryFullName = dependentValue;
          const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
          
          // Get user's GitHub integrations to find the correct integration ID
          const token = localStorage.getItem('custom-auth-token');
          const headers = {
            'Content-Type': 'application/json',
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          // First, get the user's GitHub integrations
          const integrationsResponse = await fetch(`${apiBase}/git/integrations`, {
            headers,
          });
          
          let integrationId = null;
          
          if (integrationsResponse.ok) {
            const integrationsData = await integrationsResponse.json();
            const integrations = integrationsData.integrations || [];
            
            if (integrations.length > 0) {
              // Use the first active integration
              const activeIntegration = integrations.find(i => i.active && i.githubAppInstallationId) || integrations[0];
              if (activeIntegration) {
                integrationId = activeIntegration.id;
              }
            }
          }
          
          if (!integrationId) {
            // Fallback: try URL params
            const urlParams = new URLSearchParams(window.location.search);
            const installationId = urlParams.get('installation_id') || urlParams.get('installationId');
            
            if (installationId) {
              // Use installationId parameter instead
              const response = await fetch(
                `${apiBase}/git/repository-branches?repositoryFullName=${encodeURIComponent(repositoryFullName)}&installationId=${installationId}`
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.success) {
                  setBranches(data.branches || []);
                  setFilteredBranches(data.branches || []);
                }
              }
              return;
            }
            
            console.warn('No GitHub integration found - branches cannot be loaded');
            return;
          }
          
          // Fetch repository branches using the integration ID
          const response = await fetch(
            `${apiBase}/git/repository-branches?repositoryFullName=${encodeURIComponent(repositoryFullName)}&integrationId=${integrationId}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setBranches(data.branches || []);
              setFilteredBranches(data.branches || []);
            }
          }
        } catch (error) {
          console.error('Error fetching branches:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchBranches();
    }
  }, [dependentValue]);

  // Filter branches based on search term
  useEffect(() => {
    const branchesArray = Array.isArray(branches) ? branches : [];
    let filtered = branchesArray;
    
    if (searchTerm) {
      filtered = branchesArray.filter(branch => 
        branch.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sort: default branch first, then others alphabetically
    filtered = filtered.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
    
    setFilteredBranches(filtered);
  }, [searchTerm, branches]);

  const handleSelect = (branch) => {
    console.log('🎯 Selecting branch:', branch.name);
    onChange(branch.name);
    setSearchTerm(branch.name); // Set the search term to show the selected value
    setOpen(false);
  };

  return (
    <FormControl fullWidth sx={{ mb: 3 }} ref={containerRef}>
      <TextField
        fullWidth
        label={field.label}
        placeholder={dependentValue ? field.placeholder : 'Select a repository first'}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => dependentValue && setOpen(true)}
        disabled={!dependentValue}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1,
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
            '&.Mui-focused fieldset': { borderColor: '#71f2af' },
          },
          '& .MuiOutlinedInput-input': {
            color: 'white',
            '&::placeholder': {
              color: 'rgba(255, 255, 255, 0.5)',
              opacity: 1
            }
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': { color: '#71f2af' }
          }
        }}
      />
      
      {open && dependentValue && (
        <Box sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          bgcolor: '#2a2a2a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 1,
          maxHeight: 150,
          overflow: 'auto',
          zIndex: 1000,
          mt: 1,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.3)',
          }
        }}>
          {loading ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
              Loading branches...
            </Box>
          ) : !Array.isArray(filteredBranches) || filteredBranches.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
              No branches found
            </Box>
          ) : (
            filteredBranches.map((branch) => (
              <Box
                key={branch.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🖱️ Clicked on branch:', branch.name);
                  handleSelect(branch);
                }}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': { bgcolor: 'rgba(113, 242, 175, 0.1)' },
                  '&:last-child': { borderBottom: 'none' },
                  ...(branch.isDefault && {
                    bgcolor: 'rgba(113, 242, 175, 0.1)',
                    borderLeft: '3px solid #71f2af'
                  })
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {branch.isDefault && (
                    <Typography variant="caption" sx={{ 
                      color: '#71f2af', 
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(113, 242, 175, 0.2)',
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5
                    }}>
                      DEFAULT
                    </Typography>
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: branch.isDefault ? 600 : 500 }}>
                      {branch.name}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      )}
    </FormControl>
  );
};

export default OnboardingOrchestrator;
