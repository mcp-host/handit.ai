/**
 * Tracing Deployment Node Component
 *
 * A specialized node component for tracing modal that looks like deployment-monitoring-node.js
 * but with simplified display (no buttons, group info, status indicators).
 */

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGetPromptVersionsQuery } from '@/services/promptService';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Brain } from '@phosphor-icons/react';
import { Handle, Position } from 'reactflow';

import ManageEvaluatorsDialog from './ManageEvaluatorsDialog';

/**
 * Formats a problem type string for display
 * @param {string} str - The problem type string to format
 * @returns {string} The formatted problem type string
 */
function formatProblemType(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Provider icon component for the node header
 * @returns {JSX.Element} The provider icon component
 */
function ProviderIcon() {
  return <Brain size={18} style={{ marginRight: 6 }} />;
}

/**
 * TracingDeploymentNode Component
 *
 * A specialized node component for tracing modal that looks like deployment-monitoring-node.js
 * but with simplified display (no buttons, group info, status indicators).
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the node
 * @param {Object} props.data - Node data including model information and metrics
 * @param {boolean} props.isConnectable - Whether the node can be connected
 * @returns {JSX.Element} The tracing deployment node component
 */
export const TracingDeploymentNode = React.memo(({ id, data, isConnectable }) => {
  console.log('🎯 TracingDeploymentNode rendered for:', data.label, 'Type:', data.type);
  
  // Router and search params
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agentId');
  const router = useRouter();

  // UI state
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [evalDialogOpen, setEvalDialogOpen] = React.useState(false);

  /**
   * Renders connection handles for the node (same as monitoring-node.js)
   * @param {Array} handles - Array of handle configurations
   * @param {string} type - Handle type ('target' or 'source')
   * @param {Position} position - Handle position (Top or Bottom)
   * @returns {JSX.Element|null} The rendered handles or null if no handles
   */
  const renderHandles = (handles, type, position) => {
    if (!handles) return null;

    return handles.map((handle, index) => (
      <React.Fragment key={handle.id}>
        <Handle
          type={type}
          position={position}
          id={handle.id}
          isConnectable={isConnectable}
          style={{
            width: 8,
            height: 8,
            background: 'transparent',
            border: '1px solid #fff',
            [position === Position.Top ? 'top' : 'bottom']: '8px',
            left: `${(index + 1) * (100 / (handles.length + 1))}%`,
          }}
        />
      </React.Fragment>
    ));
  };

  // Fetch deployed version for this model
  const { data: promptVersions } = useGetPromptVersionsQuery(data.modelId, { skip: !data.modelId });

  // Get deployed and latest versions
  const deployedVersion = React.useMemo(() => {
    if (!promptVersions) return null;
    return promptVersions.find((v) => v.activeVersion);
  }, [promptVersions]);

  const latestVersion = React.useMemo(() => {
    if (!promptVersions || promptVersions.length === 0) return null;
    return promptVersions[0];
  }, [promptVersions]);

  // Deployment status
  const isDeployed = !!deployedVersion;
  const versionLabel = deployedVersion
    ? 'V' + deployedVersion.version
    : latestVersion
      ? 'Version: ' + latestVersion.version
      : '—';
  const upToDate = isDeployed;

  // Calculate latest accuracy from metrics
  let accuracyValue = null;
  if (data.metrics && data.metrics.daily) {
    const dailyData = data.metrics.daily;
    const latestDate = Object.keys(dailyData).sort().pop();
    if (latestDate) {
      const latestMetrics = dailyData[latestDate];
      if (latestMetrics && latestMetrics.sum !== undefined && latestMetrics.count) {
        accuracyValue = latestMetrics.sum / latestMetrics.count;
      }
    }
  }

  // Format problem type for display
  const problemTypeLabel = data.problemType ? formatProblemType(data.problemType) : '—';

  // Status dot color based on accuracy
  let statusColor = '#00e676'; // green default
  if (accuracyValue !== null) {
    if (accuracyValue < 0.7)
      statusColor = '#D32F2F'; // red
    else if (accuracyValue < 0.8) statusColor = '#FFA726'; // orange
  }

  const handleMenuOpen = (e) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };
  const handleMenuClose = () => setMenuAnchorEl(null);

  /**
   * Step Badge Component
   * Displays the current step number(s) in circular badge(s)
   */
  const StepBadge = ({ steps, selectedCycle, disableCycles, allSteps }) => {
    if (disableCycles && allSteps?.length > 0) {
      // Show all steps when cycles are disabled
      const nodeSteps = allSteps.sort((a, b) => a - b);
      
      if (nodeSteps.length === 1) {
        return (
          <Button
            sx={{
              position: 'absolute',
              top: '-40px',
              right: '10px',
              minWidth: '24px',
              width: '24px',
              height: '24px',
              p: 0,
              background: '#1976d2',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'all 0.2s ease',
              transform: 'scale(1.1)',
              boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.3)',
              '&:hover': {
                background: '#1976d2',
              },
              zIndex: 10,
            }}
          >
            {nodeSteps[0]}
          </Button>
        );
      } else if (nodeSteps.length <= 3) {
        // Show individual badges for 2-3 steps
        return (
          <>
            {nodeSteps.map((step, index) => (
              <Button
                key={step}
                sx={{
                  position: 'absolute',
                  top: '-40px',
                  right: `${10 + (index * 28)}px`,
                  minWidth: '24px',
                  width: '24px',
                  height: '24px',
                  p: 0,
                  background: '#1976d2',
                  color: 'white',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  transition: 'all 0.2s ease',
                  transform: 'scale(1.1)',
                  boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.3)',
                  '&:hover': {
                    background: '#1976d2',
                  },
                  zIndex: nodeSteps.length - index + 10,
                }}
              >
                {step}
              </Button>
            ))}
          </>
        );
      } else {
        // Show compact format for many steps: "1,2,3..."
        const displayText = nodeSteps.length > 4 
          ? `${nodeSteps.slice(0, 2).join(',')}...` 
          : nodeSteps.join(',');
        
        return (
          <Button
            sx={{
              position: 'absolute',
              top: '-35px',
              right: '10px',
              minWidth: '40px',
              height: '24px',
              p: 0,
              background: '#1976d2',
              color: 'white',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              transition: 'all 0.2s ease',
              transform: 'scale(1.1)',
              boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.3)',
              '&:hover': {
                background: '#1976d2',
              },
              zIndex: 10,
            }}
          >
            {displayText}
          </Button>
        );
      }
    } else {
      // Original logic for cycles enabled
      const index = selectedCycle?.steps?.findIndex(step => steps.includes(step));
      const title = selectedCycle?.steps?.[index];

      if (!title) return null;
      return (
        <Button
          sx={{
            position: 'absolute',
            top: '-15px',
            right: '10px',
            minWidth: '24px',
            width: '24px',
            height: '24px',
            p: 0,
            background: '#1976d2',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            transition: 'all 0.2s ease',
            transform: 'scale(1.1)',
            boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.3)',
            '&:hover': {
              background: '#1976d2',
            },
            zIndex: 10,
          }}
        >
          {title}
        </Button>
      );
    }
  };
  
  return (
    <Card
      sx={{
        minWidth: 400,
        maxWidth: 400,
        border: '2px solid',
        borderColor: data.status === 'error' ? '#D32F2F' : (isHovered || data.isSelected ? 'primary.main' : 'var(--mui-palette-divider, #222)'),
        background: 'var(--mui-palette-background-default, #101214)',
        color: 'var(--mui-palette-text-primary, #fff)',
        borderRadius: '8px',
        p: 0,
        boxShadow: isHovered || data.isSelected ? 6 : 2,
        position: 'relative',
        fontFamily: 'inherit',
        overflow: 'visible',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: data.onClick ? 'pointer' : 'default',
      }}
      onClick={data.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Step Badge */}
      <StepBadge
        steps={data.sequence}
        selectedCycle={data.selectedCycle}
        disableCycles={data.disableCycles}
        allSteps={data.allSteps}
      />

      {/* Input Handles */}
      {renderHandles(data.inputs, 'target', Position.Top)}
      
      {/* Default handles for edge connection points */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          left: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />

      {/* Outer Title Bar - NO THREE DOTS MENU */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          pt: 1.5,
          pb: 1,
          borderBottom: 'none',
          background: 'transparent',
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{
            fontSize: '1.2rem',
            color: 'inherit',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: 1,
          }}
        >
          {data.label || 'PROD'}
        </Typography>
      </Box>
      
      {/* Inner Card-like Box */}
      <Box
        sx={{
          m: 2,
          mt: 1.5,
          mb: 2,
          border: '1.5px solid',
          borderColor: 'var(--mui-palette-divider, #222)',
          borderRadius: '8px',
          background: 'var(--mui-palette-background-paper, #181c20)',
          boxShadow: 1,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 1.5,
          paddingBottom: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* Group Information */}
        {data.group && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1.5, paddingLeft: 1.5, paddingRight: 1.5, overflow: 'hidden', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Group
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color="inherit"
              sx={{ fontFamily: 'monospace', fontSize: '1.1em' }}
            >
              {data.group}
            </Typography>
          </Box>
        )}

        {/* Status Indicator for AI Models */}
        {data.type === 'model' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1.5, paddingLeft: 1.5, paddingRight: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: data.status === 'error' ? '#D32F2F' : '#4CAF50',
                }}
              />
              <Typography
                variant="body2"
                fontWeight={600}
                color="inherit"
                sx={{ fontFamily: 'monospace', fontSize: '1.1em' }}
              >
                {data.status === 'error' ? 'Error' : 'Success'}
              </Typography>
            </Box>
          </Box>
        )}
        
        {/* NO ACTION BUTTONS - REMOVED */}
      </Box>
      
      {/* Use the new ManageEvaluatorsDialog */}
      <ManageEvaluatorsDialog
        open={evalDialogOpen}
        onClose={() => setEvalDialogOpen(false)}
        modelId={data.modelId}
        modelLabel={data.label}
      />

      {/* Output Handles */}
      {renderHandles(data.outputs, 'source', Position.Bottom)}
      
      {/* Default source handles for edge connection points */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          left: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={isConnectable}
        style={{
          width: 8,
          height: 8,
          background: 'transparent',
          border: '1px solid #fff',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
    </Card>
  );
});
