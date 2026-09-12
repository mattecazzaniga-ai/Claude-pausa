"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { WALL_WIDTH, WALL_HEIGHT, priceForId, idToCoords } from "@/lib/grid";
import { AVAILABLE_COLORS, OWNED_DEFAULT_COLOR, LISTED_ACCENT, OWN_SQUARE_RING, STATUS_OWNED, STATUS_LISTED } from "@/lib/wall-colors";

const CELL = 8; // base world-unit size of one square, in "world pixels"
const MIN_ZOOM_PADDING = 1.08; // slack so the whole wall doesn't touch the viewport edges
const MAX_ZOOM = 12;

type SquareMeta = { status: number; color: string | null };

export type WallCanvasHandle = {
  navigateToSquare: (id: number, opts?: { highlight?: boolean }) => void;
};

type Camera = { originX: number; originY: number; zoom: number };

export const WallCanvas = forwardRef<
  WallCanvasHandle,
  {
    onSelectSquare: (id: number) => void;
    version: number; // bump to force a re-fetch of state/meta
  }
>(function WallCanvas({ onSelectSquare, version }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Uint8Array | null>(null);
  const metaRef = useRef<Map<number, SquareMeta>>(new Map());
  const mySquaresRef = useRef<Set<number>>(new Set());
  const cameraRef = useRef<Camera>({ originX: 0, originY: 0, zoom: 1 });
  const minZoomRef = useRef(0.2);
  const dprRef = useRef(1);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ lastX: number; lastY: number; moved: number; startX: number; startY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const animRef = useRef<number | null>(null);
  const highlightRef = useRef<{ id: number; until: number } | null>(null);

  const [hover, setHover] = useState<{ id: number; clientX: number; clientY: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const fitZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0.3;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const z = Math.min(w / (WALL_WIDTH * CELL), h / (WALL_HEIGHT * CELL)) / MIN_ZOOM_PADDING;
    return Math.max(z, 0.05);
  }, []);

  const clampCamera = useCallback((cam: Camera): Camera => {
    const el = containerRef.current;
    if (!el) return cam;
    const zoom = Math.min(Math.max(cam.zoom, minZoomRef.current), MAX_ZOOM);
    const worldW = el.clientWidth / zoom;
    const worldH = el.clientHeight / zoom;
    const maxX = Math.max(WALL_WIDTH * CELL - worldW, 0);
    const maxY = Math.max(WALL_HEIGHT * CELL - worldH, 0);
    // If the viewport is bigger than the wall on an axis, center it instead of pinning to 0.
    const originX = worldW >= WALL_WIDTH * CELL ? -(worldW - WALL_WIDTH * CELL) / 2 : Math.min(Math.max(cam.originX, 0), maxX);
    const originY = worldH >= WALL_HEIGHT * CELL ? -(worldH - WALL_HEIGHT * CELL) / 2 : Math.min(Math.max(cam.originY, 0), maxY);
    return { originX, originY, zoom };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = dprRef.current;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const { originX, originY, zoom } = cameraRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, width, height);

    const screenCell = CELL * zoom;

    const worldLeft = originX;
    const worldTop = originY;
    const worldRight = originX + width / zoom;
    const worldBottom = originY + height / zoom;

    const minCellX = Math.max(0, Math.floor(worldLeft / CELL));
    const maxCellX = Math.min(WALL_WIDTH - 1, Math.ceil(worldRight / CELL));
    const minCellY = Math.max(0, Math.floor(worldTop / CELL));
    const maxCellY = Math.min(WALL_HEIGHT - 1, Math.ceil(worldBottom / CELL));

    const state = stateRef.current;
    const meta = metaRef.current;
    const mySquares = mySquaresRef.current;
    const gap = screenCell > 3 ? 1 : 0; // subtle grid gaps only once cells are big enough to matter

    // Batch available-tier fills into paths to minimize fillStyle switches across ~100k cells.
    const tierPaths: Record<number, Path2D> = { 1: new Path2D(), 1.5: new Path2D(), 2: new Path2D(), 3: new Path2D() };
    const ownedCells: { x: number; y: number; color: string }[] = [];
    const listedCells: { x: number; y: number; color: string }[] = [];
    const ownCells: { x: number; y: number }[] = [];

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      const rowBase = cy * WALL_WIDTH;
      const sy = (cy * CELL - originY) * zoom;
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const id = rowBase + cx;
        const status = state ? state[id] : 0;
        const sx = (cx * CELL - originX) * zoom;

        if (status === STATUS_OWNED || status === STATUS_LISTED) {
          const m = meta.get(id);
          const color = m?.color || (status === STATUS_LISTED ? LISTED_ACCENT : OWNED_DEFAULT_COLOR);
          if (status === STATUS_LISTED) {
            listedCells.push({ x: sx, y: sy, color });
          } else {
            ownedCells.push({ x: sx, y: sy, color });
          }
        } else {
          const tier = priceForId(id);
          tierPaths[tier].rect(sx, sy, screenCell - gap, screenCell - gap);
        }

        if (mySquares.has(id)) ownCells.push({ x: sx, y: sy });
      }
    }

    for (const tier of [1, 1.5, 2, 3] as const) {
      ctx.fillStyle = AVAILABLE_COLORS[tier];
      ctx.fill(tierPaths[tier]);
    }

    for (const c of ownedCells) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, screenCell - gap, screenCell - gap);
    }
    for (const c of listedCells) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, screenCell - gap, screenCell - gap);
      if (screenCell > 10) {
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = Math.max(1, screenCell * 0.05);
        ctx.strokeRect(c.x, c.y, screenCell - gap, screenCell - gap);
      }
    }

    if (screenCell > 6) {
      ctx.strokeStyle = OWN_SQUARE_RING;
      ctx.lineWidth = Math.max(1.5, screenCell * 0.08);
      for (const c of ownCells) {
        ctx.strokeRect(c.x + 1, c.y + 1, screenCell - 2, screenCell - 2);
      }
    }

    // Transient highlight ring after a search jump.
    const hl = highlightRef.current;
    if (hl && performance.now() < hl.until) {
      const { x, y } = idToCoords(hl.id);
      const sx = (x * CELL - originX) * zoom;
      const sy = (y * CELL - originY) * zoom;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 120);
      ctx.strokeStyle = `rgba(125, 211, 252, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx - 4, sy - 4, screenCell + 8, screenCell + 8);
      requestAnimationFrame(draw);
    } else if (hl) {
      highlightRef.current = null;
    }

    // Frame the wall's full bounds so its extent reads clearly even when zoomed out
    // far enough that the cheapest (darkest) tiers nearly disappear into the background.
    const frameLeft = (0 - originX) * zoom;
    const frameTop = (0 - originY) * zoom;
    const frameW = WALL_WIDTH * CELL * zoom;
    const frameH = WALL_HEIGHT * CELL * zoom;
    ctx.strokeStyle = "rgba(243,243,241,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(frameLeft + 0.5, frameTop + 0.5, frameW - 1, frameH - 1);

    // Hover outline.
    if (hover && screenCell > 4) {
      const { x, y } = idToCoords(hover.id);
      const sx = (x * CELL - originX) * zoom;
      const sy = (y * CELL - originY) * zoom;
      ctx.strokeStyle = "rgba(243,243,241,0.6)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 0.5, sy + 0.5, screenCell - 1, screenCell - 1);
    }
  }, [hover]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    canvas.width = el.clientWidth * dpr;
    canvas.height = el.clientHeight * dpr;
    canvas.style.width = `${el.clientWidth}px`;
    canvas.style.height = `${el.clientHeight}px`;
    minZoomRef.current = fitZoom();
    cameraRef.current = clampCamera(cameraRef.current);
    draw();
  }, [clampCamera, draw, fitZoom]);

  // Initial mount: size canvas, center camera, load data.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const z = fitZoom();
    minZoomRef.current = z;
    cameraRef.current = clampCamera({
      originX: ((WALL_WIDTH * CELL) - el.clientWidth / z) / 2,
      originY: ((WALL_HEIGHT * CELL) - el.clientHeight / z) / 2,
      zoom: z,
    });
    setZoomLevel(z);
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("orientationchange", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [stateRes, metaRes, mineRes] = await Promise.all([
        fetch("/api/wall/state", { cache: "no-store" }),
        fetch("/api/wall/meta", { cache: "no-store" }),
        fetch("/api/me/squares", { cache: "no-store" }),
      ]);
      const buf = new Uint8Array(await stateRes.arrayBuffer());
      const metaJson = await metaRes.json();
      const mineJson = await mineRes.json();

      stateRef.current = buf;
      metaRef.current = new Map(metaJson.squares.map((s: { id: number; status: string; color: string | null }) => [s.id, { status: s.status, color: s.color }]));
      mySquaresRef.current = new Set(mineJson.squareIds ?? []);
      setLoaded(true);
      draw();
    } catch (err) {
      console.error("Failed to load wall data", err);
    }
  }, [draw]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData, version]);

  // Smooth animated camera transition (used by search navigation).
  const animateTo = useCallback(
    (target: Camera, duration = 650) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const start = { ...cameraRef.current };
      const clampedTarget = clampCamera(target);
      const t0 = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = ease(t);
        cameraRef.current = {
          originX: start.originX + (clampedTarget.originX - start.originX) * e,
          originY: start.originY + (clampedTarget.originY - start.originY) * e,
          zoom: start.zoom + (clampedTarget.zoom - start.zoom) * e,
        };
        setZoomLevel(cameraRef.current.zoom);
        draw();
        if (t < 1) {
          animRef.current = requestAnimationFrame(step);
        } else {
          animRef.current = null;
        }
      };
      animRef.current = requestAnimationFrame(step);
    },
    [clampCamera, draw]
  );

  useImperativeHandle(ref, () => ({
    navigateToSquare(id, opts) {
      const el = containerRef.current;
      if (!el) return;
      const { x, y } = idToCoords(id);
      const targetZoom = Math.max(cameraRef.current.zoom, 4);
      const originX = x * CELL + CELL / 2 - el.clientWidth / targetZoom / 2;
      const originY = y * CELL + CELL / 2 - el.clientHeight / targetZoom / 2;
      animateTo({ originX, originY, zoom: targetZoom });
      if (opts?.highlight !== false) {
        highlightRef.current = { id, until: performance.now() + 2200 };
      }
    },
  }));

  function screenToCell(clientX: number, clientY: number): { id: number; x: number; y: number } | null {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const { originX, originY, zoom } = cameraRef.current;
    const worldX = originX + (clientX - rect.left) / zoom;
    const worldY = originY + (clientY - rect.top) / zoom;
    const cx = Math.floor(worldX / CELL);
    const cy = Math.floor(worldY / CELL);
    if (cx < 0 || cx >= WALL_WIDTH || cy < 0 || cy >= WALL_HEIGHT) return null;
    return { id: cy * WALL_WIDTH + cx, x: cx, y: cy };
  }

  function zoomAround(clientX: number, clientY: number, factor: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const cam = cameraRef.current;
    const worldX = cam.originX + mx / cam.zoom;
    const worldY = cam.originY + my / cam.zoom;
    const newZoom = Math.min(Math.max(cam.zoom * factor, minZoomRef.current), MAX_ZOOM);
    cameraRef.current = clampCamera({
      originX: worldX - mx / newZoom,
      originY: worldY - my / newZoom,
      zoom: newZoom,
    });
    setZoomLevel(cameraRef.current.zoom);
    draw();
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomAround(e.clientX, e.clientY, factor);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { lastX: e.clientX, lastY: e.clientY, moved: 0, startX: e.clientX, startY: e.clientY };
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { dist, midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2 };
      dragRef.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) {
      // Hover-only tracking.
      const cell = screenToCell(e.clientX, e.clientY);
      setHover((prev) => {
        if (prev?.id === cell?.id) return prev;
        return cell ? { id: cell.id, clientX: e.clientX, clientY: e.clientY } : null;
      });
      if (cell) draw();
      return;
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const prev = pinchRef.current;

      const cam = cameraRef.current;
      const rect = containerRef.current!.getBoundingClientRect();
      // World point currently under the previous midpoint stays anchored under the new midpoint —
      // this single formula naturally handles simultaneous pinch-zoom and two-finger pan.
      const worldMidX = cam.originX + (prev.midX - rect.left) / cam.zoom;
      const worldMidY = cam.originY + (prev.midY - rect.top) / cam.zoom;
      const scaleFactor = dist / prev.dist;
      const newZoom = Math.min(Math.max(cam.zoom * scaleFactor, minZoomRef.current), MAX_ZOOM);

      cameraRef.current = clampCamera({
        originX: worldMidX - (midX - rect.left) / newZoom,
        originY: worldMidY - (midY - rect.top) / newZoom,
        zoom: newZoom,
      });
      setZoomLevel(cameraRef.current.zoom);
      pinchRef.current = { dist, midX, midY };
      draw();
      return;
    }

    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      const cam = cameraRef.current;
      cameraRef.current = clampCamera({
        originX: cam.originX - dx / cam.zoom,
        originY: cam.originY - dy / cam.zoom,
        zoom: cam.zoom,
      });
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      dragRef.current.moved += Math.abs(dx) + Math.abs(dy);
      draw();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasDrag = dragRef.current;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (pointersRef.current.size === 0 && wasDrag) {
      if (wasDrag.moved < 6) {
        const cell = screenToCell(wasDrag.startX, wasDrag.startY);
        if (cell) onSelectSquare(cell.id);
      }
      dragRef.current = null;
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    zoomAround(e.clientX, e.clientY, 1.8);
  }

  function onPointerLeave() {
    setHover(null);
  }

  const showTooltip = hover && zoomLevel < 4; // at high zoom the hover outline is enough

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none select-none overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      )}
      {showTooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: hover.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0),
            top: hover.clientY - (containerRef.current?.getBoundingClientRect().top ?? 0),
            transform: "translate(14px, 14px)",
          }}
        >
          <SquareTooltip id={hover.id} />
        </div>
      )}
    </div>
  );
});

function SquareTooltip({ id }: { id: number }) {
  const { x, y } = idToCoords(id);
  const price = priceForId(id);
  return (
    <span>
      #{id} · ({x}, {y}) · from €{price}
    </span>
  );
}
