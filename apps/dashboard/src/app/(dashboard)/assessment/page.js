'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';

export default function AssessmentPage() {
  const searchParams = useSearchParams();
  const [integrationId, setIntegrationId] = useState('');
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '';

  useEffect(() => {
    const iid = searchParams.get('integrationId') || searchParams.get('integration_id') || '';
    if (iid) setIntegrationId(iid);
  }, [searchParams]);

  useEffect(() => {
    if (!integrationId) return;
    setLoadingRepos(true);
    fetch(`${apiBase}/api/git/installation-repos?integrationId=${integrationId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.success) setRepos(data.repositories || []);
      })
      .catch(() => {})
      .finally(() => setLoadingRepos(false));
  }, [integrationId, apiBase]);

  const canSubmit = useMemo(() => Boolean(integrationId && selectedRepo), [integrationId, selectedRepo]);

  const handleStartAssessment = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        integrationId: Number(integrationId),
        repoUrl: selectedRepo, // owner/repo
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
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>AI Assessment</Typography>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <TextField
          label="Integration ID"
          value={integrationId}
          onChange={(e) => setIntegrationId(e.target.value)}
          placeholder="e.g. 123"
        />
        <FormControl disabled={!integrationId || loadingRepos}>
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
        />
        <Button variant="contained" onClick={handleStartAssessment} disabled={!canSubmit || submitting}>
          {submitting ? 'Starting…' : 'Start Assessment'}
        </Button>
      </Stack>
    </Box>
  );
}


