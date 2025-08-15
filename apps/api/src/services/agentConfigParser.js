import { z } from 'zod';
import { generateAIResponse } from './aiService.js';


// Define the Zod schema for the configuration
const NodeSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  type: z.enum(['model', 'tool']),
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
          content: "You are an expert at parsing and structuring agent configurations. Always ensure proper node positioning and connection mapping. Arrange nodes in a top-to-bottom layout with proper spacing, and make sure the nodes are not overlapping, so use 300 units of spacing between nodes on Y axis and 300 units of spacing between nodes on X axis. If you see AI Agent node that must always be a model node. Organize the nodes top to down and consider inputs and outputs, so always a node that is an input for another node must be above the node that is the output for the other node."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      responseFormat: AgentConfigSchema
    });

    const parsedConfig = JSON.parse(completion.choices[0].message.content);

    return repositionGraphNodes(parsedConfig);
  } catch (error) {
    console.error('Error parsing agent config:', error);
    throw error;
  }
};


export const repositionGraphNodes = (graph) => {
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

  

  return graph;
}
