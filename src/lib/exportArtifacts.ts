/**
 * Enterprise SVG and Printable Report Export Engine (Day 23).
 *
 * Generates standalone SVG vector diagrams and comprehensive HTML/PDF report documents
 * representing the complete graph structure, node hierarchy, metadata, and validation score.
 */

import type { TreeNode, TreeEdge } from '../types/tree';
import { validateGraph } from './validation';
import { runGraphDiagnostics } from './graphDiagnostics';

/**
 * Generates standalone SVG vector markup for the complete tree graph.
 */
export function generateGraphSvg(nodes: TreeNode[], edges: TreeEdge[]): string {
  if (nodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <text x="400" y="300" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#64748b">Empty Compliance Tree</text>
    </svg>`;
  }

  // Compute bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + 220 > maxX) maxX = x + 220;
    if (y + 120 > maxY) maxY = y + 120;
  }

  const padding = 80;
  const width = Math.max(900, maxX - minX + padding * 2);
  const height = Math.max(700, maxY - minY + padding * 2);
  const offsetX = padding - minX;
  const offsetY = padding - minY;

  const nodeMap = new Map<string, TreeNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const typeColors: Record<string, { bg: string; border: string; text: string; badgeBg: string }> = {
    root: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', badgeBg: '#dbeafe' },
    rule: { bg: '#eef2ff', border: '#6366f1', text: '#3730a3', badgeBg: '#e0e7ff' },
    condition: { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', badgeBg: '#fef3c7' },
    action: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', badgeBg: '#d1fae5' },
  };

  let svgEdges = '';
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const x1 = src.position.x + 110 + offsetX;
    const y1 = src.position.y + 90 + offsetY;
    const x2 = tgt.position.x + 110 + offsetX;
    const y2 = tgt.position.y + offsetY;

    const midY = (y1 + y2) / 2;
    const pathData = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    svgEdges += `  <path d="${pathData}" fill="none" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow)"/>\n`;
  }

  let svgNodes = '';
  for (const node of nodes) {
    const x = node.position.x + offsetX;
    const y = node.position.y + offsetY;
    const colors = typeColors[node.type] || typeColors.rule;
    const label = node.data.label || 'Untitled Node';
    const ruleId = node.data.ruleId ? `(${node.data.ruleId})` : '';

    svgNodes += `  <g transform="translate(${x}, ${y})">
    <rect width="220" height="90" rx="8" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1.5" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.08))"/>
    <rect width="220" height="28" rx="8" fill="${colors.badgeBg}"/>
    <text x="12" y="18" font-family="sans-serif" font-size="10" font-weight="bold" fill="${colors.text}">${node.type.toUpperCase()}</text>
    <text x="12" y="48" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">${escapeXml(truncateText(label, 26))}</text>
    ${ruleId ? `<text x="12" y="68" font-family="monospace" font-size="10" fill="#64748b">${escapeXml(ruleId)}</text>` : ''}
  </g>\n`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <g>
${svgEdges}
  </g>
  <g>
${svgNodes}
  </g>
</svg>`;
}

/**
 * Generates a professional printable HTML document report for PDF printing.
 */
export function generatePrintableHtmlReport(nodes: TreeNode[], edges: TreeEdge[]): string {
  const validation = validateGraph(nodes, edges);
  const diagnostics = runGraphDiagnostics(nodes, edges);
  const dateStr = new Date().toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Compliance Tree Enterprise Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #ffffff; }
    h1 { font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 8px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 30px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .card-value { font-size: 22px; font-weight: bold; color: #0f172a; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .badge-root { background: #dbeafe; color: #1e40af; }
    .badge-rule { background: #e0e7ff; color: #3730a3; }
    .badge-condition { background: #fef3c7; color: #b45309; }
    .badge-action { background: #d1fae5; color: #065f46; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>Interactive Visual Tree Editor — Compliance Report</h1>
  <div class="meta">Generated: ${dateStr} · Schema Version: 1 · Status: ${validation.valid ? 'Valid & Compliant' : 'Issues Detected'}</div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Total Nodes</div>
      <div class="card-value">${diagnostics.metrics.nodeCount}</div>
    </div>
    <div class="card">
      <div class="card-title">Connections</div>
      <div class="card-value">${diagnostics.metrics.edgeCount}</div>
    </div>
    <div class="card">
      <div class="card-title">Integrity Score</div>
      <div class="card-value">${validation.score}/100</div>
    </div>
    <div class="card">
      <div class="card-title">Max Depth</div>
      <div class="card-value">${diagnostics.metrics.maxDepth}</div>
    </div>
  </div>

  <h2>Node Hierarchy Inventory</h2>
  <table>
    <thead>
      <tr>
        <th>Type</th>
        <th>Label</th>
        <th>Rule ID</th>
        <th>Severity / Status</th>
        <th>Parameters</th>
      </tr>
    </thead>
    <tbody>
      ${nodes.map(n => `
        <tr>
          <td><span class="badge badge-${n.type}">${n.type}</span></td>
          <td><strong>${escapeXml(n.data.label || 'Untitled')}</strong><br><small style="color:#64748b">${n.id}</small></td>
          <td><code>${escapeXml(n.data.ruleId || '—')}</span></td>
          <td>${n.data.severity || 'medium'} / ${n.data.status || 'active'}</td>
          <td><code>${escapeXml(JSON.stringify(n.data.parameters || {}))}</code></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Notice: Mock/sample compliance report for demonstration purposes. Does not constitute formal legal or regulatory certification.
  </div>
</body>
</html>`;
}

function truncateText(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
