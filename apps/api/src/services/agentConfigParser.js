import { z } from 'zod';
import { generateAIResponse } from './aiService.js';


// Define the Zod schema for the configuration
const NodeSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  type: z.enum(['model', 'tool']),
  group: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  next_nodes: z.array(z.object({
    slug: z.string(),
    input_name: z.string(),
    output_name: z.string()
  })),
  model: z.object({
    provider: z.string(),
    problem_type: z.string(),
    parameters: z.object({
      type: z.string(),
    })
  }).optional(),
  tool_type: z.string().optional()
});

const AgentConfigSchema = z.object({
  agent: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string()
  }),
  nodes: z.array(NodeSchema)
});

export const parseAgentConfig = async (rawConfig) => {
  if (rawConfig.nodes.length > 0 ) {
   rawConfig.nodes = rawConfig.nodes.filter(node => !(node.type.includes("lmChatOpenAi") || node.type.includes("vectorStorePinecone") || node.type.includes("embeddingsOpenAi")));
  }
  try {
    const prompt = `Parse and structure the following agent configuration into a standardized format.
    if you see AI Agent node that must always be a model node.
    The configuration should follow this structure:
    {
      "agent": {
        "name": string,
        "slug": string (camelCase),
        "description": string
      },
      "nodes": [
        {
          "name": string,
          "slug": string (camelCase),
          "description": string,
          "type": "model" | "tool",
          "group": string (optional, preserve from original if present),
          "position": { "x": number, "y": number },
          "next_nodes": [
            {
              "slug": string,
              "input_name": string,
              "output_name": string
            }
          ]
        }
      ]
    }

    For model nodes, include:
    - model configuration (provider, parameters, etc.)
    - problem type
    - description

    For tool nodes, include:
    - tool type
    - description
    - configuration

    Arrange nodes in a top-to-bottom layout with proper spacing, and make sure the nodes are not overlapping, so use 300 units of spacing between nodes on Y axis and 300 units of spacing between nodes on X axis.
    Original configuration:
    ${JSON.stringify(rawConfig, null, 2)}`;

    const completion = await generateAIResponse({
      messages: [
        {
          role: "system",
          content: "You are an expert at parsing and structuring agent configurations. Always ensure proper node positioning and connection mapping. Arrange nodes in a top-to-bottom layout with proper spacing, and make sure the nodes are not overlapping, so use 300 units of spacing between nodes on Y axis and 300 units of spacing between nodes on X axis. If you see AI Agent node that must always be a model node. Organize the nodes top to down and consider inputs and outputs, so always a node that is an input for another node must be above the node that is the output for the other node. IMPORTANT: If any nodes have a 'group' field in the original configuration, preserve it exactly as provided - do not infer or change group assignments."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      responseFormat: AgentConfigSchema
    });

    const parsedConfig = JSON.parse(completion.choices[0].message.content);

    return await repositionGraphNodes(parsedConfig);
  } catch (error) {
    console.error('Error parsing agent config:', error);
    throw error;
  }
};


export const repositionGraphNodes = async (graph, group = false) => {
  // Check if any nodes have groups
  const hasGroups = graph.nodes.some(node => node.group && node.group.trim() !== '');
  console.log('hasGroups', hasGroups, group);
  if (!hasGroups || !group) {
    // Use original logic if no groups are present
    return repositionGraphNodesOriginal(graph);
  }
  
  // Use AI-powered group-based positioning
  return await repositionGraphNodesWithGroups(graph);
};

// Original positioning logic (for when no groups are present)
const repositionGraphNodesOriginal = (graph) => {
  const nodeMap = {};
  const incomingCount = {};
  const outgoingMap = {};

  graph.nodes.forEach((node) => {
    nodeMap[node.slug] = node;
    incomingCount[node.slug] = 0;
    outgoingMap[node.slug] = [];
  });

  // Build edges
  graph.nodes.forEach((node) => {
    node.next_nodes?.forEach((next) => {
      incomingCount[next.slug]++;
      outgoingMap[node.slug].push(next.slug);
    });
  });

  // Topological sort using Kahn’s algorithm
  const layers = [];
  const queue = [];

  for (const slug in incomingCount) {
    if (incomingCount[slug] === 0) queue.push(slug);
  }

  const visited = new Set();

  while (queue.length > 0) {
    const nextQueue = [];
    const currentLayer = [];

    while (queue.length > 0) {
      const slug = queue.shift();
      if (visited.has(slug)) continue;
      visited.add(slug);
      currentLayer.push(slug);

      outgoingMap[slug]?.forEach((neighbor) => {
        incomingCount[neighbor]--;
        if (incomingCount[neighbor] === 0) {
          nextQueue.push(neighbor);
        }
      });
    }

    layers.push(currentLayer);
    queue.push(...nextQueue);
  }

  // Reposition nodes
  const horizontalSpacing = 300;
  const verticalSpacing = 300;

  layers.forEach((layer, y) => {
    layer.forEach((slug, x) => {
      const node = nodeMap[slug];
      node.position = {
        x: x * horizontalSpacing,
        y: y * verticalSpacing,
      };
    });
  });

  // Resolve any residual collisions on the same Y (layer) by moving along X only,
  // keeping a strict separation of `horizontalSpacing` (300) between nodes
  const yToXMap = new Map();
  graph.nodes.forEach((node) => {
    const yKey = node.position.y;
    if (!yToXMap.has(yKey)) yToXMap.set(yKey, new Map());
    const xMap = yToXMap.get(yKey);
    const xKey = node.position.x;
    if (!xMap.has(xKey)) xMap.set(xKey, []);
    xMap.get(xKey).push(node);
  });

  for (const [, xMap] of yToXMap.entries()) {
    // Build occupied X set for this Y layer
    const occupiedX = new Set(Array.from(xMap.keys()));
    for (const [xValue, nodesAtSameX] of xMap.entries()) {
      if (nodesAtSameX.length <= 1) continue;
      // Keep first node at the original x; move the rest to the next available slots to the right
      const sorted = nodesAtSameX.sort((a, b) => (a.slug || '').localeCompare(b.slug || ''));
      // First stays
      const [, ...rest] = sorted;
      for (const node of rest) {
        let candidateX = xValue;
        // Find next free X slot spaced by horizontalSpacing
        do {
          candidateX += horizontalSpacing;
        } while (occupiedX.has(candidateX));
        node.position.x = candidateX;
        occupiedX.add(candidateX);
      }
    }
  }

  // Final normalization: ensure contiguous 300px spacing along X within each Y layer
  const nodesByY = new Map();
  graph.nodes.forEach((node) => {
    const yKey = node.position.y;
    if (!nodesByY.has(yKey)) nodesByY.set(yKey, []);
    nodesByY.get(yKey).push(node);
  });

  for (const [, nodesAtY] of nodesByY.entries()) {
    nodesAtY
      .sort((a, b) => a.position.x - b.position.x || (a.slug || '').localeCompare(b.slug || ''))
      .forEach((node, idx) => {
        node.position.x = idx * horizontalSpacing;
      });
  }

  return graph;
};

// Simple group-based positioning by order
const repositionGraphNodesWithGroups = async (graph) => {
  try {
    console.log('🎯 Using simple group-based positioning by node order...');
    
    // Position nodes following their original order, changing Y when group changes
    const verticalSpacing = 400; // Space between groups
    const horizontalSpacing = 300; // Space between nodes in same group
    
    let currentY = 0;
    let currentGroup = null;
    let currentGroupNodes = [];
    
    // Process nodes in their original order
    graph.nodes.forEach((node, nodeIndex) => {
      const nodeGroup = node.group && node.group.trim() !== '' ? node.group : 'ungrouped';
      
      // Check if group changed
      if (currentGroup !== null && currentGroup !== nodeGroup) {
        // Position the previous group's nodes horizontally centered
        positionGroupNodes(currentGroupNodes, currentY, horizontalSpacing);
        
        // Move to next Y level for new group
        currentY += verticalSpacing;
        currentGroupNodes = [];
        
        console.log(`📍 Group changed from "${currentGroup}" to "${nodeGroup}", positioned previous group, moving to Y=${currentY}`);
      }
      
      // Update current group and add node to current group
      currentGroup = nodeGroup;
      currentGroupNodes.push(node);
      
      console.log(`  - ${node.name}: group="${nodeGroup}" (will be positioned at Y=${currentY})`);
    });
    
    // Position the last group
    if (currentGroupNodes.length > 0) {
      positionGroupNodes(currentGroupNodes, currentY, horizontalSpacing);
    }
    
    console.log('✅ Applied simple group-based positioning by node order');
    return graph;
    
  } catch (error) {
    console.error('Error in simple group positioning, falling back to original logic:', error);
    return repositionGraphNodesOriginal(graph);
  }
};

// Helper function to position nodes in a group horizontally
const positionGroupNodes = (nodes, y, horizontalSpacing) => {
  const totalWidth = (nodes.length - 1) * horizontalSpacing;
  const startX = -totalWidth / 2; // Center the group around X=0
  
  nodes.forEach((node, nodeIndex) => {
    const x = startX + (nodeIndex * horizontalSpacing);
    node.position = { x, y };
    console.log(`  ✓ Positioned ${node.name}: (${x}, ${y})`);
  });
};

// Simple spacing validation for group-based layout
const validateAndFixSpacing = (graph) => {
  // This function is now simplified since we use deterministic positioning
  // Just ensure no overlaps exist
  const nodes = graph.nodes;
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      
      const dx = Math.abs(node1.position.x - node2.position.x);
      const dy = Math.abs(node1.position.y - node2.position.y);
      
      // If nodes are too close, add some spacing
      if (dx < 50 && dy < 50) {
        node2.position.x += 100;
        node2.position.y += 100;
      }
    }
  }
}
