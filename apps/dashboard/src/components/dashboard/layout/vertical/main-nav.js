'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useGetAgentByIdQuery, useGetAgentsQuery, useUploadAgentMutation } from '@/services/agentsService';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { List as ListIcon } from '@phosphor-icons/react/dist/ssr/List';
import { onModelChange } from '@/lib/routeHelper';
import { usePopover } from '@/hooks/use-popover';
import { useUser } from '@/hooks/use-user';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import { toast } from '@/components/core/toaster';

import { TerminalWindow } from '@phosphor-icons/react';
import { FloppyDisk } from '@phosphor-icons/react';
import { Plus } from '@phosphor-icons/react';
import { Upload as UploadIcon } from '@phosphor-icons/react';
import { GithubLogo } from '@phosphor-icons/react';


import { AgentSwitch } from '../agent-switch';
import { MobileNav } from '../mobile-nav';
import { UserPopover } from '../user-popover/user-popover';
import { XCircle } from '@phosphor-icons/react';
import { useGetUserQuery } from '@/services/auth/authService';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { CircularProgress, DialogActions, DialogContentText, Alert, AlertTitle } from '@mui/material';
import { ModelsSwitch } from '../models-switch';
import { paths } from '@/paths';
import { ConnectAgentDialog } from '@/components/dashboard/agents/connect-agent-dialog';
import { ReminderDialog } from './reminder-banner';

