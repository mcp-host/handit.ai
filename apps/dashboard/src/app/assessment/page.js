'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography, Paper, Stepper, Step, StepLabel, CircularProgress, Fade, Alert, AlertTitle, Card, CardContent } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import GitHubIcon from '@mui/icons-material/GitHub';
import { SplitLayout } from '@/components/auth/split-layout';
import { GitHubOAuthButton } from '@/components/auth/github-oauth-button';

export default function PublicAssessmentPage() {
  const searchParams = useSearchParams();
  const [integrationId, setIntegrationId] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentFlowStep, setCurrentFlowStep] = useState(0); // 0: Assessment, 1: Setup
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

  const assessmentSteps = [
    'Detecting prompts',
    'Checking best practices', 
    'Generating report'
  ];

  const flowSteps = [
    {
      title: 'AI Assessment',
      description: 'Analyze your repository and identify optimization opportunities',
      number: 1,
      color: 'primary'
    },
    {
      title: 'Setup Autonomous Engineer',
      description: 'Connect your GitHub account to enable automated improvements',
      number: 2,
      color: 'secondary'
    }
  ];

  useEffect(() => {
    const iid = searchParams.get('integrationId') || searchParams.get('integration_id') || '';
    const instId = searchParams.get('installationId') || searchParams.get('installation_id') || '';
    
    if (iid) setIntegrationId(iid);
    if (instId) setInstallationId(instId);
  }, [searchParams]);

  useEffect(() => {
    if (!integrationId && !installationId) return;
    setLoadingRepos(true);
    const query = integrationId
      ? `integrationId=${integrationId}`
      : `installationId=${installationId}`;
    fetch(`${apiBase}/git/installation-repos?${query}`)
      .then(r => r.json())
      .then(data => {
        if (data?.success) {
          setRepos(data.repositories || []);
          // If we came via installationId only, capture backend's integration record id
          if (!integrationId && data.integrationRecordId) {
            setIntegrationId(String(data.integrationRecordId));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRepos(false));
  }, [integrationId, installationId, apiBase]);

  const canSubmit = useMemo(() => Boolean(integrationId && selectedRepo), [integrationId, selectedRepo]);

  const resetSteps = () => {
    setCurrentStep(-1);
    setCompletedSteps(new Set());
    setAssessmentResult(null);
    setError(null);
  };

  const handleSetupAutonomousEngineer = () => {
    // This will be handled by the GitHubOAuthButton component
    // The OAuth flow will redirect back to the dashboard
    console.log('Starting GitHub OAuth setup...');
  };

  const handleGitHubOAuthSuccess = () => {
    // Redirect to dashboard after successful authentication
    window.location.href = '/';
  };

  const handleStartAssessment = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());

    try {
      // Step 1: Detecting prompts (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCompletedSteps(prev => new Set([...prev, 0]));
      setCurrentStep(1);

      // Step 2: Checking best practices (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCompletedSteps(prev => new Set([...prev, 1]));
      setCurrentStep(2);

      // Step 3: Generating report (actual API call)
      const body = {
        integrationId: Number(integrationId),
        repoUrl: selectedRepo,
        branch: branch || null,
        preferLocalClone: true,
        useHintsFlow: true,
      };
      const resp = await fetch(`${apiBase}/git/assess-and-pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      
      // Complete final step
      setCompletedSteps(prev => new Set([...prev, 2]));
      setCurrentStep(-1);
      
      if (json?.success) {
        setAssessmentResult({
          prNumber: json.prNumber,
          prUrl: json.prUrl,
          repoName: selectedRepo
        });
        // Move to next step after a delay
        setTimeout(() => {
          setCurrentFlowStep(1);
        }, 3000);
      } else {
        setError(json?.error || 'Failed to start assessment');
      }
    } catch (e) {
      setError('Failed to start assessment');
      resetSteps();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SplitLayout>
      <Paper elevation={8} sx={{ p: 4, borderRadius: 3 }}>
        {/* Flow Progress Stepper */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, textAlign: 'center' }}>
            Setup Your Autonomous Engineer
          </Typography>
          <Stepper activeStep={currentFlowStep} alternativeLabel>
            {flowSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: currentFlowStep >= index ? `${step.color}.main` : 'grey.300',
                        color: currentFlowStep >= index ? 'white' : 'grey.500',
                        fontWeight: 'bold',
                        fontSize: '1.2rem'
                      }}
                    >
                      {step.number}
                    </Box>
                  )}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                    {step.title}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Step 0: AI Assessment */}
        {currentFlowStep === 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'primary.main',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}
              >
                1
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  AI Assessment
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select your GitHub repository to run an AI assessment. We'll analyze prompts and add a PR with findings.
                </Typography>
              </Box>
            </Box>

            {/* Assessment Progress Steps */}
            {submitting && (
              <Fade in={submitting}>
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Assessment Progress
                  </Typography>
                  <Stack spacing={2}>
                    {assessmentSteps.map((stepLabel, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {completedSteps.has(index) ? (
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 24 }} />
                        ) : currentStep === index ? (
                          <CircularProgress size={24} />
                        ) : (
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            border: 2, 
                            borderColor: 'grey.300',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Typography variant="caption" sx={{ color: 'grey.500', fontWeight: 600 }}>
                              {index + 1}
                            </Typography>
                          </Box>
                        )}
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: completedSteps.has(index) ? 600 : 400,
                            color: completedSteps.has(index) ? 'success.main' : 
                                   currentStep === index ? 'primary.main' : 'text.secondary'
                          }}
                        >
                          {stepLabel}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Fade>
            )}

            {/* Success Message */}
            {assessmentResult && (
              <Fade in={Boolean(assessmentResult)}>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>Assessment Completed Successfully! ✅</AlertTitle>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Your AI assessment has been completed and is now available in your repository.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      📋 <strong>Assessment Report:</strong> Available in <code>docs/ai-assessment.md</code>
                    </Typography>
                    <Typography variant="body2">
                      🔗 <strong>Pull Request:</strong> #{assessmentResult.prNumber} in {assessmentResult.repoName}
                    </Typography>
                    {assessmentResult.prUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<LaunchIcon />}
                        href={assessmentResult.prUrl}
                        target="_blank"
                        sx={{ alignSelf: 'flex-start', mt: 1 }}
                      >
                        View Pull Request
                      </Button>
                    )}
                  </Box>
                </Alert>
              </Fade>
            )}

            {/* Error Message */}
            {error && (
              <Fade in={Boolean(error)}>
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                  <AlertTitle>Assessment Failed</AlertTitle>
                  <Typography variant="body2">
                    {error}
                  </Typography>
                </Alert>
              </Fade>
            )}

            <Stack spacing={2}>
              <FormControl size="small" disabled={!(integrationId || installationId) || loadingRepos}>
                <InputLabel id="repo-select-label">Repository</InputLabel>
                <Select
                  labelId="repo-select-label"
                  label="Repository"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                >
                  {repos.map(r => (
                    <MenuItem key={r.id} value={`${r.owner}/${r.name}`}>{r.fullName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Branch (optional)"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                size="small"
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={handleStartAssessment} 
                  disabled={!canSubmit || submitting}
                  sx={{ flex: 1 }}
                >
                  {submitting ? 'Running Assessment...' : 'Start Assessment'}
                </Button>
                {assessmentResult && (
                  <Button 
                    variant="text" 
                    onClick={resetSteps}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Run Another
                  </Button>
                )}
              </Box>
            </Stack>
          </Box>
        )}

        {/* Step 1: Setup Autonomous Engineer */}
        {currentFlowStep === 1 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'secondary.main',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}
              >
                2
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  Setup Your Autonomous Engineer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Connect your GitHub account to enable automated AI improvements and continuous optimization.
                </Typography>
              </Box>
            </Box>

            <Card sx={{ mb: 3, border: '2px dashed', borderColor: 'secondary.main' }}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <GitHubIcon sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Sign in to Continue
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Sign in with GitHub to set up your autonomous engineer and enable automated AI improvements for your repositories.
                </Typography>
                <GitHubOAuthButton 
                  fullWidth 
                  onSuccess={handleGitHubOAuthSuccess}
                  redirectUri={`${window.location.origin}/`}
                />
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="text" 
                onClick={() => setCurrentFlowStep(0)}
              >
                ← Back to Assessment
              </Button>
            </Box>
          </Box>
        )}

      </Paper>
    </SplitLayout>
  );
}


