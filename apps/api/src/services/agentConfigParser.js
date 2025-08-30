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

    const prompt = `You are an expert at creating intelligent group-based node layouts for agent workflow graphs. Given the following nodes with groups and connections, determine optimal positions that:

1. **GROUP VERTICAL SEPARATION**: Different groups should be placed at different Y levels (vertically separated)
2. **HORIZONTAL WITHIN GROUPS**: Nodes within the same group should be arranged horizontally at the same Y level
3. **ORCHESTRATOR CENTRAL POSITIONING**: If there's an "orchestrator" or main coordinating node, place it in the CENTER both horizontally and vertically
4. **CLEAR GROUP BOUNDARIES**: Use 400-500px vertical spacing between different groups for clear visual separation
5. **COMPACT GROUP INTERNALS**: Use 250-300px horizontal spacing between nodes within the same group
6. **LOGICAL FLOW**: Arrange groups based on their role in the workflow (input → processing → orchestrator → output)

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

LAYOUT STRATEGY EXAMPLES:
- **Tiered Groups**: Groups at Y=0, Y=500, Y=1000 with orchestrator centered at Y=500
- **Hub and Spoke**: Orchestrator at center (0,0), groups arranged above/below at Y=-500, Y=500
- **Pipeline Flow**: Input groups at top, processing in middle, output at bottom
- **Star Pattern**: Central orchestrator with groups radiating at different Y levels

CRITICAL REQUIREMENTS:
- Orchestrator/main nodes MUST be centered (X=0 or close to center)
- Groups MUST be at different Y levels (400-500px apart)
- Same-group nodes MUST be horizontally aligned (same Y, different X)
- Clear visual hierarchy and separation between groups`;

    const completion = await generateAIResponse({
      messages: [
        {
          role: "system",
          content: `You are an expert at intelligent group-based graph layout algorithms. You specialize in creating hierarchical layouts with clear group separation. Focus on:

GROUP-BASED LAYOUT PRINCIPLES:
- **Vertical Group Separation**: Different groups at different Y levels (400-500px apart)
- **Horizontal Within Groups**: Same-group nodes horizontally aligned at same Y level
- **Central Orchestrators**: Main/orchestrator nodes positioned at center (X≈0)
- **Clear Visual Hierarchy**: Groups should have distinct vertical layers
- **Logical Flow Patterns**: Groups arranged by workflow role (input→process→orchestrator→output)

SPACING GUIDELINES:
- **Between Groups**: 400-500px vertical separation for clear boundaries
- **Within Groups**: 250-300px horizontal spacing between same-group nodes
- **Orchestrator Positioning**: X=0 or close to center, Y positioned logically in flow

LAYOUT PATTERNS:
- Hub-and-spoke: Central orchestrator with groups above/below
- Tiered pipeline: Groups in vertical layers based on workflow stage
- Star formation: Central node with groups radiating at different Y levels

Always return valid JSON with exact positioning coordinates that create clear group separation and logical hierarchy.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      responseFormat: z.object({
        positions: z.array(z.object({
          slug: z.string(),
          x: z.number(),
          y: z.number(),
          reasoning: z.string()
        })),
        layout_strategy: z.string()
      }),
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
    console.log('graph', graph);

    // Validate and fix any spacing issues
    validateAndFixSpacing(graph);

    console.log(`🎯 Applied group-based positioning using strategy: ${aiResponse.layout_strategy}`);
    
    return graph;

  } catch (error) {
    console.error('Error in AI-powered positioning, falling back to original logic:', error);
    return repositionGraphNodesOriginal(graph);
  }
};

// Validate spacing and fix overlaps with group-based layout principles
const validateAndFixSpacing = (graph) => {
  const minHorizontalSpacing = 250; // Within same group
  const minVerticalGroupSpacing = 400; // Between different groups
  const maxHorizontalSpacing = 350; // Prevent ultra-wide same-group spacing
  const nodes = graph.nodes;
  
  // Check for overlaps and resolve them based on group relationships
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      
      const dx = Math.abs(node1.position.x - node2.position.x);
      const dy = Math.abs(node1.position.y - node2.position.y);
      const sameGroup = node1.group && node2.group && node1.group === node2.group;
      
      if (sameGroup) {
        // Same group: should be horizontally aligned and properly spaced
        if (Math.abs(node1.position.y - node2.position.y) > 50) {
          // Align Y positions for same group
          const avgY = (node1.position.y + node2.position.y) / 2;
          node1.position.y = avgY;
          node2.position.y = avgY;
        }
        
        // Ensure proper horizontal spacing within group
        if (dx < minHorizontalSpacing) {
          const midX = (node1.position.x + node2.position.x) / 2;
          const adjustment = minHorizontalSpacing / 2;
          node1.position.x = midX - adjustment;
          node2.position.x = midX + adjustment;
        }
        
        // Prevent ultra-wide spacing within same group
        if (dx > maxHorizontalSpacing) {
          const midX = (node1.position.x + node2.position.x) / 2;
          const adjustment = (maxHorizontalSpacing * 0.8) / 2;
          node1.position.x = midX - adjustment;
          node2.position.x = midX + adjustment;
        }
      } else {
        // Different groups: ensure proper vertical separation
        if (dy < minVerticalGroupSpacing && dx < 300) {
          // Move groups apart vertically
          const adjustment = minVerticalGroupSpacing / 2;
          if (node1.position.y < node2.position.y) {
            node1.position.y -= adjustment;
            node2.position.y += adjustment;
          } else {
            node1.position.y += adjustment;
            node2.position.y -= adjustment;
          }
        }
      }
    }
  }
  
  // Identify and center orchestrator nodes
  const orchestratorKeywords = ['orchestrator', 'coordinator', 'manager', 'hub', 'central', 'main'];
  nodes.forEach(node => {
    const isOrchestrator = orchestratorKeywords.some(keyword => 
      node.name.toLowerCase().includes(keyword) || 
      node.slug.toLowerCase().includes(keyword) ||
      (node.group && node.group.toLowerCase().includes(keyword))
    );
    
    if (isOrchestrator) {
      // Center orchestrator horizontally
      node.position.x = 0;
      console.log(`🎯 Centered orchestrator node: ${node.name} at X=0`);
    }
  });
}
