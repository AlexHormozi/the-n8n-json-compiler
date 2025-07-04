import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

/**
 * POST /compile
 * Body: { workflow: { nodes, edges, name, ... } }
 */
app.post("/compile", async (req, res) => {
  const input = req.body.workflow;

  if (!input?.nodes || !input?.edges) {
    return res.status(400).json({ error: "Invalid workflow format" });
  }

  // 1. Build nodes array
  const n8nNodes = input.nodes.map(n => ({
    name: n.label || n.name || `Node-${n.id}`,
    type: `ai-sdr.${n.type}`,
    position: [n.position?.x || 0, n.position?.y || 0],
    parameters: {
      ...n.parameters,
      description: n.description || "",
    },
    typeVersion: 1
  }));

  // 2. Build connections object
  const connections = {};
  input.edges.forEach(edge => {
    const sourceNode = input.nodes.find(n => n.id === edge.source);
    const targetNode = input.nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return;

    const sourceName = sourceNode.label || sourceNode.name;
    const targetName = targetNode.label || targetNode.name;

    if (!connections[sourceName]) {
      connections[sourceName] = { main: [[]] };
    }
    connections[sourceName].main[0].push({
      node: targetName,
      type: edge.connection?.type || "main",
      index: 0
    });
  });

  // 3. Final compiled workflow JSON
  const compiledWorkflow = {
    name: input.name || "Compiled Workflow",
    nodes: n8nNodes,
    connections: connections,
    active: false
  };

  try {
    // 4. Call n8n API to create the workflow
    const n8nURL = process.env.N8N_API_URL; // e.g., https://your-n8n-domain/api/v1
    const n8nAPIKey = process.env.N8N_API_KEY; // If you secured it

    const response = await axios.post(
      `${n8nURL}/workflows`,
      compiledWorkflow,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${n8nAPIKey}`
        }
      }
    );

    console.log("n8n API response:", response.data);
    return res.json({
      status: "success",
      workflowId: response.data.id,
      workflowName: response.data.name
    });

  } catch (err) {
    console.error("n8n API error:", err?.response?.data || err.message);
    return res.status(500).json({ error: "Failed to create workflow in n8n", details: err?.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Compiler listening on port ${PORT}`);
});
