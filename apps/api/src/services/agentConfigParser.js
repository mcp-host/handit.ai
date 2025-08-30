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

    const prompt = `You are an expert at creating intelligent HORIZONTAL node layouts for agent workflow graphs. Given the following nodes with groups and connections, determine optimal positions that:

1. HORIZONTAL GROUP ARRANGEMENT: Arrange groups side-by-side horizontally, NOT vertically stacked
2. COMPACT SPACING: Use 250-300px spacing between nodes (not ultra-separated, but clear)  
3. GROUP CLUSTERING: Nodes with the same group should form horizontal clusters
4. ORCHESTRATOR PATTERN: If there's an "orchestrator" group or central coordinating node, place it in the center with other groups arranged horizontally around it
5. FLOW DIRECTION: Create logical left-to-right or center-outward flow patterns
6. FLAT LAYOUT: Prefer wide, relatively flat layouts over tall vertical arrangements

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

PREFERRED LAYOUT STRATEGIES:
- **Horizontal Hub**: Place orchestrator in center, groups arranged horizontally on left/right
- **Linear Groups**: Arrange all groups in a horizontal line with logical spacing
- **Center-Outward**: Central nodes with groups radiating horizontally outward
- **Flow-based Horizontal**: Left-to-right flow with groups arranged horizontally

AVOID:
- Vertical stacking of groups
- Ultra-wide separation (>400px between nodes)
- Cramped clustering (<200px between nodes)

CRITICAL: Create wide, flat layouts with horizontal group arrangements!`;

    const completion = await generateAIResponse({
      messages: [
        {
          role: "system",
          content: `You are an expert at intelligent HORIZONTAL graph layout algorithms. You specialize in creating wide, flat layouts with horizontal group arrangements. Focus on:

HORIZONTAL LAYOUT PRINCIPLES:
- Groups should be arranged side-by-side (horizontal clusters), NOT vertically stacked
- Use 250-300px spacing between nodes (compact but clear, not ultra-separated)
- Create wide, relatively flat layouts rather than tall vertical arrangements
- Position orchestrators centrally with groups arranged horizontally around them
- Establish logical left-to-right or center-outward flow patterns

SPACING GUIDELINES:
- Minimum 250px between nodes
- Maximum 350px between nodes (avoid ultra-separation)
- Groups should form distinct horizontal clusters

Always return valid JSON with exact positioning coordinates optimized for horizontal viewing.`
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

// Validate spacing and fix overlaps with horizontal layout preference
const validateAndFixSpacing = (graph) => {
  const minSpacing = 250;
  const maxSpacing = 350;
  const nodes = graph.nodes;
  
  // Check for overlaps and resolve them with horizontal preference
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];
      
      const dx = Math.abs(node1.position.x - node2.position.x);
      const dy = Math.abs(node1.position.y - node2.position.y);
      
      if (dx < minSpacing && dy < minSpacing) {
        // Nodes are too close, prefer horizontal separation for flat layout
        node2.position.x = node1.position.x + (node2.position.x > node1.position.x ? minSpacing : -minSpacing);
        
        // Only adjust vertically if nodes are in different groups or if horizontal adjustment isn't enough
        if (node1.group !== node2.group && dy < minSpacing / 2) {
          node2.position.y = node1.position.y + (node2.position.y > node1.position.y ? minSpacing / 2 : -minSpacing / 2);
        }
      }
      
      // Prevent ultra-wide separation while maintaining group clustering
      if (dx > maxSpacing && node1.group === node2.group) {
        // Bring nodes in the same group closer together
        const midX = (node1.position.x + node2.position.x) / 2;
        const adjustment = (maxSpacing * 0.8) / 2; // 80% of max spacing
        node1.position.x = midX - adjustment;
        node2.position.x = midX + adjustment;
      }
    }
  }
}
