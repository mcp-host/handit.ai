import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogContent,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import onboardingService from '../../services/onboarding/onboardingService';
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
  const startOnboarding = useCallback((tourId = onboardingService.getInitialTourId()) => {
    console.log('startOnboarding', tourId);
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
              if (restoredStep.id === 'welcome-banner') {
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

    // Check if user is new (onboardingCurrentTour is null) and start onboarding immediately
    // Only start if we haven't already started onboarding for this new user
    // AND automatic start is enabled (passed from parent to determine business logic)
    console.log('enableAutomaticStart', enableAutomaticStart);
    console.log('isLoadingAutomaticStart', isLoadingAutomaticStart);
    if (userState.onboardingCurrentTour === null && !hasStartedNewUserOnboarding.current && enableAutomaticStart && !isLoadingAutomaticStart) {
      console.log('starting onboarding');
      hasStartedNewUserOnboarding.current = true;
      startOnboarding(onboardingService.getInitialTourId());
      new CustomEvent('onboarding:start-tour', {
        detail: { tourId: onboardingService.getInitialTourId() },
      })
      return;
    }

    // Auto-trigger if enabled
    if (triggerOnMount) {
      const suggestedTour = onboardingService.checkTriggers();
      if (suggestedTour && autoStart) {
        startOnboarding();
        return;
      }
    }

    // Direct start if autoStart is true (bypass triggers entirely)
    if (autoStart) {
      startOnboarding();
    }

    return () => {
      // Cleanup listeners
      window.removeEventListener('openOnboardingMenu', handleOpenOnboardingMenu);
      window.removeEventListener('onboarding:connection-success', handleConnectionSuccess);
      window.removeEventListener('onboarding:loading-state-change', handleLoadingStateChange);
      window.removeEventListener('onboarding:step-changed', handleStepChanged);
    };
      }, [userState, autoStart, triggerOnMount, enableAutomaticStart, isLoadingAutomaticStart, handleConnectionSuccess, handleLoadingStateChange, handleStepChanged]);
  // Navigation functions
  const handleNext = useCallback(() => {
    // Clear any existing banners and highlighting before advancing
    banners.hideAllBanners();
    unhighlightMenuItem();

    onboardingService.nextStep();
    setCurrentStep(onboardingService.getCurrentStep());
    setTourInfo(onboardingService.getCurrentTourInfo());

    // Use the helper function to handle tour completion with next tour checking
    handleTourEndWithNextTourCheck();
  }, [banners, handleTourEndWithNextTourCheck]);

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
    //onboardingService.completeTour('tour_complete');
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
                    onboardingService.completeTour('tour_complete');
                    handleTourEndWithNextTourCheck();
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
          console.warn('waitForElement timeout reached for:', currentStep.waitForElement.target);
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
        const target = event.target.closest(currentStep.advanceOnClick.target);
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
        actions: currentStep.actions?.map((action) => ({
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
              onboardingService.completeTour('tour_complete');
              handleTourEndWithNextTourCheck();
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
  }, [currentStep]);

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
    <DialogContent sx={{ textAlign: 'center', color: 'white', maxWidth: 600 }}>
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
const StepModal = ({ step, onNext, onPrevious, onSkip, onFormSubmit }) => {
  const [formValues, setFormValues] = useState({});

  const handleFormChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (step.content.form) {
      onFormSubmit(step.id, formValues);
    } else {
      onNext();
    }
  };

  return (
    <Dialog
      open={true}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: '#2a2a2a', color: 'white', borderRadius: 2 },
      }}
    >
      <DialogContent sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, color: 'white' }}>
          {step.content.heading}
        </Typography>

        <Typography variant="body1" sx={{ mb: 4, color: '#ccc' }}>
          {step.content.description}
        </Typography>

        {/* Form Content */}
        {step.content.form && (
          <Box sx={{ mb: 4 }}>
            {step.content.form.type === 'multiple-choice' && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <RadioGroup
                  value={formValues[step.content.form.field] || ''}
                  onChange={(e) => handleFormChange(step.content.form.field, e.target.value)}
                >
                  {step.content.form.options.map((option) => (
                    <Card
                      key={option.value}
                      sx={{
                        p: 2,
                        mb: 2,
                        bgcolor:
                          formValues[step.content.form.field] === option.value
                            ? 'rgba(66, 165, 245, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                        border:
                          formValues[step.content.form.field] === option.value
                            ? '2px solid #42a5f5'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleFormChange(step.content.form.field, option.value)}
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

            {/* Additional Fields */}
            {step.content.form.additionalFields?.map((field) => (
              <TextField
                key={field.name}
                fullWidth
                label={field.label}
                placeholder={field.placeholder}
                multiline={field.type === 'textarea'}
                rows={field.type === 'textarea' ? 3 : 1}
                required={field.required}
                value={formValues[field.name] || ''}
                onChange={(e) => handleFormChange(field.name, e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#42a5f5' },
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

        {/* Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {step.actions?.map((action, index) => (
            <Button
              key={index}
              variant={action.type === 'primary' ? 'contained' : 'outlined'}
              onClick={handleSubmit}
              sx={{ color: action.type === 'primary' ? 'white' : '#42a5f5' }}
            >
              {action.text}
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

export default OnboardingOrchestrator;
