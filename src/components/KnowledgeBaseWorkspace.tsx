import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Columns,
  Eye,
  FileText,
  FolderTree,
  Hash,
  Link2,
  Maximize2,
  Network,
  Pencil,
  Plus,
  Search,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { AnchorEvent, Course, Note, TaskBlock } from '../types/academic';
import { formatShortDate } from '../utils/dateUtils';
import { ActionIcon, Checkbox, Dot } from './ui';

interface KnowledgeBaseWorkspaceProps {
  onEditTask: (task: TaskBlock) => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
}

/* ============================================================================
 * Lightweight LaTeX / Math Formatter ($...$ and $$...$$)
 * ========================================================================== */
function formatMathExpression(tex: string): string {
  return tex
    .replace(/\\nabla/g, '∇')
    .replace(/\\partial/g, '∂')
    .replace(/\\infty/g, '∞')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\int/g, '∫')
    .replace(/\\mathbb\{E\}/g, '𝔼')
    .replace(/\\hat\{\\mathbb\{E\}\}/g, '𝔼̂')
    .replace(/\\mathcal\{L\}/g, 'ℒ')
    .replace(/\\lfloor/g, '⌊')
    .replace(/\\rfloor/g, '⌋')
    .replace(/\\ge|\\geq/g, '≥')
    .replace(/\\le|\\leq/g, '≤')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\to|\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\theta/g, 'θ')
    .replace(/\\phi/g, 'φ')
    .replace(/\\pi/g, 'π')
    .replace(/\\epsilon/g, 'ϵ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\tilde\{([^}]+)\}/g, '$1̃')
    .replace(/\\hat\{([^}]+)\}/g, '$1̂')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\left|\\right/g, '')
    .replace(/\\\|/g, '‖')
    .replace(/\\mid/g, '|')
    .replace(/\\,/g, ' ');
}

/* ============================================================================
 * Interactive Force-Directed Topic Graph (SVG + Physics Loop)
 * ========================================================================== */
type GraphNodeKind = 'NOTE' | 'ANCHOR' | 'TASK';

interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  courseId: string;
  colorHex: string;
  degree: number;
  completed?: boolean;
  refNote?: Note;
  refAnchor?: AnchorEvent;
  refTask?: TaskBlock;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

