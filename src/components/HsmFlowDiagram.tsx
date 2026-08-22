import React, { useEffect, useRef, useState, useId } from 'react';
import * as d3 from 'd3';
import {
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Key,
  Shield,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
  Info,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { MlsuKeyStore, KDF_FAST, KDF_STRONG } from '../crypto/mlsuEngine';
import { StoreState, SlotData } from '../types';

interface HsmFlowDiagramProps {
  engine: MlsuKeyStore;
  selectedSlotIndex: number;
  onSelectSlot: (slotIndex: number) => void;
  targetSector?: 'salt' | 'nonce' | 'blob' | 'tag';
  tamperMode?: string;
}

interface NodeData {
  id: string;
  stage: 'input' | 'kdf' | 'storage' | 'aead' | 'weaver' | 'output';
  title: string;
  subtitle: string;
  details: string;
  byteSize?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'normal' | 'active' | 'tampered' | 'locked' | 'success' | 'failed';
  badge?: string;
  slotIndex?: number;
}

interface LinkData {
  id: string;
  source: string;
  target: string;
  label?: string;
  flowActive?: boolean;
  tampered?: boolean;
}

export const HsmFlowDiagram: React.FC<HsmFlowDiagramProps> = ({
  engine,
  selectedSlotIndex,
  onSelectSlot,
  targetSector,
  tamperMode,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [testPin, setTestPin] = useState<string>('471903');
  const [activeStageStep, setActiveStageStep] = useState<number>(-1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [flowLog, setFlowLog] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState<{
    matchedSlot: number | null;
    matchedProfileId: number | null;
    macValid: boolean;
    reason: string;
  } | null>(null);

  const state: StoreState = engine.getState();
  const currentSlot = state.slots[selectedSlotIndex] || state.slots[0];

  // Run dynamic evaluation when testPin changes or when simulation runs
  const evaluateFlow = () => {
    // Check if testPin unlocks any slot
    let matchedIndex: number | null = null;
    let matchedProfId: number | null = null;

    if (testPin === '471903' && state.slots[0]?.isEnrolled) {
      matchedIndex = 0;
      matchedProfId = state.slots[0].profileId;
    } else if (testPin === '220561' && state.slots[1]?.isEnrolled) {
      matchedIndex = 1;
      matchedProfId = state.slots[1].profileId;
    }

    const isSlotCorrupted = targetSector && currentSlot.blob === '0000'; // Or general tamper
    return {
      matchedIndex,
      matchedProfId,
      macValid: matchedIndex !== null && !state.anyLockedOut,
    };
  };

  // Construct node hierarchy for D3
  const buildNodesAndLinks = () => {
    const nodes: NodeData[] = [
      // 1. PIN Input
      {
        id: 'node-pin',
        stage: 'input',
        title: 'User PIN Entry',
        subtitle: `Single-PIN Challenge: "${testPin}"`,
        details: 'User provides single blind PIN. The device does not prompt for profile identity upfront (SR-2 zero-leakage).',
        byteSize: '6-8 Digits',
        x: 40,
        y: 190,
        width: 170,
        height: 80,
        status: 'active',
        badge: 'User Plane',
      },

      // 2. KDF Engine
      {
        id: 'node-kdf',
        stage: 'kdf',
        title: 'Argon2id KDF Engine',
        subtitle: `${state.kdf.memoryCostKiB} KiB RAM • ${state.kdf.timeCost} Passes`,
        details: 'Memory-hard derivation computes candidate 256-bit Key Encryption Key (KEK) using Slot Salt in constant time (SR-1, F-3).',
        byteSize: 'Outputs 32B KEK',
        x: 270,
        y: 190,
        width: 190,
        height: 85,
        status: 'normal',
        badge: 'Crypto Enclave',
      },

      // 3. Slot Storage (4 slots represented)
      {
        id: 'node-slot-1',
        stage: 'storage',
        title: 'Slot 1 Storage (77B)',
        subtitle: state.slots[0]?.isEnrolled ? `Enrolled (Prof ${state.slots[0].profileId})` : 'Decoy Noise',
        details: 'Uniform 77-byte slot record: 16B Salt + 12B Nonce + 33B Payload + 16B Poly1305 MAC.',
        byteSize: '77 Bytes',
        x: 520,
        y: 40,
        width: 190,
        height: 72,
        slotIndex: 0,
        status: selectedSlotIndex === 0 ? 'active' : 'normal',
        badge: 'Flash Sector 0',
      },
      {
        id: 'node-slot-2',
        stage: 'storage',
        title: 'Slot 2 Storage (77B)',
        subtitle: state.slots[1]?.isEnrolled ? `Enrolled (Prof ${state.slots[1].profileId})` : 'Decoy Noise',
        details: 'Uniform 77-byte slot record: 16B Salt + 12B Nonce + 33B Payload + 16B Poly1305 MAC.',
        byteSize: '77 Bytes',
        x: 520,
        y: 130,
        width: 190,
        height: 72,
        slotIndex: 1,
        status: selectedSlotIndex === 1 ? 'active' : 'normal',
        badge: 'Flash Sector 1',
      },
      {
        id: 'node-slot-3',
        stage: 'storage',
        title: 'Slot 3 Storage (77B)',
        subtitle: state.slots[2]?.isEnrolled ? `Enrolled (Prof ${state.slots[2].profileId})` : 'Decoy Noise',
        details: 'Indistinguishable decoy slot initialized with cryptographic uniform pseudo-random noise (SR-8).',
        byteSize: '77 Bytes',
        x: 520,
        y: 220,
        width: 190,
        height: 72,
        slotIndex: 2,
        status: selectedSlotIndex === 2 ? 'active' : 'normal',
        badge: 'Flash Sector 2',
      },
      {
        id: 'node-slot-4',
        stage: 'storage',
        title: 'Slot 4 Storage (77B)',
        subtitle: state.slots[3]?.isEnrolled ? `Enrolled (Prof ${state.slots[3].profileId})` : 'Decoy Noise',
        details: 'Indistinguishable decoy slot initialized with cryptographic uniform pseudo-random noise (SR-8).',
        byteSize: '77 Bytes',
        x: 520,
        y: 310,
        width: 190,
        height: 72,
        slotIndex: 3,
        status: selectedSlotIndex === 3 ? 'active' : 'normal',
        badge: 'Flash Sector 3',
      },

      // 4. AEAD Authentication
      {
        id: 'node-aead',
        stage: 'aead',
        title: 'ChaCha20-Poly1305 AEAD',
        subtitle: 'Constant-Time Tag Check',
        details: 'Authenticates 16-byte Poly1305 MAC tag. If valid, decrypts 33B payload (1B Profile ID + 32B CE Key). Returns dummy payload on failure.',
        byteSize: '16B Tag Check',
        x: 770,
        y: 180,
        width: 200,
        height: 90,
        status: 'normal',
        badge: 'AEAD Primitive',
      },

      // 5. Weaver Rate-Limiter
      {
        id: 'node-weaver',
        stage: 'weaver',
        title: 'Weaver Hardware Enclave',
        subtitle: `${currentSlot?.failures || 0} / 30 Failures ${state.anyLockedOut ? '(LOCKOUT)' : ''}`,
        details: 'Hardware tamper-resistant rate-limiter. Enforces exponential delay (0s, 30s, 300s) and permanent lockout at 30 failures (SR-3).',
        byteSize: 'Hardware Register',
        x: 1030,
        y: 80,
        width: 195,
        height: 85,
        status: state.anyLockedOut ? 'locked' : (currentSlot?.failures || 0) > 0 ? 'tampered' : 'normal',
        badge: 'StrongBox Enclave',
      },

      // 6. Output / Profile Unsealed
      {
        id: 'node-output',
        stage: 'output',
        title: 'Profile CE Key Unsealed',
        subtitle: 'Injected into Kernel RAM',
        details: 'Target Profile Class Key mounted into Linux fscrypt kernel keystore. Decrypted workspace unlocked seamlessly.',
        byteSize: '256-bit CE Key',
        x: 1030,
        y: 270,
        width: 195,
        height: 85,
        status: 'normal',
        badge: 'Kernel Keystore',
      },
    ];

    const links: LinkData[] = [
      { id: 'l1', source: 'node-pin', target: 'node-kdf', label: 'PIN Candidate' },
      { id: 'l2a', source: 'node-slot-1', target: 'node-kdf', label: 'Salt (16B)' },
      { id: 'l2b', source: 'node-slot-2', target: 'node-kdf', label: 'Salt (16B)' },
      { id: 'l2c', source: 'node-slot-3', target: 'node-kdf', label: 'Salt (16B)' },
      { id: 'l2d', source: 'node-slot-4', target: 'node-kdf', label: 'Salt (16B)' },

      { id: 'l3', source: 'node-kdf', target: 'node-aead', label: 'Derived KEK (32B)' },

      { id: 'l4a', source: 'node-slot-1', target: 'node-aead', label: 'Ciphertext + Tag' },
      { id: 'l4b', source: 'node-slot-2', target: 'node-aead', label: 'Ciphertext + Tag' },
      { id: 'l4c', source: 'node-slot-3', target: 'node-aead', label: 'Ciphertext + Tag' },
      { id: 'l4d', source: 'node-slot-4', target: 'node-aead', label: 'Ciphertext + Tag' },

      { id: 'l5_fail', source: 'node-aead', target: 'node-weaver', label: 'Invalid Tag / Failure' },
      { id: 'l5_ok', source: 'node-aead', target: 'node-output', label: 'Auth Success (MAC Valid)' },
    ];

    return { nodes, links };
  };

  // D3 Rendering & Interactive Setup
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodes, links } = buildNodesAndLinks();
    const width = 1280;
    const height = 430;

    // Define defs & filters for glowing effects and arrow markers
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'hsm-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    filter.append('feMerge').selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', (d) => d);

    // Arrow markers
    defs.append('marker')
      .attr('id', 'arrow-default')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#64748b');

    defs.append('marker')
      .attr('id', 'arrow-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#38bdf8');

    defs.append('marker')
      .attr('id', 'arrow-success')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#34d399');

    defs.append('marker')
      .attr('id', 'arrow-fail')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#f43f5e');

    // Create Main Zoom Group
    const g = svg.append('g').attr('class', 'main-flow-group');

    // Setup D3 Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Render Stage Columns Background & Labels
    const stages = [
      { name: '1. User Input', x: 20, width: 210, color: 'rgba(56, 189, 248, 0.03)' },
      { name: '2. KDF Enclave', x: 250, width: 230, color: 'rgba(129, 140, 248, 0.03)' },
      { name: '3. Flash Keystore Slots', x: 500, width: 230, color: 'rgba(168, 85, 247, 0.03)' },
      { name: '4. AEAD Unseal', x: 750, width: 240, color: 'rgba(236, 72, 153, 0.03)' },
      { name: '5. Weaver & RAM Keystore', x: 1010, width: 240, color: 'rgba(34, 197, 94, 0.03)' },
    ];

    stages.forEach((st) => {
      // Stage region rect
      g.append('rect')
        .attr('x', st.x)
        .attr('y', 15)
        .attr('width', st.width)
        .attr('height', height - 30)
        .attr('rx', 12)
        .attr('fill', st.color)
        .attr('stroke', '#1e293b')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1);

      // Stage header
      g.append('text')
        .attr('x', st.x + 12)
        .attr('y', 32)
        .attr('fill', '#64748b')
        .attr('font-size', '10px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-weight', '600')
        .attr('text-transform', 'uppercase')
        .attr('letter-spacing', '0.05em')
        .text(st.name);
    });

    // Create node map for link coordinates calculation
    const nodeMap = new Map<string, NodeData>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    // Draw Curved Links
    const linksGroup = g.append('g').attr('class', 'links-group');

    links.forEach((link) => {
      const src = nodeMap.get(link.source);
      const tgt = nodeMap.get(link.target);
      if (!src || !tgt) return;

      const sx = src.x + src.width;
      const sy = src.y + src.height / 2;
      const tx = tgt.x;
      const ty = tgt.y + tgt.height / 2;

      // Cubic Bezier curve
      const dx = tx - sx;
      const pathData = `M ${sx} ${sy} C ${sx + dx * 0.45} ${sy}, ${tx - dx * 0.45} ${ty}, ${tx} ${ty}`;

      const linkColor =
        link.id === 'l5_ok'
          ? '#34d399'
          : link.id === 'l5_fail'
          ? '#f43f5e'
          : '#475569';

      const pathElem = linksGroup.append('path')
        .attr('id', `path-${link.id}`)
        .attr('d', pathData)
        .attr('fill', 'none')
        .attr('stroke', linkColor)
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', link.id.startsWith('l2') ? '3 3' : 'none')
        .attr('marker-end', link.id === 'l5_ok' ? 'url(#arrow-success)' : link.id === 'l5_fail' ? 'url(#arrow-fail)' : 'url(#arrow-default)');

      // Link text label
      if (link.label && !link.id.startsWith('l2')) {
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;

        linksGroup.append('text')
          .attr('x', mx)
          .attr('y', my - 4)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8')
          .attr('font-size', '9px')
          .attr('font-family', 'JetBrains Mono, monospace')
          .text(link.label);
      }
    });

    // Draw Nodes
    const nodesGroup = g.append('g').attr('class', 'nodes-group');

    const nodeG = nodesGroup.selectAll('g.flow-node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'flow-node')
      .attr('id', (d) => d.id)
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        setSelectedNode(d);
        if (typeof d.slotIndex === 'number') {
          onSelectSlot(d.slotIndex);
        }
      });

    // Node Box Rect
    nodeG.append('rect')
      .attr('width', (d) => d.width)
      .attr('height', (d) => d.height)
      .attr('rx', 10)
      .attr('fill', (d) => {
        if (d.id === 'node-pin') return '#0f172a';
        if (d.id === 'node-kdf') return '#1e1b4b';
        if (d.stage === 'storage') {
          return d.slotIndex === selectedSlotIndex ? '#1e1b4b' : '#090d16';
        }
        if (d.id === 'node-aead') return '#2a0826';
        if (d.id === 'node-weaver') return '#1a1005';
        return '#06201a';
      })
      .attr('stroke', (d) => {
        if (d.slotIndex === selectedSlotIndex) return '#38bdf8';
        if (d.id === 'node-pin') return '#0284c7';
        if (d.id === 'node-kdf') return '#6366f1';
        if (d.id === 'node-aead') return '#d946ef';
        if (d.id === 'node-weaver') return state.anyLockedOut ? '#ef4444' : '#f59e0b';
        if (d.id === 'node-output') return '#10b981';
        return '#334155';
      })
      .attr('stroke-width', (d) => (d.slotIndex === selectedSlotIndex || d.id === 'node-pin' ? 2 : 1.2))
      .attr('filter', (d) => (d.slotIndex === selectedSlotIndex ? 'url(#hsm-glow)' : 'none'));

    // Node Badge Tag
    nodeG.filter((d) => Boolean(d.badge))
      .append('rect')
      .attr('x', (d) => d.width - 78)
      .attr('y', 8)
      .attr('width', 70)
      .attr('height', 14)
      .attr('rx', 4)
      .attr('fill', '#0f172a')
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.8);

    nodeG.filter((d) => Boolean(d.badge))
      .append('text')
      .attr('x', (d) => d.width - 43)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d) => d.badge || '');

    // Node Title
    nodeG.append('text')
      .attr('x', 12)
      .attr('y', 22)
      .attr('fill', '#f8fafc')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('font-family', 'system-ui, sans-serif')
      .text((d) => d.title);

    // Node Subtitle
    nodeG.append('text')
      .attr('x', 12)
      .attr('y', 38)
      .attr('fill', (d) => {
        if (d.stage === 'storage' && d.slotIndex === selectedSlotIndex) return '#38bdf8';
        if (d.id === 'node-weaver' && state.anyLockedOut) return '#f87171';
        return '#cbd5e1';
      })
      .attr('font-size', '9.5px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d) => d.subtitle);

    // Node Byte Size Label
    nodeG.filter((d) => Boolean(d.byteSize))
      .append('text')
      .attr('x', 12)
      .attr('y', (d) => d.height - 10)
      .attr('fill', '#64748b')
      .attr('font-size', '8.5px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d) => `[${d.byteSize}]`);

    // Tamper Warning indicator on slot nodes if corrupted
    nodeG.filter((d) => d.stage === 'storage' && d.slotIndex === selectedSlotIndex && Boolean(targetSector))
      .append('g')
      .attr('transform', (d) => `translate(${d.width - 24}, ${d.height - 24})`)
      .append('circle')
      .attr('r', 8)
      .attr('fill', '#ef4444')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

  }, [engine, selectedSlotIndex, state, testPin, targetSector, tamperMode]);

  // Animated Data Token Flow Simulation
  const runSimulation = () => {
    if (isSimulating || !svgRef.current) return;
    setIsSimulating(true);
    setActiveStageStep(0);
    setFlowLog([]);

    const { matchedIndex, matchedProfId, macValid } = evaluateFlow();
    const svg = d3.select(svgRef.current);
    const g = svg.select('.main-flow-group');

    const log = (msg: string) => {
      setFlowLog((prev) => [...prev, msg]);
    };

    log(`[STAGE 1] User supplies PIN: "${testPin}" to Hardware Enclave.`);

    // Remove any existing particle tokens
    g.selectAll('.flow-particle').remove();

    // Step 1: Animate PIN to KDF
    const p1 = g.append('circle')
      .attr('class', 'flow-particle')
      .attr('r', 5)
      .attr('fill', '#38bdf8')
      .attr('cx', 210)
      .attr('cy', 230)
      .attr('filter', 'url(#hsm-glow)');

    p1.transition()
      .duration(700)
      .attr('cx', 270)
      .on('end', () => {
        p1.remove();
        setActiveStageStep(1);
        log(`[STAGE 2] KDF Argon2id / PBKDF2 computing candidate KEK with Slot ${selectedSlotIndex + 1} Salt (${state.slots[selectedSlotIndex]?.salt.slice(0, 8)}...).`);

        // Step 2: KDF -> AEAD
        const p2 = g.append('circle')
          .attr('class', 'flow-particle')
          .attr('r', 5)
          .attr('fill', '#818cf8')
          .attr('cx', 460)
          .attr('cy', 232)
          .attr('filter', 'url(#hsm-glow)');

        p2.transition()
          .duration(800)
          .attr('cx', 770)
          .on('end', () => {
            p2.remove();
            setActiveStageStep(2);
            log(`[STAGE 3] AEAD unseal initiated with 32B KEK and 12B Nonce. Evaluating Poly1305 MAC tag.`);

            // Step 3: Branch to Output or Weaver Lockout
            if (macValid && matchedIndex !== null) {
              log(`[STAGE 4: SUCCESS] Poly1305 MAC matched! Profile ${matchedProfId} unsealed and CE key injected into kernel RAM.`);
              setSimulationResult({
                matchedSlot: matchedIndex,
                matchedProfileId: matchedProfId,
                macValid: true,
                reason: `PIN unlocked Profile ${matchedProfId} in Slot ${matchedIndex + 1}.`,
              });

              const p3 = g.append('circle')
                .attr('class', 'flow-particle')
                .attr('r', 6)
                .attr('fill', '#34d399')
                .attr('cx', 970)
                .attr('cy', 230)
                .attr('filter', 'url(#hsm-glow)');

              p3.transition()
                .duration(800)
                .attr('cx', 1030)
                .attr('cy', 312)
                .on('end', () => {
                  p3.remove();
                  setIsSimulating(false);
                  setActiveStageStep(3);
                });
            } else {
              const reason = state.anyLockedOut
                ? 'Device is currently locked out by Weaver.'
                : targetSector
                ? `AEAD MAC mismatch! Sector [${targetSector.toUpperCase()}] is corrupted.`
                : `Invalid PIN! No slot Poly1305 MAC tag verified.`;

              log(`[STAGE 4: REJECTED] ${reason}`);
              setSimulationResult({
                matchedSlot: null,
                matchedProfileId: null,
                macValid: false,
                reason,
              });

              const p3 = g.append('circle')
                .attr('class', 'flow-particle')
                .attr('r', 6)
                .attr('fill', '#f43f5e')
                .attr('cx', 970)
                .attr('cy', 220)
                .attr('filter', 'url(#hsm-glow)');

              p3.transition()
                .duration(800)
                .attr('cx', 1030)
                .attr('cy', 122)
                .on('end', () => {
                  p3.remove();
                  setIsSimulating(false);
                  setActiveStageStep(3);
                });
            }
          });
      });
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(400).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Interactive D3 Cryptographic Flow Architecture</span>
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Single-PIN Challenge &rarr; Constant-Time KDF &rarr; Slot AEAD Pipeline
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl">
            Visualizes how MLSU authenticates blind PINs against flash storage sectors using memory-hard Argon2id KDF and Poly1305 AEAD without timing leaks (SR-1, SR-8, F-3).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Test PIN Quick Presets */}
          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            <span className="text-[11px] font-mono text-slate-500 px-2">Test PIN:</span>
            <button
              type="button"
              onClick={() => setTestPin('471903')}
              className={`px-2 py-1 rounded-lg font-mono text-xs transition-all ${
                testPin === '471903'
                  ? 'bg-sky-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              471903 (P1)
            </button>
            <button
              type="button"
              onClick={() => setTestPin('220561')}
              className={`px-2 py-1 rounded-lg font-mono text-xs transition-all ${
                testPin === '220561'
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              220561 (P2)
            </button>
            <button
              type="button"
              onClick={() => setTestPin('999999')}
              className={`px-2 py-1 rounded-lg font-mono text-xs transition-all ${
                testPin === '999999'
                  ? 'bg-rose-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              999999 (Bad)
            </button>
          </div>

          {/* Simulation Button */}
          <button
            id="run-d3-flow-btn"
            onClick={runSimulation}
            disabled={isSimulating}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg cursor-pointer ${
              isSimulating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-600/20'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Tracing Flow…' : 'Simulate Flow'}</span>
          </button>

          {/* Reset Zoom */}
          <button
            onClick={handleResetZoom}
            title="Reset Zoom / Pan"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-hidden shadow-inner"
        style={{ height: '420px' }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1280 430"
          className="w-full h-full select-none"
        />

        {/* Overlay Helper Badge */}
        <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 backdrop-blur-sm">
          <Info className="w-3 h-3 text-sky-400" />
          <span>Interactive D3 Diagram: Pan / Zoom supported • Click any node or slot to inspect</span>
        </div>

        {/* Live Simulation Result Overlay */}
        {simulationResult && (
          <div className="absolute top-3 right-3 max-w-sm p-3 rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl backdrop-blur-md text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                {simulationResult.macValid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">AEAD Authenticated</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-300">Authentication Failed</span>
                  </>
                )}
              </span>
              <button
                onClick={() => setSimulationResult(null)}
                className="text-slate-500 hover:text-slate-300 text-[10px]"
              >
                &times;
              </button>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">{simulationResult.reason}</p>
          </div>
        )}
      </div>

      {/* Bottom Cryptographic Telemetry & Selected Node Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Execution Trace Log (7 cols) */}
        <div className="md:col-span-7 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Cryptographic Execution Trace
            </h4>
            <span className="text-[10px] font-mono text-slate-500">
              {flowLog.length > 0 ? `${flowLog.length} steps recorded` : 'Ready'}
            </span>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {flowLog.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">
                Click &ldquo;Simulate Flow&rdquo; above to animate the single-PIN unsealing pass through KDF, Flash Sectors, and AEAD verification.
              </p>
            ) : (
              flowLog.map((line, idx) => (
                <div
                  key={idx}
                  className={`text-[11px] font-mono p-1.5 rounded bg-slate-900/90 border border-slate-800/80 ${
                    line.includes('SUCCESS')
                      ? 'text-emerald-300 border-emerald-900/50'
                      : line.includes('REJECTED')
                      ? 'text-rose-300 border-rose-900/50'
                      : 'text-slate-300'
                  }`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Node Detailed Inspector (5 cols) */}
        <div className="md:col-span-5 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Node Cryptographic Spec</span>
            </h4>
            {selectedNode && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                {selectedNode.badge || selectedNode.stage}
              </span>
            )}
          </div>

          {selectedNode ? (
            <div className="space-y-2 text-xs">
              <div className="font-bold text-white">{selectedNode.title}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{selectedNode.details}</p>
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Payload: <strong className="text-sky-300">{selectedNode.byteSize}</strong></span>
                <span>Stage: <strong className="text-indigo-300">{selectedNode.stage.toUpperCase()}</strong></span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 py-3 italic">
              Click any element in the D3 diagram (e.g. KDF Engine, Slot 1, AEAD Unseal, or Weaver) to inspect its low-level cryptographic parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
