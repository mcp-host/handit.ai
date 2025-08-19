'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography, Paper } from '@mui/material';
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
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

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

  const handleStartAssessment = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        integrationId: Number(integrationId),
        repoUrl: selectedRepo,
        branch: branch || null,
        preferLocalClone: true,
      };
      const resp = await fetch(`${apiBase}/api/git/assess-and-pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      alert(json?.success ? 'Assessment started. Check the repository for the PR shortly.' : (json?.error || 'Failed to start assessment'));
    } catch (e) {
      alert('Failed to start assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SplitLayout>
      <Paper elevation={8} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>AI Assessment</Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          Select your GitHub repository and optionally a branch to run an AI assessment. We’ll analyze prompts and add a PR with findings.
        </Typography>
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
          <Button variant="contained" onClick={handleStartAssessment} disabled={!canSubmit || submitting}>
            {submitting ? 'Starting…' : 'Start Assessment'}
          </Button>
        </Stack>
      </Paper>
    </SplitLayout>
  );
}


