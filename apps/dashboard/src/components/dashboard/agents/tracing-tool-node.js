/**
 * Tracing Tool Node Component
 * 
 * A specialized node component for tracing modal that looks like tool-monitoring-node.js
 * but with simplified display (no buttons, group info).
 */

'use client';

import * as React from 'react';
import { Box, Typography, Divider, Card } from '@mui/material';
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
 * TracingToolNode Component
 * 
 * A specialized node component for tracing modal that looks like tool-monitoring-node.js
 * but with simplified display (no buttons, group info).
 * 
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the node
 * @param {Object} props.data - Node data including tool information
 * @param {boolean} props.isConnectable - Whether the node can be connected
 * @returns {JSX.Element} The tracing tool node component
 */
export const TracingToolNode = React.memo(({ id, data, isConnectable }) => {
  console.log('🔧 TracingToolNode rendered for:', data.label, 'Type:', data.type);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agentId');
  const [isHovered, setIsHovered] = React.useState(false);

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

  return (
    <Card
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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

        {/* Group Information */}
        {data.group && (
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Group</Typography>
            <Typography variant="body2" fontWeight={600} color="inherit" sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
              {data.group}
            </Typography>
          </Box>
        )}

        {/* Tool Type Information */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Tool Type</Typography>
          <Typography variant="body2" fontWeight={600} color="inherit" sx={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
            {data.toolType ? data.toolType : '—'}
          </Typography>
        </Box>
      </Box>

      {/* NO ACTION BUTTONS - REMOVED */}

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