const TopicForceGraph: React.FC<{
  notes: Note[];
  courses: Course[];
  anchorEvents: AnchorEvent[];
  taskBlocks: TaskBlock[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
}> = ({
  notes,
  courses,
  anchorEvents,
  taskBlocks,
  selectedNodeId,
  onSelectNode,
}) => {
  // Bottom-left control box states
  const [searchQuery, setSearchQuery] = useState('');
  const [gravity, setGravity] = useState(0.06);
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string | 'ALL'>('ALL');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Viewport pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const draggedNodeIdRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Build structural graph data from notes, anchors, tasks, and [[WikiLinks]]
  const { structuralNodes, structuralEdges } = useMemo(() => {
    const courseColor = (courseId: string) =>
      courses.find((c) => c.id === courseId)?.colorHex || '#8E8E93';

    const nodesMap = new Map<string, Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy'>>();
    const edgesList: GraphEdge[] = [];
    const addEdge = (s: string, t: string) => {
      if (s === t) return;
      const key = s < t ? `${s}--${t}` : `${t}--${s}`;
      if (!edgesList.some((e) => e.id === key)) {
        edgesList.push({ id: key, source: s, target: t });
      }
    };

    // 1. Study Notes (Circular nodes)
    for (const n of notes) {
      if (courseFilter !== 'ALL' && n.courseId !== courseFilter) continue;
      nodesMap.set(`note:${n.id}`, {
        id: `note:${n.id}`,
        kind: 'NOTE',
        label: n.title,
        courseId: n.courseId,
        colorHex: courseColor(n.courseId),
        degree: 0,
        refNote: n,
      });
    }

    // 2. Fixed Exams / Deadlines (Square nodes)
    for (const a of anchorEvents) {
      if (courseFilter !== 'ALL' && a.courseId !== courseFilter) continue;
      nodesMap.set(`anchor:${a.id}`, {
        id: `anchor:${a.id}`,
        kind: 'ANCHOR',
        label: a.title,
        courseId: a.courseId,
        colorHex: courseColor(a.courseId),
        degree: 0,
        completed: a.completed,
        refAnchor: a,
      });
    }

    // 3. Task Blocks (Tiny dots)
    for (const t of taskBlocks) {
      if (!showDoneTasks && t.status === 'DONE') continue;
      if (courseFilter !== 'ALL' && t.courseId !== courseFilter) continue;
      nodesMap.set(`task:${t.id}`, {
        id: `task:${t.id}`,
        kind: 'TASK',
        label: t.title,
        courseId: t.courseId,
        colorHex: courseColor(t.courseId),
        degree: 0,
        completed: t.status === 'DONE',
        refTask: t,
      });
    }

    // Connect Tasks -> Linked AnchorEvents or Dependencies
    for (const t of taskBlocks) {
      const tKey = `task:${t.id}`;
      if (!nodesMap.has(tKey)) continue;
      if (t.anchorId && nodesMap.has(`anchor:${t.anchorId}`)) {
        addEdge(tKey, `anchor:${t.anchorId}`);
      }
      if (t.dependencyId && nodesMap.has(`task:${t.dependencyId}`)) {
        addEdge(tKey, `task:${t.dependencyId}`);
      }
    }

    // Connect Notes -> [[WikiLinks]] + explicit linkedAnchorIds / linkedTaskIds
    for (const n of notes) {
      const nKey = `note:${n.id}`;
      if (!nodesMap.has(nKey)) continue;

      for (const aId of n.linkedAnchorIds || []) {
        if (nodesMap.has(`anchor:${aId}`)) addEdge(nKey, `anchor:${aId}`);
      }
      for (const tId of n.linkedTaskIds || []) {
        if (nodesMap.has(`task:${tId}`)) addEdge(nKey, `task:${tId}`);
      }

      // Parse [[...]] tokens
      const matches = n.content.matchAll(/\[\[([^\]]+)\]\]/g);
      for (const m of matches) {
        const token = m[1]?.trim().toLowerCase();
        if (!token) continue;

        for (const otherNote of notes) {
          if (
            otherNote.id !== n.id &&
            otherNote.title.trim().toLowerCase() === token &&
            nodesMap.has(`note:${otherNote.id}`)
          ) {
            addEdge(nKey, `note:${otherNote.id}`);
          }
        }
        for (const a of anchorEvents) {
          if (
            (a.title.trim().toLowerCase() === token ||
              a.title.toLowerCase().includes(token)) &&
            nodesMap.has(`anchor:${a.id}`)
          ) {
            addEdge(nKey, `anchor:${a.id}`);
          }
        }
        for (const t of taskBlocks) {
          if (
            t.title.trim().toLowerCase() === token &&
            nodesMap.has(`task:${t.id}`)
          ) {
            addEdge(nKey, `task:${t.id}`);
          }
        }
      }
    }

    // Also lightly connect same-course Notes & Exams if isolated so course clusters form naturally
    const allNodes = Array.from(nodesMap.values());
    for (const edge of edgesList) {
      const s = nodesMap.get(edge.source);
      const t = nodesMap.get(edge.target);
      if (s) s.degree += 1;
      if (t) t.degree += 1;
    }

    return {
      structuralNodes: allNodes,
      structuralEdges: edgesList,
    };
  }, [notes, courses, anchorEvents, taskBlocks, showDoneTasks, courseFilter]);

  // Mutable simulation state + animation frame tick
  const simNodesRef = useRef<GraphNode[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const prevMap = new Map(simNodesRef.current.map((n) => [n.id, n]));
    const count = structuralNodes.length || 1;
    simNodesRef.current = structuralNodes.map((n, i) => {
      const existing = prevMap.get(n.id);
      const angle = (2 * Math.PI * i) / count;
      const radius = 110 + (i % 3) * 35;
      return {
        ...n,
        x: existing ? existing.x : Math.cos(angle) * radius,
        y: existing ? existing.y : Math.sin(angle) * radius,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
      };
    });
  }, [structuralNodes]);

  useEffect(() => {
    let rafId: number;
    const step = () => {
      const nodes = simNodesRef.current;
      const N = nodes.length;
      if (N > 0) {
        const nodeById = new Map(nodes.map((n) => [n.id, n]));

        // 1. Center gravity + Course cluster pull
        for (let i = 0; i < N; i++) {
          const a = nodes[i];
          if (draggedNodeIdRef.current === a.id) continue;
          a.vx -= a.x * gravity * 0.15;
          a.vy -= a.y * gravity * 0.15;

          // Repulsion (Coulomb)
          for (let j = i + 1; j < N; j++) {
            const b = nodes[j];
            const dx = b.x - a.x || 0.1;
            const dy = b.y - a.y || 0.1;
            const distSq = dx * dx + dy * dy + 60;
            const force = 2600 / distSq;
            const dist = Math.sqrt(distSq);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (draggedNodeIdRef.current !== a.id) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (draggedNodeIdRef.current !== b.id) {
              b.vx += fx;
              b.vy += fy;
            }

            // Subtle attraction between nodes of the same course
            if (a.courseId && a.courseId === b.courseId) {
              const pull = gravity * 0.015;
              if (draggedNodeIdRef.current !== a.id) {
                a.vx += dx * pull;
                a.vy += dy * pull;
              }
              if (draggedNodeIdRef.current !== b.id) {
                b.vx -= dx * pull;
                b.vy -= dy * pull;
              }
            }
          }
        }

        // 2. Spring attraction along edges
        const idealLen = 95;
        for (const edge of structuralEdges) {
          const s = nodeById.get(edge.source);
          const t = nodeById.get(edge.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const diff = (dist - idealLen) * (0.04 + gravity * 0.25);
          const fx = (dx / dist) * diff;
          const fy = (dy / dist) * diff;
          if (draggedNodeIdRef.current !== s.id) {
            s.vx += fx;
            s.vy += fy;
          }
          if (draggedNodeIdRef.current !== t.id) {
            t.vx -= fx;
            t.vy -= fy;
          }
        }

        // 3. Velocity damping & position update
        for (const n of nodes) {
          if (draggedNodeIdRef.current === n.id) continue;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x += n.vx;
          n.y += n.vy;
        }
      }
      setTick((t) => (t + 1) % 1000000);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [structuralEdges, gravity]);

  // Neighbor set for hovered node (hover to highlight path)
  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!hoveredNodeId) return set;
    set.add(hoveredNodeId);
    for (const e of structuralEdges) {
      if (e.source === hoveredNodeId) set.add(e.target);
      if (e.target === hoveredNodeId) set.add(e.source);
    }
    return set;
  }, [hoveredNodeId, structuralEdges]);

  const queryLower = searchQuery.trim().toLowerCase();

  // Pointer handlers for node drag and canvas pan
  const clientToGraphCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2 - pan.x;
    const cy = clientY - rect.top - rect.height / 2 - pan.y;
    return { x: cx / zoom, y: cy / zoom };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggedNodeIdRef.current) {
      const pt = clientToGraphCoords(e.clientX, e.clientY);
      const target = simNodesRef.current.find((n) => n.id === draggedNodeIdRef.current);
      if (target) {
        target.x = pt.x;
        target.y = pt.y;
        target.vx = 0;
        target.vy = 0;
      }
      return;
    }
    if (isPanningRef.current) {
      setPan({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      });
    }
  };

  const handlePointerUp = () => {
    draggedNodeIdRef.current = null;
    isPanningRef.current = false;
  };

  const nodes = simNodesRef.current;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="relative w-full h-full bg-app overflow-hidden select-none">
      {/* Legend & Zoom Controls (Top-Right) */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-panel/90 backdrop-blur border border-line text-[10px] font-mono text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-fg inline-block" /> Note
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-fg inline-block" /> Exam/Deadline
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-fg inline-block" /> Task
          </span>
        </div>
        <div className="flex items-center rounded-lg bg-panel/90 backdrop-blur border border-line p-0.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.6, +(z + 0.2).toFixed(2)))}
            className="icon-btn"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}
            className="icon-btn"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-1.5 font-mono text-[10px] text-muted hover:text-fg"
            title="Reset view"
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <svg
        ref={svgRef}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.12 : -0.12;
          setZoom((z) => Math.max(0.35, Math.min(2.8, +(z + delta).toFixed(2))));
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            isPanningRef.current = true;
            panStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              panX: pan.x,
              panY: pan.y,
            };
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <g
          transform={`translate(${
            (svgRef.current?.clientWidth || 600) / 2 + pan.x
          }, ${(svgRef.current?.clientHeight || 450) / 2 + pan.y}) scale(${zoom})`}
        >
          {/* Edges */}
          {structuralEdges.map((edge) => {
            const s = nodeById.get(edge.source);
            const t = nodeById.get(edge.target);
            if (!s || !t) return null;
            const isHighlighted =
              hoveredNodeId &&
              (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
            const isDimmed = hoveredNodeId && !isHighlighted;
            return (
              <line
                key={edge.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={isHighlighted ? s.colorHex : 'var(--c-line-strong)'}
                strokeWidth={isHighlighted ? 2.2 : 1.1}
                strokeOpacity={isDimmed ? 0.15 : isHighlighted ? 0.95 : 0.55}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNodeId === node.id;
            const isSelected = selectedNodeId === node.id;
            const isNeighbor = neighborIds.has(node.id);
            const matchesSearch =
              queryLower.length > 0 &&
              node.label.toLowerCase().includes(queryLower);
            const isDimmed =
              (hoveredNodeId && !isNeighbor) ||
              (queryLower.length > 0 && !matchesSearch);

            // Scale size based on connectiveness (degree)
            const degreeBoost = Math.min(14, node.degree * 2.6);
            const radius =
              node.kind === 'NOTE'
                ? 9 + degreeBoost
                : node.kind === 'ANCHOR'
                ? 8 + degreeBoost * 0.8
                : 4.5 + Math.min(5, node.degree * 1.2);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ opacity: isDimmed ? 0.22 : 1, transition: 'opacity 150ms' }}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() =>
                  setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                }
                onPointerDown={(e) => {
                  e.stopPropagation();
                  draggedNodeIdRef.current = node.id;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                className="cursor-pointer"
              >
                {/* Selection / Search Halo */}
                {(isSelected || isHovered || matchesSearch) && (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke={node.colorHex}
                    strokeWidth={1.6}
                    strokeDasharray={matchesSearch ? '3 2' : undefined}
                    opacity={0.85}
                  />
                )}

                {/* Shape by Node Kind: Circle = Study Note, Square = Fixed Exam, Tiny Dot = Task */}
                {node.kind === 'NOTE' && (
                  <circle
                    r={radius}
                    fill={node.colorHex}
                    stroke="var(--c-panel)"
                    strokeWidth={2}
                  />
                )}
                {node.kind === 'ANCHOR' && (
                  <rect
                    x={-radius}
                    y={-radius}
                    width={radius * 2}
                    height={radius * 2}
                    rx={3}
                    fill={node.colorHex}
                    stroke="var(--c-fg)"
                    strokeWidth={1.6}
                  />
                )}
                {node.kind === 'TASK' && (
                  <circle
                    r={radius}
                    fill={node.completed ? 'var(--c-muted)' : node.colorHex}
                    stroke="var(--c-app)"
                    strokeWidth={1.2}
                  />
                )}

                {/* Node Label */}
                {(node.kind !== 'TASK' || isHovered || isSelected || matchesSearch) && (
                  <text
                    y={radius + 12}
                    textAnchor="middle"
                    fill="var(--c-fg)"
                    fontSize={node.kind === 'NOTE' ? 11 : 10}
                    fontFamily="JetBrains Mono, monospace"
                    className="pointer-events-none select-none"
                  >
                    {node.label.length > 26
                      ? `${node.label.slice(0, 24)}…`
                      : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Bottom-Left Graph Control Menu */}
      <div className="absolute bottom-3 left-3 z-10 w-64 rounded-xl bg-panel/95 backdrop-blur border border-line p-3 shadow-xl space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="section-label flex items-center gap-1.5">
            <Sliders className="w-3 h-3" /> Graph Controls
          </span>
          <span className="font-mono text-[10px] text-subtle">
            {nodes.length} nodes · {structuralEdges.length} links
          </span>
        </div>

        {/* Search Nodes */}
        <div className="relative">
          <Search className="w-3 h-3 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="input !pl-7 !py-1 !text-[11px]"
          />
        </div>

        {/* Gravity / Attraction Slider */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted mb-1">
            <span>Attraction Force (Gravity)</span>
            <span>{Math.round(gravity * 1000)}</span>
          </div>
          <input
            type="range"
            min={0.01}
            max={0.22}
            step={0.01}
            value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))}
            className="w-full accent-current cursor-pointer h-1"
          />
        </div>

        {/* Filter by Subject & Hide/Show Done Tasks */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="input !py-1 !px-2 !text-[11px] flex-1"
          >
            <option value="ALL">All Subjects</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={showDoneTasks}
              onChange={(e) => setShowDoneTasks(e.target.checked)}
            />
            <span>Done Tasks</span>
          </label>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * Main Obsidian-Like Knowledge Base Workspace
 * ========================================================================== */
export const KnowledgeBaseWorkspace: React.FC<KnowledgeBaseWorkspaceProps> = ({
  onEditTask,
  onEditAnchor,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const notes = useAcademicStore((s) => s.notes);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const srCards = useAcademicStore((s) => s.srCards);
  const selectedNoteId = useAcademicStore((s) => s.selectedNoteId);
  const setSelectedNoteId = useAcademicStore((s) => s.setSelectedNoteId);
  const addNote = useAcademicStore((s) => s.addNote);
  const updateNote = useAcademicStore((s) => s.updateNote);
  const deleteNote = useAcademicStore((s) => s.deleteNote);
  const toggleTaskStatus = useAcademicStore((s) => s.toggleTaskStatus);
  const toggleAnchorCompleted = useAcademicStore((s) => s.toggleAnchorCompleted);
  const loadSampleTemplate = useAcademicStore((s) => s.loadSampleTemplate);

  const [dirSearch, setDirSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'COURSE' | 'TAG'>('COURSE');
  const [viewLayout, setViewLayout] = useState<'SPLIT_GRAPH' | 'EDITOR_SPLIT' | 'GRAPH_ONLY'>(
    'SPLIT_GRAPH'
  );
  const [newTagInput, setNewTagInput] = useState('');
  const [inspectedGraphNode, setInspectedGraphNode] = useState<GraphNode | null>(
    null
  );

  // `[[` Wiki-link autocomplete state
  const [wikiSuggest, setWikiSuggest] = useState<{
    query: string;
    startIdx: number;
    cursorIdx: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || notes[0] || null,
    [notes, selectedNoteId]
  );

  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNoteId, setSelectedNoteId]);

  // Directory filtering & grouping
  const filteredNotes = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, dirSearch]);

  // Suggestions for `[[` dropdown (Notes, Exams/Anchors, Tasks, Flashcards)
  const wikiCandidates = useMemo(() => {
    if (!wikiSuggest) return [];
    const q = wikiSuggest.query.toLowerCase();
    const items: {
      id: string;
      kind: 'NOTE' | 'EXAM' | 'TASK' | 'CARD';
      title: string;
      sub: string;
      refId: string;
    }[] = [];

    for (const n of notes) {
      if (activeNote && n.id === activeNote.id) continue;
      items.push({
        id: `n-${n.id}`,
        kind: 'NOTE',
        title: n.title,
        sub: 'Note',
        refId: n.id,
      });
    }
    for (const a of anchorEvents) {
      items.push({
        id: `a-${a.id}`,
        kind: 'EXAM',
        title: a.title,
        sub: a.type,
        refId: a.id,
      });
    }
    for (const t of taskBlocks) {
      items.push({
        id: `t-${t.id}`,
        kind: 'TASK',
        title: t.title,
        sub: 'Task Block',
        refId: t.id,
      });
    }
    for (const c of srCards) {
      items.push({
        id: `c-${c.id}`,
        kind: 'CARD',
        title: c.topicTitle,
        sub: 'Review Card',
        refId: c.id,
      });
    }

    return items
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [wikiSuggest, notes, anchorEvents, taskBlocks, srCards, activeNote]);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeNote) return;
    const val = e.target.value;
    const caret = e.target.selectionStart || 0;
    updateNote(activeNote.id, { content: val });

    // Check if user is typing inside an unclosed `[[...`
    const beforeCaret = val.slice(0, caret);
    const openIdx = beforeCaret.lastIndexOf('[[');
    if (openIdx >= 0) {
      const between = beforeCaret.slice(openIdx + 2);
      if (!between.includes(']]') && !between.includes('\n')) {
        setWikiSuggest({
          query: between,
          startIdx: openIdx,
          cursorIdx: caret,
        });
        return;
      }
    }
    setWikiSuggest(null);
  };

  const insertWikiCandidate = (cand: (typeof wikiCandidates)[number]) => {
    if (!activeNote || !wikiSuggest) return;
    const before = activeNote.content.slice(0, wikiSuggest.startIdx);
    const after = activeNote.content.slice(wikiSuggest.cursorIdx);
    const nextContent = `${before}[[${cand.title}]]${after}`;

    const patch: Partial<Note> = { content: nextContent };
    if (cand.kind === 'EXAM') {
      patch.linkedAnchorIds = Array.from(
        new Set([...(activeNote.linkedAnchorIds || []), cand.refId])
      );
    } else if (cand.kind === 'TASK') {
      patch.linkedTaskIds = Array.from(
        new Set([...(activeNote.linkedTaskIds || []), cand.refId])
      );
    } else if (cand.kind === 'CARD') {
      patch.linkedCardIds = Array.from(
        new Set([...(activeNote.linkedCardIds || []), cand.refId])
      );
    }
    updateNote(activeNote.id, patch);
    setWikiSuggest(null);
    textareaRef.current?.focus();
  };

  // Interactive checklist toggle in live preview
  const toggleChecklistLine = (lineIndex: number) => {
    if (!activeNote) return;
    const lines = activeNote.content.split('\n');
    const line = lines[lineIndex];
    if (!line) return;
    if (/^\s*-\s*\[ \]/.test(line)) {
      lines[lineIndex] = line.replace(/\[ \]/, '[x]');
    } else if (/^\s*-\s*\[[xX]\]/.test(line)) {
      lines[lineIndex] = line.replace(/\[[xX]\]/, '[ ]');
    }
    updateNote(activeNote.id, { content: lines.join('\n') });
  };

  // Handle clicking a [[WikiLink]] in preview
  const handleWikiLinkClick = (token: string) => {
    const lower = token.trim().toLowerCase();
    const targetNote = notes.find((n) => n.title.trim().toLowerCase() === lower);
    if (targetNote) {
      setSelectedNoteId(targetNote.id);
      return;
    }
    const targetAnchor = anchorEvents.find(
      (a) =>
        a.title.trim().toLowerCase() === lower ||
        a.title.toLowerCase().includes(lower)
    );
    if (targetAnchor) {
      onEditAnchor(targetAnchor);
      return;
    }
    const targetTask = taskBlocks.find(
      (t) => t.title.trim().toLowerCase() === lower
    );
    if (targetTask) {
      onEditTask(targetTask);
    }
  };

  // Render inline markdown (bold, code, inline math $...$, and [[WikiLinks]])
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\[\[[^\]]+\]\]|\$[^$]+\$|`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const label = part.slice(2, -2);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => handleWikiLinkClick(label)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-info/15 text-info border border-info/30 font-mono text-[11px] hover:bg-info/25 transition-colors"
          >
            <Link2 className="w-2.5 h-2.5" />
            {label}
          </button>
        );
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const tex = part.slice(1, -1);
        return (
          <span
            key={idx}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-elev font-mono text-[12px] text-fg italic"
          >
            {formatMathExpression(tex)}
          </span>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1 py-0.5 rounded bg-elev font-mono text-[11px] text-fg"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-fg">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  // Render full markdown document with display math $$...$$, headers, and checklists
  const renderMarkdownPreview = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Block math $$ ... $$
      if (line.trim().startsWith('$$')) {
        const blockLines: string[] = [];
        if (line.trim().endsWith('$$') && line.trim().length > 4) {
          blockLines.push(line.trim().slice(2, -2));
          i++;
        } else {
          blockLines.push(line.trim().slice(2));
          i++;
          while (i < lines.length && !lines[i].trim().endsWith('$$')) {
            blockLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) {
            blockLines.push(lines[i].trim().slice(0, -2));
            i++;
          }
        }
        elements.push(
          <div
            key={`math-${i}`}
            className="my-2.5 p-3 rounded-lg bg-elev border border-line font-mono text-xs text-fg text-center overflow-x-auto"
          >
            {formatMathExpression(blockLines.join(' '))}
          </div>
        );
        continue;
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-sm font-semibold text-fg mt-3 mb-1">
            {renderInlineMarkdown(line.slice(4))}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-base font-semibold text-fg mt-4 mb-1.5 border-b border-line pb-1">
            {renderInlineMarkdown(line.slice(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-lg font-bold text-fg mt-1 mb-2">
            {renderInlineMarkdown(line.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      // Interactive Checklist
      const checkMatch = line.match(/^\s*-\s*\[( |x|X)\]\s*(.*)$/);
      if (checkMatch) {
        const checked = checkMatch[1].toLowerCase() === 'x';
        const lineIdx = i;
        elements.push(
          <div key={i} className="flex items-start gap-2 py-0.5 text-xs">
            <div className="pt-0.5">
              <Checkbox
                size="sm"
                checked={checked}
                onToggle={() => toggleChecklistLine(lineIdx)}
              />
            </div>
            <span className={checked ? 'line-through text-subtle' : 'text-fg'}>
              {renderInlineMarkdown(checkMatch[2])}
            </span>
          </div>
        );
        i++;
        continue;
      }

      // Bullet item
      if (/^\s*[-*]\s+/.test(line)) {
        elements.push(
          <div key={i} className="flex items-start gap-2 py-0.5 text-xs text-fg/90 pl-1">
            <span className="text-muted">•</span>
            <span>{renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</span>
          </div>
        );
        i++;
        continue;
      }

      if (!line.trim()) {
        elements.push(<div key={i} className="h-2" />);
        i++;
        continue;
      }

      elements.push(
        <p key={i} className="text-xs text-fg/90 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden p-4 gap-3 select-none">
      {/* LEFT-CENTER PANE: Searchable File Directory (Grouped by Course / Tag) */}
      <aside className="w-[270px] shrink-0 h-full flex flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          <span className="section-label flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5" /> Knowledge Vault
          </span>
          <button
            onClick={() => addNote({ courseId: courses[0]?.id || '' })}
            className="pill hover:text-fg hover:border-line-strong"
          >
            <Plus className="w-3 h-3" /> note
          </button>
        </div>

        <div className="panel flex-1 min-h-0 flex flex-col overflow-hidden p-3 gap-3">
          {/* Search + Grouping Toggle */}
          <div className="space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Search notes or #tags..."
                className="input !pl-8 !py-1.5 !text-xs"
              />
            </div>
            <div className="seg w-full">
              <button
                onClick={() => setGroupBy('COURSE')}
                className={`seg-item flex-1 ${groupBy === 'COURSE' ? 'is-active' : ''}`}
              >
                By Course
              </button>
              <button
                onClick={() => setGroupBy('TAG')}
                className={`seg-item flex-1 ${groupBy === 'TAG' ? 'is-active' : ''}`}
              >
                By #Tag
              </button>
            </div>
          </div>

          {/* Directory Tree */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
            {notes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 p-4">
                <BookOpen className="w-5 h-5 text-subtle" />
                <p className="text-xs text-muted">
                  Your local Markdown Knowledge Vault is empty.
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => addNote({ title: 'Course Overview' })}
                    className="btn-solid !text-xs"
                  >
                    + First Note
                  </button>
                  {courses.length === 0 && (
                    <button
                      onClick={loadSampleTemplate}
                      className="btn !px-2.5"
                      title="Load sample CS/AI vault"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : groupBy === 'COURSE' ? (
              <>
                {[
                  ...courses.map((c) => ({
                    id: c.id,
                    label: `${c.code} · ${c.name}`,
                    colorHex: c.colorHex,
                    items: filteredNotes.filter((n) => n.courseId === c.id),
                  })),
                  {
                    id: 'unlinked',
                    label: 'General / Unlinked',
                    colorHex: '#8E8E93',
                    items: filteredNotes.filter(
                      (n) => !n.courseId || !courses.some((c) => c.id === n.courseId)
                    ),
                  },
                ]
                  .filter((g) => g.items.length > 0)
                  .map((group) => (
                    <div key={group.id} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted px-1">
                        <Dot color={group.colorHex} className="!w-1.5 !h-1.5" />
                        <span className="truncate">{group.label}</span>
                      </div>
                      <div className="space-y-1">
                        {group.items.map((note) => {
                          const active = activeNote?.id === note.id;
                          return (
                            <div
                              key={note.id}
                              onClick={() => setSelectedNoteId(note.id)}
                              className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                active
                                  ? 'bg-elev border border-line-strong text-fg'
                                  : 'hover:bg-elev/50 text-muted hover:text-fg border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FileText className="w-3.5 h-3.5 shrink-0 text-subtle" />
                                <span className="text-xs truncate">{note.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {note.backlinks.length > 0 && (
                                  <span
                                    className="font-mono text-[10px] px-1 rounded bg-app text-subtle"
                                    title={`${note.backlinks.length} backlink(s)`}
                                  >
                                    {note.backlinks.length}
                                  </span>
                                )}
                                <span className="hidden group-hover:inline-flex">
                                  <ActionIcon
                                    title="Delete note"
                                    danger
                                    onClick={() => deleteNote(note.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </ActionIcon>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </>
            ) : (
              /* Grouped by #Tag */
              (() => {
                const allTags = Array.from(
                  new Set(filteredNotes.flatMap((n) => (n.tags.length ? n.tags : ['untagged'])))
                );
                return allTags.map((tag) => {
                  const tagNotes = filteredNotes.filter((n) =>
                    tag === 'untagged' ? n.tags.length === 0 : n.tags.includes(tag)
                  );
                  return (
                    <div key={tag} className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-muted px-1">
                        <Hash className="w-3 h-3" />
                        <span>{tag}</span>
                      </div>
                      {tagNotes.map((note) => (
                        <div
                          key={note.id}
                          onClick={() => setSelectedNoteId(note.id)}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                            activeNote?.id === note.id
                              ? 'bg-elev border border-line-strong text-fg'
                              : 'hover:bg-elev/50 text-muted hover:text-fg'
                          }`}
                        >
                          <span className="text-xs truncate">{note.title}</span>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      </aside>

      {/* CENTER-RIGHT WORKSPACE: Markdown Editor + Live Preview + Interactive Force Graph */}
      <div className="flex-1 min-w-0 h-full flex flex-col gap-3">
        {/* Workspace Header */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <span className="section-label">
              {activeNote ? activeNote.title : 'Topic Graph & Markdown Editor'}
            </span>
            {activeNote && (
              <span className="font-mono text-[10px] text-success flex items-center gap-1">
                <Check className="w-3 h-3" /> Auto-saved
              </span>
            )}
          </div>

          <div className="seg">
            <button
              onClick={() => setViewLayout('SPLIT_GRAPH')}
              className={`seg-item inline-flex items-center gap-1 ${
                viewLayout === 'SPLIT_GRAPH' ? 'is-active' : ''
              }`}
            >
              <Network className="w-3 h-3" /> Note + Graph
            </button>
            <button
              onClick={() => setViewLayout('EDITOR_SPLIT')}
              className={`seg-item inline-flex items-center gap-1 ${
                viewLayout === 'EDITOR_SPLIT' ? 'is-active' : ''
              }`}
            >
              <Columns className="w-3 h-3" /> Edit + Preview
            </button>
            <button
              onClick={() => setViewLayout('GRAPH_ONLY')}
              className={`seg-item inline-flex items-center gap-1 ${
                viewLayout === 'GRAPH_ONLY' ? 'is-active' : ''
              }`}
            >
              <Maximize2 className="w-3 h-3" /> Full Graph
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
          {/* Note Editor + Live Preview Pane */}
          {viewLayout !== 'GRAPH_ONLY' && (
            <div
              className={`panel flex flex-col min-h-0 overflow-hidden ${
                viewLayout === 'SPLIT_GRAPH' ? 'w-[54%]' : 'flex-1'
              }`}
            >
              {!activeNote ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted text-xs">
                  <p>Select or create a note to start writing.</p>
                  <button
                    onClick={() => addNote({ title: 'Untitled Note' })}
                    className="btn-solid"
                  >
                    + Create Note
                  </button>
                </div>
              ) : (
                <>
                  {/* Note Metadata Header */}
                  <div className="p-3 border-b border-line space-y-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <input
                        value={activeNote.title}
                        onChange={(e) =>
                          updateNote(activeNote.id, { title: e.target.value })
                        }
                        placeholder="Note title..."
                        className="flex-1 bg-transparent text-sm font-semibold text-fg focus:outline-none"
                      />
                      <select
                        value={activeNote.courseId}
                        onChange={(e) =>
                          updateNote(activeNote.id, { courseId: e.target.value })
                        }
                        className="input !w-auto !py-1 !px-2 !text-[11px] font-mono"
                      >
                        <option value="">No Course</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tags + Quick Link to Anchor Event / Task */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeNote.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-elev border border-line font-mono text-[10px] text-muted"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() =>
                              updateNote(activeNote.id, {
                                tags: activeNote.tags.filter((t) => t !== tag),
                              })
                            }
                            className="hover:text-danger"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const clean = newTagInput.trim().replace(/^#/, '');
                          if (clean && !activeNote.tags.includes(clean)) {
                            updateNote(activeNote.id, {
                              tags: [...activeNote.tags, clean],
                            });
                          }
                          setNewTagInput('');
                        }}
                      >
                        <input
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="+ #tag"
                          className="w-16 px-1.5 py-0.5 rounded border border-dashed border-line bg-transparent font-mono text-[10px] text-muted focus:outline-none focus:border-line-strong"
                        />
                      </form>

                      {/* Direct Exam/Quiz Linker */}
                      <select
                        value=""
                        onChange={(e) => {
                          const aId = e.target.value;
                          if (!aId) return;
                          const target = anchorEvents.find((a) => a.id === aId);
                          if (!target) return;
                          const nextIds = Array.from(
                            new Set([...(activeNote.linkedAnchorIds || []), aId])
                          );
                          const wikiAppend = activeNote.content.includes(
                            `[[${target.title}]]`
                          )
                            ? activeNote.content
                            : `${activeNote.content.trimEnd()}\n\nLinked Exam: [[${target.title}]]\n`;
                          updateNote(activeNote.id, {
                            linkedAnchorIds: nextIds,
                            content: wikiAppend,
                          });
                        }}
                        className="ml-auto input !w-auto !py-0.5 !px-2 !text-[10px] font-mono"
                      >
                        <option value="">+ Link Exam / Quiz...</option>
                        {anchorEvents.map((a) => (
                          <option key={a.id} value={a.id}>
                            [{a.type}] {a.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* `[[` Autocomplete Suggestion Bar */}
                  {wikiSuggest && wikiCandidates.length > 0 && (
                    <div className="px-3 py-2 bg-elev border-b border-line-strong space-y-1 shrink-0">
                      <div className="font-mono text-[10px] text-info flex items-center justify-between">
                        <span>Link with [[ — click to insert reference:</span>
                        <button
                          type="button"
                          onClick={() => setWikiSuggest(null)}
                          className="text-muted hover:text-fg"
                        >
                          Esc
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {wikiCandidates.map((cand) => (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => insertWikiCandidate(cand)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-panel border border-line hover:border-info text-[11px] text-fg"
                          >
                            <span className="font-mono text-[9px] uppercase text-info">
                              {cand.sub}
                            </span>
                            <span className="truncate max-w-[180px]">{cand.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editor + Live Preview Body */}
                  <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-line overflow-hidden">
                    {/* Raw Markdown Editor */}
                    <div className="flex flex-col min-h-0 p-3">
                      <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] text-subtle">
                        <span className="flex items-center gap-1">
                          <Pencil className="w-2.5 h-2.5" /> MARKDOWN (type [[ to link, $f(x)$ for math)
                        </span>
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={activeNote.content}
                        onChange={handleEditorChange}
                        placeholder="Write markdown notes... Use [[Topic]] to link notes/exams and $f(x)$ for math."
                        className="flex-1 w-full resize-none bg-transparent font-mono text-xs text-fg leading-relaxed focus:outline-none"
                      />
                    </div>

                    {/* Live Rendered Preview */}
                    <div className="flex flex-col min-h-0 p-3 overflow-y-auto bg-app/30">
                      <div className="flex items-center justify-between mb-2 font-mono text-[10px] text-subtle">
                        <span className="flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5" /> LIVE PREVIEW
                        </span>
                      </div>
                      <div className="space-y-1">
                        {renderMarkdownPreview(activeNote.content)}
                      </div>

                      {/* Backlinks Footer */}
                      <div className="mt-6 pt-3 border-t border-line space-y-1.5">
                        <span className="section-label !text-[10px]">
                          Referenced By ({activeNote.backlinks.length} Backlinks)
                        </span>
                        {activeNote.backlinks.length === 0 ? (
                          <p className="text-[11px] text-subtle">
                            No other notes link to [[{activeNote.title}]] yet.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {activeNote.backlinks.map((sourceId) => {
                              const srcNote = notes.find((n) => n.id === sourceId);
                              if (!srcNote) return null;
                              return (
                                <button
                                  key={sourceId}
                                  type="button"
                                  onClick={() => setSelectedNoteId(srcNote.id)}
                                  className="pill hover:text-fg hover:border-line-strong"
                                >
                                  <Link2 className="w-2.5 h-2.5 text-info" />
                                  {srcNote.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Force-Directed Topic Graph Pane + Node Side Inspector */}
          {viewLayout !== 'EDITOR_SPLIT' && (
            <div className="panel flex-1 min-w-0 h-full flex flex-col overflow-hidden relative">
              <TopicForceGraph
                notes={notes}
                courses={courses}
                anchorEvents={anchorEvents}
                taskBlocks={taskBlocks}
                selectedNodeId={
                  inspectedGraphNode?.id ||
                  (activeNote ? `note:${activeNote.id}` : null)
                }
                onSelectNode={(node) => {
                  setInspectedGraphNode(node);
                  if (node.kind === 'NOTE' && node.refNote) {
                    setSelectedNoteId(node.refNote.id);
                  }
                }}
              />

              {/* Side Detail Panel when clicking any Node in the Graph */}
              {inspectedGraphNode && (
                <div className="absolute top-14 right-3 z-20 w-72 rounded-xl bg-panel/95 backdrop-blur border border-line-strong p-3.5 shadow-2xl space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Dot color={inspectedGraphNode.colorHex} />
                      <span className="font-mono text-[10px] uppercase text-muted">
                        {inspectedGraphNode.kind}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedGraphNode(null)}
                      className="icon-btn -mt-1 -mr-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="font-semibold text-fg text-sm leading-snug">
                    {inspectedGraphNode.label}
                  </p>

                  <div className="font-mono text-[11px] text-muted">
                    Connections: {inspectedGraphNode.degree}
                  </div>

                  {inspectedGraphNode.kind === 'ANCHOR' &&
                    inspectedGraphNode.refAnchor && (
                      <div className="space-y-2 pt-1 border-t border-line">
                        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                          <span>
                            Due {formatShortDate(inspectedGraphNode.refAnchor.dueDate)}
                          </span>
                          <span>{inspectedGraphNode.refAnchor.weightage}% wt</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleAnchorCompleted(inspectedGraphNode.refAnchor!.id)
                            }
                            className="btn flex-1 justify-center"
                          >
                            {inspectedGraphNode.refAnchor.completed
                              ? 'Completed ✓'
                              : 'Mark Complete'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onEditAnchor(inspectedGraphNode.refAnchor!)
                            }
                            className="btn-solid flex-1 justify-center"
                          >
                            <Target className="w-3 h-3" /> Edit Exam
                          </button>
                        </div>
                      </div>
                    )}

                  {inspectedGraphNode.kind === 'TASK' &&
                    inspectedGraphNode.refTask && (
                      <div className="space-y-2 pt-1 border-t border-line">
                        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                          <span>
                            {inspectedGraphNode.refTask.scheduledDate || 'Unscheduled'}
                          </span>
                          <span>{inspectedGraphNode.refTask.estimatedMinutes}m</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleTaskStatus(inspectedGraphNode.refTask!.id)
                            }
                            className="btn flex-1 justify-center"
                          >
                            {inspectedGraphNode.refTask.status === 'DONE'
                              ? 'Done ✓'
                              : 'Mark Done'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTask(inspectedGraphNode.refTask!)}
                            className="btn-solid flex-1 justify-center"
                          >
                            Edit Task
                          </button>
                        </div>
                      </div>
                    )}

                  {inspectedGraphNode.kind === 'NOTE' &&
                    inspectedGraphNode.refNote && (
                      <div className="pt-1 border-t border-line flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNoteId(inspectedGraphNode.refNote!.id);
                            if (viewLayout === 'GRAPH_ONLY') {
                              setViewLayout('SPLIT_GRAPH');
                            }
                          }}
                          className="btn-solid w-full justify-center"
                        >
                          Open Note in Editor
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
