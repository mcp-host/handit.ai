/**
 * @fileoverview Reminder Dialog Component
 * 
 * Shows a subtle reminder dialog for users who have completed onboarding
 * but haven't connected their agent yet. Shows maximum 2 times per day
 * with time restrictions to avoid being annoying.
 */

'use client';

import * as React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, IconButton } from '@mui/material';
import { TerminalWindow, X, GithubLogo } from '@phosphor-icons/react';

const REMINDER_BANNER_KEY = 'handit-reminder-banner';
const MAX_SHOWS_PER_DAY = 24;
const MIN_HOURS_BETWEEN_SHOWS = 1; // Minimum 4 hours between shows

export function ReminderDialog({ 
  hasNoAgents, 
  hasPullRequests, 
  isInWalkthrough, 
  isOnboardingActive,
  readyToCheck,
  pullRequests = []
}) {
  const [showDialog, setShowDialog] = React.useState(false);

  // Check if dialog should be shown
  React.useEffect(() => {
    // Don't show if user has agents, PRs, is in walkthrough, or onboarding is active
    if (!hasNoAgents || isInWalkthrough || isOnboardingActive || !readyToCheck) {
      setShowDialog(false);
      return;
    }

    // Check if we should show the dialog based on time restrictions
    const shouldShow = checkIfShouldShowBanner();
    setShowDialog(shouldShow);
  }, [hasNoAgents, isInWalkthrough, isOnboardingActive, readyToCheck]);

  const checkIfShouldShowBanner = () => {
    try {
      const today = new Date().toDateString();
      const now = new Date();
      const bannerData = JSON.parse(localStorage.getItem(REMINDER_BANNER_KEY) || '{}');

      // If no data for today, show banner
      if (!bannerData[today]) {
        return true;
      }

      const todayData = bannerData[today];
      
      // If we've already shown max times today, don't show
      if (todayData.shows >= MAX_SHOWS_PER_DAY) {
        return false;
      }

      // If we've shown before today, check time restrictions
      if (todayData.lastShown) {
        const lastShown = new Date(todayData.lastShown);
        const hoursSinceLastShow = (now - lastShown) / (1000 * 60 * 60);
        
        // If less than minimum hours have passed, don't show
        if (hoursSinceLastShow < MIN_HOURS_BETWEEN_SHOWS) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking banner show conditions:', error);
      return false;
    }
  };

  const handleConnectClick = () => {
    // Track that banner was clicked
    trackBannerInteraction('clicked');
    
    // Start the specific tour directly (like automatic start does)
    window.dispatchEvent(new CustomEvent('onboarding:start-tour', {
      detail: { tourId: 'autonomous-engineer-setup' }
    }));
    
    // Close the dialog
    setShowDialog(false);
  };

  const handleDismiss = () => {
    // Track that dialog was dismissed
    trackBannerInteraction('dismissed');
    setShowDialog(false);
  };

  const trackBannerInteraction = (action) => {
    try {
      const today = new Date().toDateString();
      const now = new Date();
      const bannerData = JSON.parse(localStorage.getItem(REMINDER_BANNER_KEY) || '{}');

      if (!bannerData[today]) {
        bannerData[today] = { shows: 0, lastShown: null };
      }

      const todayData = bannerData[today];
      
      if (action === 'clicked' || action === 'dismissed') {
        todayData.shows += 1;
        todayData.lastShown = now.toISOString();
        bannerData[today] = todayData;
        
        localStorage.setItem(REMINDER_BANNER_KEY, JSON.stringify(bannerData));
      }
    } catch (error) {
      console.error('Error tracking banner interaction:', error);
    }
  };

  return (
    <Dialog
      open={showDialog}
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
          boxShadow: '0 4px 16px rgba(113, 242, 175, 0.15)',
          backgroundColor: '#05171c',
        }
      }}
    >
      <DialogTitle sx={{ 
        color: '#71f2af', 
        fontWeight: 700,
        fontSize: '1.25rem',
        pb: 2,
        textAlign: 'center',
      }}>
        Ready to optimize your AI?
      </DialogTitle>
      
      <DialogContent sx={{ pt: 1, px: 3 }}>
        <Typography variant="body1" sx={{ 
          color: '#ffffff', 
          lineHeight: 1.6,
          fontSize: '1rem',
          textAlign: 'center',
          mb: 2
        }}>
          <strong style={{ color: '#71f2af' }}>handit.ai</strong> is your autonomous engineer that continuously monitors, evaluates, and optimizes your AI agents 24/7.
        </Typography>
        <Typography variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.8)', 
          lineHeight: 1.5,
          textAlign: 'center',
          mb: 2
        }}>
          {hasPullRequests 
            ? "Your handit integration setup is ready! Review and approve the connection PR, then execute your agent to unlock AI optimization. We'll start analyzing and improving your AI as soon as we receive the first trace."
            : "To start receiving automatic improvements and performance insights, connect your agent with handit's integration. We'll analyze your AI's behavior and create pull requests with optimizations whenever issues are detected."
          }
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'center' }}>
        {hasPullRequests ? (
          <Button
            onClick={() => {
              // Get the latest PR URL and open it
              const latestPR = pullRequests.length > 0 ? pullRequests[0] : null;
              if (latestPR?.prUrl) {
                window.open(latestPR.prUrl, '_blank');
              }
            }}
            variant="outlined"
            size="medium"
            startIcon={<GithubLogo size={18} />}
            sx={{
              borderColor: 'transparent',
              color: 'primary.main',
              fontSize: '0.95rem',
              fontWeight: 600,
              px: 3,
              py: 1,
              borderRadius: 1,
              borderWidth: 1,
              backgroundColor: 'rgba(117,120,255, 0.2)',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            Review PR
          </Button>
        ) : (
          <Button
            onClick={handleConnectClick}
            variant="outlined"
            size="medium"
            startIcon={<TerminalWindow size={18} />}
            sx={{
              borderColor: 'transparent',
              color: 'primary.main',
              fontSize: '0.95rem',
              fontWeight: 600,
              px: 3,
              py: 1,
              borderRadius: 1,
              borderWidth: 1,
              backgroundColor: 'rgba(117,120,255, 0.2)',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            Get Started
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
