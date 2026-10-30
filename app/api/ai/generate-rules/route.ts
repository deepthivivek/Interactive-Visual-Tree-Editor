import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { validateGraph } from '@/src/lib/validation';
import { calculateAutoLayout } from '@/src/lib/autoLayout';
import type { TreeNode, TreeEdge } from '@/src/types/tree';



export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: "API key missing or invalid. GEMINI_API_KEY environment variable is not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are a senior compliance officer and graph architecture expert.
Given natural language compliance requirements, generate a valid hierarchical compliance tree consisting of nodes and directed edges.
Relationship Grammar Rules:
- Root -> Rule
- Rule -> Condition, Rule -> Action
- Condition -> Action
- Action has no outgoing children
- Condition -> Condition is not allowed
- Exactly 1 Root node
- Acyclic graph (no cycles)

Node types allowed: "root", "rule", "condition", "action".
Return ONLY valid JSON conforming to the requested schema.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Title of the generated compliance policy framework" },
        description: { type: Type.STRING, description: "Brief executive summary of the framework" },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Unique stable identifier (e.g. root-policy, rule-01, cond-01, act-01)" },
              type: { type: Type.STRING, description: "Node type: root, rule, condition, or action" },
              position: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
                required: ["x", "y"],
              },
              data: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  ruleId: { type: Type.STRING },
                  description: { type: Type.STRING },
                  severity: { type: Type.STRING, description: "info, low, medium, high, or critical" },
                  status: { type: Type.STRING, description: "active, deprecated, or draft" },
                  parameters: { type: Type.OBJECT },
                },
                required: ["label"],
              },
            },
            required: ["id", "type", "position", "data"],
          },
        },
        edges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Unique edge ID (e.g. e-root-rule)" },
              source: { type: Type.STRING, description: "Source node ID" },
              target: { type: Type.STRING, description: "Target node ID" },
              data: {
                type: Type.OBJECT,
                properties: {
                  relationshipType: { type: Type.STRING, description: "root-rule, rule-condition, rule-action, or condition-action" },
                },
              },
            },
            required: ["id", "source", "target"],
          },
        },
      },
      required: ["title", "nodes", "edges"],
    };

    // Candidate models in preference order (gemini-3.5-flash, gemini-3.6-flash, gemini-flash-latest)
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"];

    let responseText: string | null = null;
    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errMsg = lastError.message.toLowerCase();
        // If 503 / high demand or 429 rate limit, try fallback model
        if (errMsg.includes("503") || errMsg.includes("demand") || errMsg.includes("429") || errMsg.includes("unavailable")) {
          continue;
        }
        // Non-transient error (e.g. 401 unauthorized), break early
        break;
      }
    }

    if (!responseText) {
      const errMsg = lastError ? lastError.message : "No response generated";
      if (errMsg.includes("503") || errMsg.includes("demand") || errMsg.includes("unavailable")) {
        return NextResponse.json(
          { error: "API quota exceeded or model experiencing high demand. Please try again in a moment." },
          { status: 503 }
        );
      }
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("key")) {
        return NextResponse.json(
          { error: "API key missing or invalid." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `AI generation failed: ${errMsg}` },
        { status: 500 }
      );
    }

    // Clean JSON of any code fence blocks
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      return NextResponse.json(
        { error: "Generated response failed validation. Invalid JSON syntax returned by AI." },
        { status: 502 }
      );
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return NextResponse.json(
        { error: "Generated response failed validation. Missing required nodes or edges structure." },
        { status: 502 }
      );
    }

    // Sanitize node position coordinates and data fields
    const sanitizedNodes: TreeNode[] = parsed.nodes.map((node: any, idx: number) => ({
      id: node.id || `node-${idx + 1}`,
      type: (['root', 'rule', 'condition', 'action'].includes(node.type) ? node.type : 'rule'),
      position: {
        x: typeof node.position?.x === 'number' ? node.position.x : 200 + (idx % 3) * 220,
        y: typeof node.position?.y === 'number' ? node.position.y : 100 + Math.floor(idx / 3) * 150,
      },
      data: {
        label: node.data?.label || node.id || `Node ${idx + 1}`,
        ruleId: node.data?.ruleId || '',
        description: node.data?.description || '',
        severity: node.data?.severity || 'medium',
        status: node.data?.status || 'active',
        parameters: node.data?.parameters || {},
      },
    }));

    const sanitizedEdges: TreeEdge[] = parsed.edges.map((edge: any, idx: number) => ({
      id: edge.id || `e-${idx + 1}`,
      source: edge.source,
      target: edge.target,
      data: {
        relationshipType: edge.data?.relationshipType || 'rule-condition',
      },
    }));

    // Apply auto layout positioning to generated proposal graph
    const layoutRes = calculateAutoLayout(sanitizedNodes, sanitizedEdges);
    const layoutNodes = layoutRes.ok
      ? sanitizedNodes.map((node: TreeNode) => {
          const pos = layoutRes.positions[node.id];
          return pos ? { ...node, position: pos } : node;
        })
      : sanitizedNodes;





    // Validate generated graph structure
    const validation = validateGraph(layoutNodes, sanitizedEdges);

    return NextResponse.json({
      success: true,
      proposal: {
        title: parsed.title || 'Generated Compliance Policy',
        description: parsed.description || 'AI generated policy framework',
        nodes: layoutNodes,
        edges: sanitizedEdges,
      },
      validation,
    });

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Server error: ${errMessage}` }, { status: 500 });
  }
}
