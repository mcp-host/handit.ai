'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography, Paper, Stepper, Step, StepLabel, CircularProgress, Fade } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { SplitLayout } from '@/components/auth/split-layout';

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
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

  const assessmentSteps = [
    'Detecting prompts',
    'Checking best practices', 
    'Generating report'
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
      
      alert(json?.success ? 'Assessment completed! Check the repository for the PR.' : (json?.error || 'Failed to start assessment'));
    } catch (e) {
      alert('Failed to start assessment');
      resetSteps();
    } finally {
      setSubmitting(false);
      // Reset steps after a delay to show completion
      setTimeout(() => {
        if (!submitting) resetSteps();
      }, 2000);
    }
  };

  return (
    <SplitLayout>
      <Paper elevation={8} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>AI Assessment</Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          Select your GitHub repository and optionally a branch to run an AI assessment. We'll analyze prompts and add a PR with findings.
        </Typography>

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
          <Button variant="outlined" onClick={handleStartAssessment} disabled={!canSubmit || submitting}>
            {submitting ? 'Running Assessment...' : 'Start Assessment'}
          </Button>
        </Stack>
      </Paper>
    </SplitLayout>
  );
}


