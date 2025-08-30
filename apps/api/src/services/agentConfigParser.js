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


export const repositionGraphNodes = async (graph) => {
  // Check if any nodes have groups
  const hasGroups = graph.nodes.some(node => node.group && node.group.trim() !== '');
  
  if (!hasGroups) {
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

// AI-powered group-based positioning
const repositionGraphNodesWithGroups = async (graph) => {
  try {
    // Prepare node data for AI analysis
    const nodeData = graph.nodes.map(node => ({
      slug: node.slug,
      name: node.name,
      type: node.type,
      group: node.group || null,
      connections: node.next_nodes?.map(n => n.slug) || [],
      description: node.description
    }));

    const prompt = `You are an expert at creating intelligent node layouts for agent workflow graphs. Given the following nodes with groups and connections, determine optimal positions that:

1. MAINTAIN MINIMUM SPACING: Each node must be separated by at least 300 units horizontally and 300 units vertically from other nodes
2. GROUP LOGIC: Nodes with the same group should be positioned near each other, forming logical clusters
3. ORCHESTRATOR PATTERN: If there's an "orchestrator" group or central coordinating node, place it in a central position with other groups arranged around it
4. FLOW DIRECTION: Respect the connection flow - connected nodes should have clear directional relationships
5. AVOID OVERLAPS: No two nodes can occupy the same position or be closer than 300 units apart

Node Data:
${JSON.stringify(nodeData, null, 2)}

Return ONLY a JSON object with this exact structure:
{
  "positions": [
    {
      "slug": "node-slug",
      "x": number,
      "y": number,
      "reasoning": "brief explanation of placement"
    }
  ],
  "layout_strategy": "brief description of the overall layout approach used"
}

Consider these placement strategies:
- Central hub: Place orchestrator/coordinator nodes in center, others radiating outward
- Grouped clusters: Group similar nodes together in distinct areas  
- Flow-based: Arrange nodes to follow the connection flow direction
- Balanced: Distribute groups evenly across the available space

CRITICAL: Ensure ALL positions maintain minimum 300px spacing and avoid overlaps!`;

    const completion = await generateAIResponse({
      messages: [
        {
          role: "system",
          content: `You are an expert at intelligent graph layout algorithms. You understand group-based positioning, flow direction, and spatial optimization. Always ensure proper spacing (minimum 300px between nodes) and logical grouping. Focus on creating layouts that are both functionally logical and visually clear.

When positioning nodes:
- Orchestrator/coordinator nodes should be centrally positioned
- Related group nodes should cluster together but maintain spacing
- Connection flow should influence vertical/horizontal relationships
- The layout should be balanced and avoid cramped areas

Always return valid JSON with exact positioning coordinates.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);
    
    // Apply the AI-generated positions to the nodes
    const positionMap = new Map();
    aiResponse.positions.forEach(pos => {
      positionMap.set(pos.slug, { x: pos.x, y: pos.y });
    });

    // Update node positions
    graph.nodes.forEach(node => {
      const aiPosition = positionMap.get(node.slug);
      if (aiPosition) {
        node.position = aiPosition;
      }
    });

    // Validate and fix any spacing issues
    validateAndFixSpacing(graph);

    console.log(`🎯 Applied group-based positioning using strategy: ${aiResponse.layout_strategy}`);
    
    return graph;

  } catch (error) {
    console.error('Error in AI-powered positioning, falling back to original logic:', error);
    return repositionGraphNodesOriginal(graph);
  }
};

// Validate spacing and fix overlaps
const validateAndFixSpacing = (graph) => {
  const minSpacing = 300;
  const nodes = graph.nodes;
  
  // Check for overlaps and resolve them
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      
      const dx = Math.abs(node1.position.x - node2.position.x);
      const dy = Math.abs(node1.position.y - node2.position.y);
      
      if (dx < minSpacing && dy < minSpacing) {
        // Nodes are too close, move node2
        if (dx < dy) {
          // Move horizontally
          node2.position.x = node1.position.x + (node2.position.x > node1.position.x ? minSpacing : -minSpacing);
        } else {
          // Move vertically  
          node2.position.y = node1.position.y + (node2.position.y > node1.position.y ? minSpacing : -minSpacing);
        }
      }
    }
  }
}
