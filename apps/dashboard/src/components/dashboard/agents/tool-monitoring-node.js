/**
 * Tool Monitoring Node Component
 * 
 * A specialized node component for monitoring tool execution in the agent flow.
 * Displays tool type, status, and provides access to execution logs.
 * Supports hover effects and click interactions for detailed information.
 */

import * as React from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import { Handle, Position } from 'reactflow';
import { Wrench } from '@phosphor-icons/react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Capitalizes the first letter of each word in a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Provider icon component for the node header
 * @returns {JSX.Element} The provider icon component
 */
function ProviderIcon() {
  return <Wrench size={18} style={{ marginRight: 6 }} />;
}

/**
 * ToolMonitoringNode Component
 * 
 * A node component that displays monitoring information for tools in the agent flow.
 * Shows tool type, status, and provides access to execution logs through a dedicated button.
 * Supports hover effects and click interactions for detailed information.
 * 
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the node
 * @param {Object} props.data - Node data including tool information and callbacks
 * @param {boolean} props.isConnectable - Whether the node can be connected
 * @returns {JSX.Element} The tool monitoring node component
 */
export const ToolMonitoringNode = React.memo(({ id, data, isConnectable }) => {
  // Router and search params
  const searchParams = useSearchParams();
  const agentId = data.agentId || searchParams.get('agentId');
  const router = useRouter();

  // UI state
  const [isHovered, setIsHovered] = React.useState(false);

  /**
   * Handles click on logs button
   * Navigates to the tracing view for this tool
   * @param {React.MouseEvent} e - The click event
   */
  const handleLogsClick = (e) => {
    e.stopPropagation();
    if (agentId) {
      router.push(`/ag-tracing?agentId=${agentId}&nodeId=${id}&nodeType=tool`);
    }
  };

  return (
    <Box
      sx={{
        minWidth: 240,
        maxWidth: 260,
        border: '1.5px solid',
        borderColor: isHovered || data.selected ? 'primary.main' : 'var(--mui-palette-divider, #222)',
        background: 'var(--mui-palette-background-default, #101214)',
        color: 'var(--mui-palette-text-primary, #fff)',
        borderRadius: '8px',
        p: 0,
        boxShadow: isHovered || data.selected ? 6 : 2,
        position: 'relative',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {/* Input Handles */}
      {data.inputs && data.inputs.map((handle, idx) => (
        <Handle
          key={handle.id}
          type="target"
          position={Position.Top}
          id={handle.id}
          isConnectable={isConnectable}
          style={{
            width: 0,
            height: 0,
            background: 'transparent',
            border: '0px solid #fff',
            color: 'transparent',
            top: 0,
            left: `${(idx + 1) * (100 / (data.inputs.length + 1))}%`,
          }}
        />
      ))}

      {/* Output Handles */}
      {data.outputs && data.outputs.map((handle, idx) => (
        <Handle
          key={handle.id}
          type="source"
          position={Position.Bottom}
          id={handle.id}
          isConnectable={isConnectable}
          style={{
            width: 0,
            height: 0,
            background: 'transparent',
            border: '0px solid transparent',
            color: 'transparent',
            bottom: 0,
            left: `${(idx + 1) * (100 / (data.outputs.length + 1))}%`,
          }}
        />
      ))}

      {/* Node Content */}
      <Box
        sx={{
          cursor: 'pointer',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
        onClick={data.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 1, background: 'transparent' }}>
          <ProviderIcon />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '1.08rem', color: 'inherit', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {capitalizeWords(data.label)}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'var(--mui-palette-divider, #222)' }} />

        {/* Tool Type Information */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Tool Type</Typography>
          <Typography variant="body2" fontWeight={600} color="inherit" sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
            {data.toolType ? data.toolType : '—'}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'var(--mui-palette-divider, #222)' }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
        <Button
          size="small"
          variant="text"
          color="secondary"
          sx={{ flex: 1, borderRadius: 0, fontSize: 13, py: 1.2 }}
          onClick={handleLogsClick}
        >
          Tracing
        </Button>
      </Box>
      
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