export function MainNav({ items, title, onNewEvaluator }) {
  const [openNav, setOpenNav] = React.useState(false);
  const path = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // State to track if we're in walkthrough mode
  const [isInWalkthrough, setIsInWalkthrough] = React.useState(false);
  
  // State to track if onboarding is currently active
  const [isOnboardingActive, setIsOnboardingActive] = React.useState(false);
  
  // Fetch both regular and demo agents
  const { data: regularAgents = [], refetch: refetchRegularAgents, isLoading: isLoadingRegularAgents } = useGetAgentsQuery({});
  const { data: demoAgents = [], refetch: refetchDemoAgents } = useGetAgentsQuery({ tourAgent: true });
  const [agents, setAgents] = React.useState([]);
  // Use demo agents when in walkthrough, regular agents otherwise
  React.useEffect(() => {
    if ((isInWalkthrough && demoAgents.length > 0) || (regularAgents.length === 0 && !isLoadingRegularAgents)) {
      setAgents(demoAgents);
    } else if (!isInWalkthrough) {
      setAgents(regularAgents);
    }
  }, [isInWalkthrough, demoAgents, regularAgents]);
  
  const [connectDialogOpen, setConnectDialogOpen] = React.useState(false);
  const { data: userData, error, isLoading } = useGetUserQuery();
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState(null);
  const [isBackNavigation, setIsBackNavigation] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const [uploadAgent] = useUploadAgentMutation();
  const [uploadLoading, setUploadLoading] = React.useState(false);
  const [pullRequests, setPullRequests] = React.useState([]);
  const [pullRequestsLoading, setPullRequestsLoading] = React.useState(false);
  const [readyToCheck, setReadyToCheck] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => {
      setReadyToCheck(true);
    }, 5000);
  }, [userData]);

  // Get current environment
  const environment = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('environment') || 'production';
    }
    return 'production';
  }, []);

  // Get the appropriate API token based on environment
  const apiToken = React.useMemo(() => {
    if (environment === 'staging') {
      return userData?.company?.stagingApiToken;
    }
    return userData?.company?.apiToken;
  }, [environment, userData?.company]);

  const handleAgentChange = (newAgent) => {
    const params = new URLSearchParams(searchParams);
    if (newAgent) {
      params.set('agentId', newAgent.id);
    } else {
      params.delete('agentId');
    }
    router.push(`${path}?${params.toString()}`);
  };

  const agentId = searchParams.get('agentId');
  const modelId = searchParams.get('modelId');
  const { data: currentAgent, isLoading: isLoadingDetails } = useGetAgentByIdQuery(agentId, {
    skip: !agentId,
  });
  
  const handleSave = React.useCallback(async () => {
    try {
      // Call the save function exposed by AgentEditor
      if (window.saveAgent) {
        window.saveAgent();
        
        // Show success feedback (you can use your preferred notification system)
        // For example, if you're using a toast notification:
        // toast.success('Agent saved successfully');
        
        
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      // Show error feedback
      // toast.error('Failed to save agent');
    }
  }, [path, router]);

  // Check for unsaved changes
  React.useEffect(() => {
    const checkUnsavedChanges = () => {
      setHasUnsavedChanges(window.hasUnsavedChanges || false);
    };

    checkUnsavedChanges();
    const interval = setInterval(checkUnsavedChanges, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle navigation with unsaved changes
  const handleNavigation = React.useCallback((e, href) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      setPendingNavigation(href);
      setIsBackNavigation(false);
      setShowSaveDialog(true);
    } else {
      router.push(href);
    }
  }, [hasUnsavedChanges, router]);

  // Handle browser back button and tab closing
  React.useEffect(() => {
    // Handle browser back/forward
    const handlePopState = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        window.history.pushState(null, '', window.location.href);
        setIsBackNavigation(true);
        setShowSaveDialog(true);
      }
    };

    // Handle tab/window closing
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return event.returnValue;
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Push current state to enable popstate handling
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Add onClick to all navigation links
  React.useEffect(() => {
    const links = document.querySelectorAll('a[href]');
    
    const handleClick = (e) => {
      const href = e.currentTarget.getAttribute('href');
      if (href && href !== '#') {
        handleNavigation(e, href);
      }
    };

    links.forEach(link => {
      link.addEventListener('click', handleClick);
    });

    return () => {
      links.forEach(link => {
        link.removeEventListener('click', handleClick);
      });
    };
  }, [handleNavigation]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const result = await uploadAgent(file).unwrap();

      // If successful, reload page
      if (result?.id) {
        window.location.reload();
      }

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error('Error uploading agent: An Agent with this name already exists');
      console.error('Error uploading agent:', error);
      // Optionally show a notification here
    } finally {
      setUploadLoading(false);
    }
  };

  // Fetch user's pull requests
  const fetchPullRequests = async () => {
    setPullRequestsLoading(true);
    try {
      const token = localStorage.getItem('custom-auth-token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/git/pull-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPullRequests(data.pullRequests || []);
      }
    } catch (error) {
      console.error('Error fetching pull requests:', error);
    } finally {
      setPullRequestsLoading(false);
    }
  };

  // Listen for onboarding tour events to switch between regular and demo agents
  React.useEffect(() => {
    const checkWalkthroughState = () => {
      try {
        console.log('state');

        const savedState = localStorage.getItem('onboardingState');
        if (savedState) {
          const state = JSON.parse(savedState);
          console.log('state', state);
          const inWalkthrough = state.isActive && state.tourId === 'welcome-concept-walkthrough';
          if (inWalkthrough !== isInWalkthrough) {
            setIsInWalkthrough(inWalkthrough);
          }
        } else if (isInWalkthrough) {
          setIsInWalkthrough(false);
        }
      } catch (error) {
        console.error('Error checking walkthrough state:', error);
        setIsInWalkthrough(false);
      }
    };

    // Initial check
    checkWalkthroughState();

    // Listen for start tour event - immediate switch to demo agents
    const handleStartTour = (event) => {
      const { tourId } = event.detail;
      if (tourId === 'welcome-concept-walkthrough') {
        console.log('Main nav switching to demo agents');
        setIsInWalkthrough(true);
      }
    };

    // Debounce state changes to prevent flicker
    let debounceTimeout;
    const handleOnboardingStateChange = (event) => {
      const { tourId } = event.detail;
      console.log('event', event);
      // Clear any pending timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Only react to inactive state (tour ending) to switch back to regular agents
      if (tourId !== 'welcome-concept-walkthrough') {
        debounceTimeout = setTimeout(() => {
          console.log('Main nav switching back to regular agents');
          setIsInWalkthrough(false);
        }, 200); // Small delay to avoid flicker
      }
      // Ignore active state changes to prevent flicker during step transitions
    };

    // Listen for connection success to refetch agents
    const handleConnectionSuccess = () => {
      // Refetch both regular and demo agents when connection is successful
      refetchRegularAgents();
      refetchDemoAgents();
    };

    // Listen for onboarding completion to fetch PRs
    const handleOnboardingComplete = (event) => {
      // Check if onboarding was just completed (active: false)
      if (event.detail && event.detail.active === false) {
        console.log('Onboarding completed, fetching PRs...');
        fetchPullRequests();
      }
    };

    window.addEventListener('onboarding:start-tour', handleStartTour);
    window.addEventListener('onboarding:change-tour', handleOnboardingStateChange);
    window.addEventListener('onboarding:connection-success', handleConnectionSuccess);
    window.addEventListener('onboardingStateChange', handleOnboardingComplete);

    return () => {
      window.removeEventListener('onboarding:start-tour', handleStartTour);
      window.removeEventListener('onboarding:change-tour', handleOnboardingStateChange);
      window.removeEventListener('onboarding:connection-success', handleConnectionSuccess);
      window.removeEventListener('onboardingStateChange', handleOnboardingComplete);
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [isInWalkthrough, refetchRegularAgents, refetchDemoAgents]);

  // Track onboarding state for reminder banner
  React.useEffect(() => {
    const checkOnboardingState = () => {
      try {
        const savedState = localStorage.getItem('onboardingState');
        if (savedState) {
          const state = JSON.parse(savedState);
          const isActive = state.isActive === true;
          if (isActive !== isOnboardingActive) {
            setIsOnboardingActive(isActive);
          }
        } else if (isOnboardingActive) {
          setIsOnboardingActive(false);
        }
      } catch (error) {
        console.error('Error checking onboarding state:', error);
        setIsOnboardingActive(false);
      }
    };

    // Initial check
    checkOnboardingState();

    // Listen for onboarding state changes
    const handleOnboardingStateChange = () => {
      checkOnboardingState();
    };

    window.addEventListener('onboardingStateChange', handleOnboardingStateChange);
    
    return () => {
      window.removeEventListener('onboardingStateChange', handleOnboardingStateChange);
    };
  }, [isOnboardingActive]);

  // Fetch pull requests on component mount
  React.useEffect(() => {
    fetchPullRequests();
  }, []);

  // Handle connection success
  React.useEffect(() => {
    const handleConnectionSuccess = () => {
      setConnectDialogOpen(false);
      // Optionally refresh the agent list or show success message
    };

    window.addEventListener('connectionSuccess', handleConnectionSuccess);
    return () => window.removeEventListener('connectionSuccess', handleConnectionSuccess);
  }, []);

  // Handle agent selection from external events
  React.useEffect(() => {
    const handleSelectAgent = (event) => {
      const { agentId } = event.detail;
      if (agentId) {
        handleAgentChange({ id: agentId });
      }
    };

    window.addEventListener('selectAgent', handleSelectAgent);
    return () => window.removeEventListener('selectAgent', handleSelectAgent);
  }, [handleAgentChange]);

  // Determine button state and latest PR
  const hasNoAgents = regularAgents.length === 0 && !isLoadingRegularAgents;
  const hasPullRequests = pullRequests.length > 0;
  const latestPR = pullRequests.length > 0 ? pullRequests[0] : null;
  const shouldShowReviewPR = hasNoAgents && hasPullRequests && !isInWalkthrough;

  return (
    <React.Fragment>
      {uploadLoading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <CircularProgress size={30} />
        </Box>
      )}
      
      <Box
        component="header"
        sx={{
          '--MainNav-background': 'var(--mui-palette-background-default)',
          '--MainNav-divider': 'var(--mui-palette-divider)',
          bgcolor: 'var(--MainNav-background)',
          left: 0,
          position: 'sticky',
          pt: { lg: 'var(--Layout-gap)' },
          top: 0,
          width: '100%',
          zIndex: 'var(--MainNav-zIndex)',
        }}
      >
        <Box
          sx={{
            borderBottom: '1px solid var(--MainNav-divider)',
            display: 'flex',
            flex: '1 1 auto',
            minHeight: '74px',
            px: { xs: 2, lg: 3 },
            py: 1,
          }}
        >
          {/* Left side - Title */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flex: '1 1 auto' }}>
            <IconButton
              onClick={() => {
                setOpenNav(true);
              }}
              sx={{ display: { lg: path?.includes('smart-review-tool') ? '' : 'none' } }}
            >
              <ListIcon />
            </IconButton>
            {path.includes('agents/create') && (
              <Typography variant="h4" component="h1" sx={{ pl: 5 }}>
                Create Agent
              </Typography>
            )}
            {path.includes('evaluation-hub') && (
              <Typography variant="h4" component="h1" sx={{ pl: 5 }}>
                Evaluation Suite
              </Typography>
            )}
            {path === '/agents' && (
              <Typography variant="h4" component="h1" sx={{ pl: '1vmax' }}>
                Agents
              </Typography>
            )}
            {path.includes('agents/edit') && (
              <Typography variant="h4" component="h1" sx={{ pl: 5 }}>
                Update Agent
              </Typography>
            )}
            {path === '/docs' && (
              <Typography variant="h4" component="h1" sx={{ pl: 5 }}>
                My Docs
              </Typography>
            )}
            {(path.includes('ag-monitoring') || path.includes('ag-tracing') || path.includes('model-versions') || path.includes('prompt-versions')) && (
              <div style={{
                paddingLeft: '10px'
              }}>
            <AgentSwitch onAgentChange={handleAgentChange} agentId={agentId} agents={agents} />
            </div>
          )}
          {(path.includes('automated-insights') || path.includes('dynamic-review')) && (
            <ModelsSwitch onModelChange={(model) => onModelChange(path, router, model)} modelId={modelId} />
          )}
          </Stack>

          {/* Right side - Actions */}
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', flex: '1 1 auto', justifyContent: 'flex-end' }}
          >
            {/* Show New Evaluator button only on evaluation-hub page */}
            {path.includes('evaluation-hub') && (
              <Button
                variant="contained"
                startIcon={<Plus weight="bold" />}
                onClick={onNewEvaluator}
                sx={{
                  backgroundImage: 'none',
                  backgroundColor: 'primary.main',
                  '&:hover': {
                    backgroundImage: 'none',
                    backgroundColor: 'primary.light',
                  },
                }}
              >
                New Evaluator
              </Button>
            )}
            {/* Show Create Agent and Upload Agent File buttons only on /agents page */}
            {path === '/agents' && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  startIcon={<UploadIcon />}
                  variant="outlined"
                  disabled={uploadLoading}
                  sx={{
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                    },
                  }}
                >
                  {uploadLoading ? 'Uploading...' : 'Upload Agent File'}
                </Button>
                <Button
                  onClick={() => router.push('/agents/create')}
                  startIcon={<Plus />}
                  variant="contained"
                  sx={{
                    backgroundImage: 'none',
                    backgroundColor: 'primary.main',
                    '&:hover': {
                      backgroundImage: 'none',
                      backgroundColor: 'primary.light',
                    },
                  }}
                >
                  Create Agent
                </Button>
              </>
            )}
            {(path.includes('agents/create') || path.includes('agents/edit')) && (
              <Button
                variant={hasUnsavedChanges ? 'contained' : 'outlined'}
                onClick={handleSave}
                startIcon={<FloppyDisk />}
                sx={hasUnsavedChanges ? {
                  backgroundImage: 'none',  // Remove gradient
                  backgroundColor: hasUnsavedChanges ? 'primary.main' : 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: hasUnsavedChanges ? 'primary.main' : 'primary.dark',
                  },
                  '&:active': {
                    backgroundColor: hasUnsavedChanges ? 'primary.main' : 'primary.main',
                  },
                  animation: hasUnsavedChanges ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': {
                      boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.4)',
                    },
                    '70%': {
                      boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)',
                    },
                    '100%': {
                      boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)',
                    },
                  },
                } : {
                  borderColor: 'transparent',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                  backgroundColor: 'rgba(117,120,255, 0.2)',
                }}
              >
                {hasUnsavedChanges ? '* Save Changes' : 'Save Changes'}
              </Button>
            )}
            
            {/* Message and Action Button */}
            {(isInWalkthrough || hasNoAgents) && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#71f2af', // Handit green color
                  mr: 2,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  backgroundColor: 'rgba(113, 242, 175, 0.1)',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  border: '1px solid rgba(113, 242, 175, 0.3)'
                }}
              >
                {isInWalkthrough 
                  ? "Set up your autonomous engineer to unlock AI optimization."
                  : shouldShowReviewPR
                    ? "Your handit integration is ready! Review the connection PR."
                    : "Set up your autonomous engineer to unlock AI optimization."
                }
              </Typography>
            )}
            
            {/* Action Button - Review PR or Connect Agent */}
            {shouldShowReviewPR ? (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  if (latestPR?.prUrl) {
                    window.open(latestPR.prUrl, '_blank');
                  }
                }}
                startIcon={<GithubLogo size={16} />}
                data-testid="review-pr-button"
                sx={{
                  borderColor: 'transparent',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                  backgroundColor: 'rgba(117,120,255, 0.2)',
                }}
              >
                Review PR
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  // Start the specific tour directly (like automatic start does)
                  window.dispatchEvent(new CustomEvent('onboarding:start-tour', {
                    detail: { tourId: 'autonomous-engineer-setup' }
                  }));
                }}
                startIcon={<TerminalWindow size={16} />}
                data-testid="connect-agent-button"
                sx={{
                  borderColor: 'transparent',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                  },
                  backgroundColor: 'rgba(117,120,255, 0.2)',
                }}
              >
                {hasNoAgents ? 'Get Started' : 'Set Up a new Engineer'}
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
      <MobileNav
        items={items}
        onClose={() => {
          setOpenNav(false);
        }}
        open={openNav}
      />

      {/* Reminder Dialog for users without agents */}
      <ReminderDialog 
        hasNoAgents={hasNoAgents}
        hasPullRequests={hasPullRequests}
        isInWalkthrough={isInWalkthrough}
        isOnboardingActive={isOnboardingActive}
        readyToCheck={readyToCheck}
        pullRequests={pullRequests}
      />

      {/* Connect Agent Dialog */}
      <ConnectAgentDialog
        agentId={agentId}
        currentAgent={currentAgent}
        apiToken={apiToken}
        onClose={() => setConnectDialogOpen(false)}
        open={connectDialogOpen}
      />

      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Do you want to save before continuing?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              if (isBackNavigation) {
                router.push(paths.dashboard.agents);
              } else if (pendingNavigation) {
                router.push(pendingNavigation);
              }
              window.hasUnsavedChanges = false; // Clear the flag before navigation

              setShowSaveDialog(false);
            }}
            variant="outlined"
          >
            Continue Without Saving
          </Button>
          <Button 
            onClick={() => {
              if (window.saveAgent) {
                window.saveAgent();
              }
              setShowSaveDialog(false);
            }}
            variant="contained"
            color="primary"
            autoFocus
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
