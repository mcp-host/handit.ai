/**
 * Deployment Monitoring Node Component
 *
 * A specialized node component for monitoring deployed models in the agent flow.
 * Displays model deployment status, version information, accuracy metrics,
 * and provides access to logs and deployment management.
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
 * DeploymentMonitoringNode Component
 *
 * A specialized node component for monitoring deployed models in the agent flow.
 * Displays deployment status, version information, accuracy metrics, and provides
 * access to logs and deployment management.
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the node
 * @param {Object} props.data - Node data including model information and metrics
 * @param {boolean} props.isConnectable - Whether the node can be connected
 * @returns {JSX.Element} The deployment monitoring node component
 */
export const DeploymentMonitoringNode = React.memo(({ id, data, isConnectable }) => {
  // Router and search params
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agentId');
  const router = useRouter();

  // UI state
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [evalDialogOpen, setEvalDialogOpen] = React.useState(false);

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

  /**
   * Handles click on logs button
   * @param {React.MouseEvent} e - The click event
   */
  const handleLogsClick = (e) => {
    e.stopPropagation();
    if (agentId) {
      router.push(`/ag-tracing?agentId=${agentId}&nodeId=${data.id}&nodeType=model`);
    }
  };

  /**
   * Handles click on deploy button
   * @param {React.MouseEvent} e - The click event
   */
  const handleDeployClick = (e) => {
    e.stopPropagation();
    if (agentId) {
      router.push(`/prompt-versions?agentId=${agentId}&modelId=${data.modelId || data.id}`);
    }
  };

  const handleMenuOpen = (e) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };
  const handleMenuClose = () => setMenuAnchorEl(null);
  return (
    <Box
      sx={{
        minWidth: 300,
        maxWidth: 300,
        border: '2px solid',
        borderColor: isHovered || data.selected ? 'primary.main' : 'var(--mui-palette-divider, #222)',
        background: 'var(--mui-palette-background-default, #101214)',
        color: 'var(--mui-palette-text-primary, #fff)',
        borderRadius: '8px',
        p: 0,
        boxShadow: isHovered || data.selected ? 6 : 2,
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
      {/* Outer Title Bar */}
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
            fontSize: '1.08rem',
            color: 'inherit',
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: 1,
          }}
        >
          {data.label || 'PROD'}
          {versionLabel && (
            <span
              style={{
                fontWeight: 400,
                color: 'var(--mui-palette-text-secondary, #aaa)',
                marginLeft: 8,
                fontSize: '0.98em',
              }}
            >
              - {versionLabel}
            </span>
          )}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={handleMenuOpen} sx={{ color: 'inherit' }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleMenuClose} onClick={(e) => e.stopPropagation()}>
            <MenuItem
              onClick={(e) => {
                handleMenuClose();
                handleDeployClick(e);
              }}
            >
              Releases
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                handleMenuClose();
                setEvalDialogOpen(true);
              }}
            >
              Manage Evaluators
            </MenuItem>
          </Menu>
        </Box>
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
        {/* Type */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1.5, paddingLeft: 1.5, paddingRight: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Type
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            color="inherit"
            sx={{ fontFamily: 'monospace', fontSize: '1em' }}
          >
            {problemTypeLabel}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1.5, paddingLeft: 1.5, paddingRight: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            
            <Typography variant="body2" color="text.secondary">
              Accuracy
            </Typography>
          </Box>
          <Typography
            variant="body2"
            fontWeight={600}
            color="inherit"
            sx={{ fontFamily: 'monospace', fontSize: '1em', display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor:
                  data.accuracy >= 0.9
                    ? '#00e676'
                    : data.accuracy < 0.7
                    ? '#D32F2F'
                    : '#FFA726',
                border: '1.5px solid #222',
              }}
            />
            {(data.accuracy * 100).toFixed(2)}%
          </Typography>
        </Box>
        {/* Action buttons */}
        <>
          <Divider sx={{ borderColor: 'var(--mui-palette-divider, #222)', my: 0 }} />
          <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', m: 0, p: 0 }}>
            <Button
              size="small"
              variant="text"
              color="secondary"
              sx={{ flex: 1, borderRadius: 0, fontSize: 15, py: 1.2, minWidth: 0, m: 0 }}
              onClick={handleLogsClick}
            >
              Tracing
            </Button>
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                mx: 0,
                my: 0,
                borderColor: 'var(--mui-palette-divider, #222)',
                height: 'auto',
                alignSelf: 'stretch',
              }}
            />
            <Button
              size="small"
              variant="text"
              color="secondary"
              sx={{ flex: 1, borderRadius: 0, fontSize: 15, py: 1.2, minWidth: 0, m: 0 }}
              onClick={handleDeployClick}
            >
              Releases
            </Button>
          </Box>
        </>
      </Box>
      {/* Use the new ManageEvaluatorsDialog */}
      <ManageEvaluatorsDialog
        open={evalDialogOpen}
        onClose={() => setEvalDialogOpen(false)}
        modelId={data.modelId}
        modelLabel={data.label}
      />
      {/* Input/Output handles (absolute, overlay) */}
      {data.inputs &&
        data.inputs.map((handle, idx) => (
          <Handle
            key={handle.id}
            type="target"
            position={Position.Top}
            id={handle.id}
            isConnectable={isConnectable}
            style={{
              width: 0,
              height: 0,
              background: isDeployed ? 'transparent' : 'transparent',
              border: '1px solid transparent',
              top: 0,
              left: `${(idx + 1) * (100 / (data.inputs.length + 1))}%`,
              position: 'absolute',
              zIndex: 2,
            }}
          />
        ))}
      {data.outputs &&
        data.outputs.map((handle, idx) => (
          <Handle
            key={handle.id}
            type="source"
            position={Position.Bottom}
            id={handle.id}
            isConnectable={isConnectable}
            style={{
              width: 0,
              height: 0,
              background: isDeployed ? 'transparent' : 'transparent',
              border: '0px solid transparent',
              bottom: 0,
              left: `${(idx + 1) * (100 / (data.outputs.length + 1))}%`,
              position: 'absolute',
              zIndex: 2,
            }}
          />
        ))}
      
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
          border: '1px solid transparent',
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
          border: '1px solid transparent',
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
          border: '1px solid transparent',
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
          border: '1px solid transparent',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
      
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
          border: '1px solid transparent',
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
          border: '1px solid transparent',
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
          border: '1px solid transparent',
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
          border: '1px solid transparent',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          visibility: 'hidden' // Hidden but functional for edge connections
        }}
      />
    </Box>
  );
});
