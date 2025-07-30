/**
 * CLI Authentication Manager Component
 * 
 * This component allows users to generate and approve CLI authentication codes
 * for use with the handit CLI tool.
 */

'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import { CheckCircle, Close, Refresh, Add } from '@mui/icons-material';
import { useGetPendingCodesQuery, useApproveCodeMutation, useGenerateCodeMutation } from '../../../services/cliAuthService';
import { useUser } from '../../../hooks/use-user';

/**
 * CLI Authentication Manager Component
 * 
 * @returns {JSX.Element} The CLI authentication manager component
 */
export function CLIAuthManager() {
  const { user } = useUser();
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);

  // API hooks
  const { data: pendingCodes, isLoading, refetch } = useGetPendingCodesQuery();
  const [approveCode, { isLoading: isApproving }] = useApproveCodeMutation();
  const [generateCode, { isLoading: isGenerating }] = useGenerateCodeMutation();

  /**
   * Handle code generation
   */
  const handleGenerateCode = async () => {
    if (!companyId) {
      return;
    }

    try {
      const result = await generateCode({
        userId: user.id,
        companyId: parseInt(companyId),
      }).unwrap();

      setGeneratedCode(result);
      setGenerateDialogOpen(false);
      setCompanyId('');
    } catch (error) {
      console.error('Failed to generate code:', error);
    }
  };

  /**
   * Handle code approval
   */
  const handleApproveCode = async (code) => {
    try {
      await approveCode(code).unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to approve code:', error);
    }
  };

  /**
   * Format expiration time
   */
  const formatExpiration = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins <= 0) {
      return 'Expired';
    }
    
    return `${diffMins} minutes remaining`;
  };

  /**
   * Check if code is expired
   */
  const isExpired = (expiresAt) => {
    return new Date() > new Date(expiresAt);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          CLI Authentication
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setGenerateDialogOpen(true)}
        >
          Generate New Code
        </Button>
      </Box>

      {/* Generated Code Alert */}
      {generatedCode && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setGeneratedCode(null)}
        >
          <Typography variant="h6" gutterBottom>
            CLI Authentication Code Generated!
          </Typography>
          <Typography variant="body1" gutterBottom>
            Use this code in your CLI: <strong>{generatedCode.code}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This code will expire in 10 minutes. Run your CLI command now to complete authentication.
          </Typography>
        </Alert>
      )}

      {/* Pending Codes */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Pending Authentication Codes
            </Typography>
            <IconButton onClick={() => refetch()} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Box>

          {isLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : pendingCodes?.codes?.length > 0 ? (
            <List>
              {pendingCodes.codes.map((code) => (
                <ListItem
                  key={code.code}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" component="span">
                          {code.code}
                        </Typography>
                        <Chip
                          label={isExpired(code.expiresAt) ? 'Expired' : 'Active'}
                          color={isExpired(code.expiresAt) ? 'error' : 'success'}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Company: {code.company.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Created: {new Date(code.createdAt).toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatExpiration(code.expiresAt)}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CheckCircle />}
                      onClick={() => handleApproveCode(code.code)}
                      disabled={isApproving || isExpired(code.expiresAt)}
                    >
                      Approve
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">
              No pending CLI authentication codes found.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Generate Code Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)}>
        <DialogTitle>Generate CLI Authentication Code</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your company ID to generate a new CLI authentication code.
            This code will be valid for 10 minutes.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Company ID"
            type="number"
            fullWidth
            variant="outlined"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="Enter your company ID"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerateCode}
            variant="contained"
            disabled={!companyId || isGenerating}
          >
            {isGenerating ? <CircularProgress size={20} /> : 'Generate Code'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 