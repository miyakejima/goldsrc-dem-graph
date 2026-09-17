import { useEffect, useMemo, useRef, useState } from "react";

import { getGraph, getGraphViewer, uploadDemo } from "./api";
import type { GraphPayload, GraphViewerDataset, GraphViewerJump } from "@kz-rebuild/shared-types";

type LineKey = "engineFps" | "realFps" | "mouseX" | "mouseXSpeed" | "jumpHeight";

type Segment = { start: number; end: number };
type EventPoint = { index: number; color: string };
type TechniqueVm = {
  startFrame: number;
  endFrame: number;
  label: string;
  color: string;
  sync: number;
  distance: number;
  prestrafe: number;
  maxspeed: number;
  strafes: number;
  isIdealBhop?: boolean;
  distanceXy?: number;
  block?: number;
  jumpoff?: number;
  landing?: number;
  frames?: number;
  framesInDuck?: number;
  preJumpVelocityJumpoff?: number;
  preJumpVelocityBeforeJumpoff?: number;
};

const lineConfig: Record<LineKey, { label: string; color: string }> = {
  engineFps: { label: "engine fps", color: "#ffa000" },
  realFps: { label: "real fps", color: "#f0f0f0" },
  mouseX: { label: "mouseX", color: "#ffffff" },
  mouseXSpeed: { label: "mouseX speed", color: "#f5f5f5" },
  jumpHeight: { label: "jump height", color: "#f5f5f5" }
};

const laneConfigs: Array<{ key: string; label: string; height: number }> = [
  { key: "freezetime", label: "freezetime", height: 15 },
  { key: "movetype", label: "movetype", height: 15 },
  { key: "use", label: "use", height: 15 },
  { key: "techniques", label: "techniques", height: 15 },
  { key: "jump", label: "jump", height: 22 },
  { key: "ground", label: "ground", height: 15 },
  { key: "duck", label: "duck", height: 15 },
  { key: "duckstate", label: "duckstate", height: 15 },
  { key: "forward", label: "forward", height: 15 },
  { key: "back", label: "back", height: 15 },
  { key: "moveleft", label: "moveleft", height: 15 },
  { key: "moveright", label: "moveright", height: 15 }
];

const kFlags: Record<string, number> = {
  FLY: 1,
  SWIM: 2,
  CONVEYOR: 4,
  CLIENT: 8,
  INWATER: 16,
  MONSTER: 32,
  GODMODE: 64,
  NOTARGET: 128,
  SKIPLOCALHOST: 256,
  ONGROUND: 512,
  PARTIALGROUND: 1024,
  WATERJUMP: 2048,
  FROZEN: 4096,
  FAKECLIENT: 8192,
  DUCKING: 16384,
  FLOAT: 32768,
  GRAPHED: 65536
};

const mButtons: Record<string, number> = {
  ATTACK: 1,
  JUMP: 2,
  DUCK: 4,
  FORWARD: 8,
  BACK: 16,
  USE: 32,
  CANCEL: 64,
  LEFT: 128,
  RIGHT: 256,
  MOVELEFT: 512,
  MOVERIGHT: 1024,
  ATTACK2: 2048,
  RUN: 4096,
  RELOAD: 8192,
  ALT1: 16384,
  SCORE: 32768
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// 539_beautified.js line 274: y = function(t)
function formatServerTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "00:00.00";
  const e = Math.floor(100 * seconds);
  const i = Math.floor(e / 360000);
  const a = Math.floor(e / 6000) % 60;
  const s = Math.floor(e / 100) % 60;
  const r = e % 100;
  return i > 0
    ? `${String(i).padStart(2, "0")}:${String(a).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(r).padStart(2, "0")}`
    : `${String(a).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(r).padStart(2, "0")}`;
}

function formatNum(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function movetypeLabel(value: number): string {
  if (value === 3) return "WALK";
  if (value === 8) return "NOCLIP";
  if (value === 5) return "FLY";
  return String(value || "-");
}

function formatFlagsList(flags: number): string[] {
  return Object.entries(kFlags)
    .filter(([, bit]) => (flags & bit) !== 0)
    .map(([name]) => name);
}

function formatButtonsList(buttons: number): string[] {
  return Object.entries(mButtons)
    .filter(([, bit]) => (buttons & bit) !== 0)
    .map(([name]) => name);
}

// 539_beautified.js line 512: only commands at exact frame t
function formatCommandsAtFrame(commands: Record<string, string> | undefined, frame: number): string[] {
  if (!commands) return [];
  const str = commands[String(frame)];
  if (!str) return [];
  const parts = str.split(";").map((s) => s.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }
  if (unique.length > 6) {
    return unique.slice(0, 6).concat(`and ${unique.length - 6} more...`);
  }
  return unique;
}

function buildSegments(values: number[]): Segment[] {
  const out: Segment[] = [];
  let start = -1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== 0 && start === -1) start = i;
    if ((values[i] === 0 || i === values.length - 1) && start !== -1) {
      const end = values[i] !== 0 && i === values.length - 1 ? i : i - 1;
      out.push({ start, end });
      start = -1;
    }
  }
  return out;
}

function buildSegmentsWithMinGap(values: number[], minGap = 1): Segment[] {
  const raw = buildSegments(values);
  if (raw.length <= 1) return raw;
  const merged: Segment[] = [raw[0]];
  for (let i = 1; i < raw.length; i += 1) {
    const previous = merged[merged.length - 1];
    const current = raw[i];
    if (current.start - previous.end <= minGap) {
      previous.end = current.end;
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function buildSequenceRects(
  values: number[],
  getYAndColor: (val: number, idx: number) => { y: number; color: string } | null
): Array<{ x: number; y: number; width: number; color: string }> {
  const rects: Array<{ x: number; y: number; width: number; color: string }> = [];
  let currentStart = -1;
  let currentY = -1;
  let currentColor = "";

  for (let i = 0; i < values.length; i++) {
    const res = getYAndColor(values[i] ?? 0, i);
    if (!res) {
      if (currentStart !== -1) {
        rects.push({ x: currentStart, y: currentY, width: i - currentStart, color: currentColor });
        currentStart = -1;
      }
      continue;
    }

    if (currentStart === -1) {
      currentStart = i;
      currentY = res.y;
      currentColor = res.color;
    } else if (res.y !== currentY || res.color !== currentColor) {
      rects.push({ x: currentStart, y: currentY, width: i - currentStart, color: currentColor });
      currentStart = i;
      currentY = res.y;
      currentColor = res.color;
    }
  }

  if (currentStart !== -1) {
    rects.push({ x: currentStart, y: currentY, width: values.length - currentStart, color: currentColor });
  }

  return rects;
}

function computeJumpCommandLines(
  totalFrames: number,
  commands: Record<string, string> | undefined,
  fuser2: number[] | undefined,
  buttons: number[] | undefined
): Array<{ frame: number; color: string; yOffset: number; h: number }> {
  if (!commands) return [];
  const lines: Array<{ frame: number; color: string; yOffset: number; h: number }> = [];
  const f2 = fuser2 ?? [];
  const btns = buttons ?? [];

  for (let t = 1; t <= totalFrames; t++) {
    const cmdStr = commands[String(t)];
    if (!cmdStr) continue;
    const a = cmdStr.toLowerCase().split(";").map((s) => s.trim());
    const nextCmdStr = commands[String(t + 1)];
    const s = nextCmdStr ? nextCmdStr.toLowerCase().split(";").map((str) => str.trim()) : [];
    const r = a.indexOf("+jump");
    const n = a.indexOf("-jump");
    if (r === -1 && n === -1) continue;

    let i: number | undefined;
    if (n !== -1 && r !== -1) {
      if (n > r) {
        i = (1315 === (f2[t + 1] ?? 0)) ? 65280 : 34816;
      } else {
        i = (s.indexOf("-jump") !== -1 && s.indexOf("+jump") === -1) ? 16711935 : 65535;
      }
    } else if (r !== -1) {
      i = 16711680;
    } else if (n !== -1) {
      i = 255;
    }

    if (r !== -1 && !((btns[t + 1] ?? 0) & 2)) {
      i = 16777215;
    }
    if (1315 === (f2[t + 1] ?? 0) && ((btns[t] ?? 0) & 2)) {
      i = 16755200;
    }
    if (a.indexOf("+jump", r + 1) !== -1 && a.indexOf("-jump", n + 1) !== -1) {
      i = 16711935;
    }

    if (i !== undefined) {
      const isSpecial = [65280, 34816, 16711680, 255].indexOf(i) === -1;
      lines.push({
        frame: t,
        color: `#${i.toString(16).padStart(6, "0")}`,
        yOffset: isSpecial ? 2.5 : 0,
        h: isSpecial ? 17 : 22
      });
    }
  }
  return lines;
}

function computeJumpHoldSegments(
  totalFrames: number,
  commands: Record<string, string> | undefined,
  buttons: number[] | undefined
): Segment[] {
  const mask = new Array<number>(totalFrames);
  const btns = buttons ?? [];
  const cmds = commands ?? {};
  for (let t = 0; t < totalFrames; t++) {
    const isBtn = ((btns[t + 1] ?? 0) & 2) !== 0;
    if (!isBtn) {
      mask[t] = 0;
      continue;
    }
    const c = (cmds[String(t)] || "").toLowerCase();
    const hasJumpCmd = c.includes("+jump") || c.includes("-jump");
    mask[t] = hasJumpCmd ? 0 : 1;
  }
  return buildSegmentsWithMinGap(mask, 1);
}

function buildPressEvents(values: number[], color: string): EventPoint[] {
  const events: EventPoint[] = [];
  let prev = values[0] ?? 0;
  for (let i = 1; i < values.length; i += 1) {
    const current = values[i] ?? 0;
    if (current !== 0 && prev === 0) {
      events.push({ index: i, color });
    }
    prev = current;
  }
  return events;
}

function getPlotScale(lineKey: LineKey) {
  if (lineKey === "mouseX") {
    return {
      min: 0,
      max: 360,
      ticks: [
        { value: 360, label: "360°", color: "#888888", y: 0 },
        { value: 270, label: "270°", color: "#888888", y: 45 },
        { value: 180, label: "180°", color: "#888888", y: 90 },
        { value: 90, label: "90°", color: "#888888", y: 135 },
        { value: 0, label: "0°", color: "#888888", y: 180 }
      ]
    };
  }

  if (lineKey === "mouseXSpeed") {
    return {
      min: -11.25,
      max: 11.25,
      ticks: [
        { value: 11.3, label: "11.3°", color: "#888888", y: 0 },
        { value: 5.6, label: "5.6°", color: "#888888", y: 45 },
        { value: 0.0, label: "0.0°", color: "#888888", y: 90 },
        { value: -5.6, label: "-5.6°", color: "#888888", y: 135 },
        { value: -11.3, label: "-11.3°", color: "#888888", y: 180 }
      ]
    };
  }

  if (lineKey === "jumpHeight") {
    return {
      min: -50,
      max: 100,
      ticks: [
        { value: 100, label: "100u", color: "#888888", y: 0 },
        { value: 75, label: "75u", color: "#888888", y: 30 },
        { value: 50, label: "50u", color: "#888888", y: 60 },
        { value: 25, label: "25u", color: "#888888", y: 90 },
        { value: 0, label: "0u", color: "#888888", y: 120 },
        { value: -25, label: "-25u", color: "#888888", y: 150 },
        { value: -50, label: "-50u", color: "#888888", y: 180 }
      ]
    };
  }

  // engineFps & realFps (drawingHeight = 155, offset = 25)
  return {
    min: 0,
    max: 110,
    ticks: [
      { value: 108, label: "> 100 fps", color: "#ff0000", y: 0 },
      { value: 100, label: "100 fps", color: "#00ff00", y: 25 },
      { value: 83, label: "83 fps", color: "#66da2f", y: 51 },
      { value: 50, label: "50 fps", color: "#ff0000", y: 103 },
      { value: 25, label: "25 fps", color: "#ff0000", y: 141 },
      { value: 0, label: "0 fps", color: "#ff0000", y: 180 }
    ]
  };
}

function jumpTitle(jump: GraphViewerJump | TechniqueVm): string {
  if (jump.label === "sbj") return "Stand-up bhop jump";
  if (jump.label === "hj") return "High jump";
  if (jump.label === "bhop" || jump.label === "bj") return "Bhop jump";
  if (jump.label === "cj") return "Count jump";
  if (jump.label === "scj") return "Stand-up count jump";
  return "Long jump";
}

export function App() {
  const [demoId, setDemoId] = useState<string>("sample");
  const [dataset, setDataset] = useState<GraphViewerDataset | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lineKey, setLineKey] = useState<LineKey>("mouseX");
  const [hoverFrameIndex, setHoverFrameIndex] = useState(246);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedHint, setCopiedHint] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 1080);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".dem")) {
      setErrorText("Please upload a .dem file.");
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const res = await uploadDemo(file);
      const uploadedId = res.demos[0]?.id;
      if (uploadedId) {
        setDemoId(uploadedId);
        const url = new URL(window.location.href);
        url.searchParams.set("demo", uploadedId);
        url.searchParams.delete("frame");
        window.history.pushState({}, "", url.toString());
        await loadData(uploadedId);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Failed to upload demo.");
    } finally {
      setBusy(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
    event.target.value = "";
  };

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        void handleFileUpload(file);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const totalFrames = dataset?.dense.frame.length ?? 0;
  const frameIndex = clamp(hoverFrameIndex, 0, Math.max(0, totalFrames - 1));
  const hoverFrame = dataset?.dense.frame[frameIndex] ?? frameIndex;

  const series = dataset?.dense[lineKey] ?? [];
  const scale = useMemo(() => getPlotScale(lineKey), [lineKey]);

  const activeJump = useMemo(() => {
    if (!dataset) return null;
    return dataset.jumps.find((jump) => hoverFrame >= jump.startFrame && hoverFrame <= jump.endFrame) ?? null;
  }, [dataset, hoverFrame]);

  const commandLines = useMemo(() => {
    return formatCommandsAtFrame(dataset?.sparse.commands, hoverFrame);
  }, [dataset, hoverFrame]);

  async function loadData(id: string) {
    setBusy(true);
    setErrorText("");
    try {
      const data = await getGraphViewer(id);
      setDataset(data);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Failed to load graph viewer dataset.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("demo") || params.get("id") || "sample";
    setDemoId(queryId);
    loadData(queryId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryTab = params.get("tab");
    if (queryTab && lineConfig[queryTab as LineKey]) {
      setLineKey(queryTab as LineKey);
    }
    const queryFrame = params.get("frame");
    if (queryFrame && Number.isFinite(Number(queryFrame))) {
      setHoverFrameIndex(Number(queryFrame));
    }
  }, [dataset]);

  const graphWidth = Math.max(1, totalFrames);
  // Unique-KZ class f: position() { return new Point(0, 15); } - upper graph container top offset is 15px
  const plotTop = 15;

  // 539_beautified.js line 2309: barsContainer.position.y = bounds.height - barsDrawingHeight
  // Top HUD = 130px, Tabs = 30px, Scrollbar = 20px. GraphicWindow height = viewportHeight - 180
  // barsDrawingHeight = 260px.
  const graphicWindowHeight = Math.max(450, viewportHeight - 180);
  const lanesTop = Math.max(195, graphicWindowHeight - 260);
  const graphHeight = lanesTop + 247 + 5;
  const cursorX = frameIndex;

  const lanePositions = useMemo(() => {
    let currentTop = lanesTop;
    return laneConfigs.map((cfg) => {
      const pos = { key: cfg.key, label: cfg.label, height: cfg.height, top: currentTop };
      currentTop += cfg.height + 5;
      return pos;
    });
  }, [lanesTop]);

  // MouseX path segments with 180 wrap discontinuity
  const mouseXSegments = useMemo(() => {
    if (lineKey !== "mouseX" || series.length === 0) return [];
    const segments: string[] = [];
    let current = "";
    for (let i = 0; i < series.length; i += 1) {
      const val = series[i] ?? 0;
      const y = plotTop + (1 - clamp(val, 0, 360) / 360) * 180;
      if (i > 0) {
        const prev = series[i - 1] ?? 0;
        if (Math.abs(val - prev) > 180) {
          if (current) segments.push(current);
          current = `M${i},${y.toFixed(2)}`;
          continue;
        }
      }
      current += `${current ? " L" : "M"}${i},${y.toFixed(2)}`;
    }
    if (current) segments.push(current);
    return segments;
  }, [lineKey, series, plotTop]);

  // EngineFps rects/points (NO vertical drop lines)
  const engineFpsPoints = useMemo(() => {
    if (lineKey !== "engineFps" || series.length === 0) return [];
    const points: Array<{ x: number; y: number; color: string }> = [];
    for (let i = 0; i < series.length; i += 1) {
      const fps = series[i] ?? 0;
      if (fps <= 0) continue;
      const isOver100 = fps > 100;
      const y = plotTop + (isOver100 ? 0 : 25 + ((100 - fps) * 155) / 100);
      points.push({ x: i, y, color: isOver100 ? "#ff0000" : "#ffa000" });
    }
    return points;
  }, [lineKey, series, plotTop]);

  // RealFps rects/points (pure red #ff0000, 1:1 matching Unique-KZ)
  const realFpsPoints = useMemo(() => {
    if (lineKey !== "realFps" || !dataset?.dense.realFps) return [];
    const arr = dataset.dense.realFps;
    const points: Array<{ x: number; y: number; color: string }> = [];
    for (let i = 0; i < arr.length; i += 1) {
      const fps = arr[i] ?? 0;
      if (fps <= 0) continue;
      const y = plotTop + (fps > 100 ? 0 : 25 + ((100 - fps) * 155) / 100);
      points.push({ x: i, y, color: "#ff0000" });
    }
    return points;
  }, [lineKey, dataset, plotTop]);

  // MouseXSpeed points ((11.25 - deltaMouseX) * 8 in #aaaaaa, 1:1 matching Unique-KZ)
  const mouseXSpeedPoints = useMemo(() => {
    if (lineKey !== "mouseXSpeed" || !dataset?.dense.mouseXSpeed) return [];
    const arr = dataset.dense.mouseXSpeed;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 1; i < arr.length; i += 1) {
      const delta = arr[i] ?? 0;
      const y = plotTop + (11.25 - delta) * 8;
      if (y > plotTop && y < plotTop + 180) {
        points.push({ x: i, y });
      }
    }
    return points;
  }, [lineKey, dataset, plotTop]);

  // JumpHeight curves: Demo (measured, #aaaaaa) and Calc (ballistic, #00ffff)
  const jumpHeightPoints = useMemo(() => {
    if (lineKey !== "jumpHeight" || !dataset) return { demo: [], calc: [] };
    const demoPoints: Array<{ x: number; y: number }> = [];
    const calcPoints: Array<{ x: number; y: number }> = [];
    const demoArr = dataset.dense.jumpHeightDemo ?? dataset.dense.jumpHeight ?? [];
    const calcArr = dataset.dense.jumpHeightCalc ?? [];

    for (let i = 0; i < demoArr.length; i += 1) {
      const dh = demoArr[i] ?? 0;
      if (dh > -50) {
        const y = plotTop + ((100 - dh) / 150) * 180;
        demoPoints.push({ x: i, y });
      }
    }
    for (let i = 0; i < calcArr.length; i += 1) {
      const ch = calcArr[i] ?? 0;
      if (ch > -50) {
        const y = plotTop + ((100 - ch) / 150) * 180;
        calcPoints.push({ x: i, y });
      }
    }
    return { demo: demoPoints, calc: calcPoints };
  }, [lineKey, dataset, plotTop]);

  const techniques: TechniqueVm[] = useMemo(() => {
    if (!dataset) return [];
    return dataset.jumps.map((jump) => ({
      startFrame: jump.startFrame,
      endFrame: jump.endFrame,
      label: jump.label,
      color: jump.color,
      sync: jump.sync,
      distance: jump.distance,
      prestrafe: jump.prestrafe,
      maxspeed: jump.maxspeed,
      strafes: jump.strafes,
      isIdealBhop: jump.isIdealBhop,
      distanceXy: jump.distanceXy,
      block: jump.block,
      jumpoff: jump.jumpoff,
      landing: jump.landing,
      frames: jump.frames,
      framesInDuck: jump.framesInDuck,
      preJumpVelocityJumpoff: jump.preJumpVelocityJumpoff,
      preJumpVelocityBeforeJumpoff: jump.preJumpVelocityBeforeJumpoff
    }));
  }, [dataset]);

  // Two-tone movement segments
  const forwardBase = useMemo(() => dataset ? buildSegmentsWithMinGap(dataset.lanes.forward, 1) : [], [dataset]);
  const backBase = useMemo(() => dataset ? buildSegmentsWithMinGap(dataset.lanes.back, 1) : [], [dataset]);
  const moveleftBase = useMemo(() => dataset ? buildSegmentsWithMinGap(dataset.lanes.moveleft, 1) : [], [dataset]);
  const moverightBase = useMemo(() => dataset ? buildSegmentsWithMinGap(dataset.lanes.moveright, 1) : [], [dataset]);

  const groundSegments = useMemo(() => dataset ? buildSegmentsWithMinGap(dataset.lanes.ground, 2) : [], [dataset]);
  const duckSegments = useMemo(() => dataset ? buildSegmentsWithMinGap(dataset.lanes.duck, 1) : [], [dataset]);

  // Duckstate: state 1 (transition: orange) vs state 2 (ducked: green)
  const duckstate1Segments = useMemo(() => {
    if (!dataset) return [];
    const mask = dataset.lanes.duckstate.map((v) => (v === 1 ? 1 : 0));
    return buildSegmentsWithMinGap(mask, 1);
  }, [dataset]);

  const duckstate2Segments = useMemo(() => {
    if (!dataset) return [];
    const mask = dataset.lanes.duckstate.map((v) => (v === 2 ? 1 : 0));
    return buildSegmentsWithMinGap(mask, 1);
  }, [dataset]);

  // Turning segments for movement lanes
  const turnUpSegments = useMemo(() => {
    if (!dataset?.dense.pitch) return [];
    const p = dataset.dense.pitch;
    const mask = p.map((val, idx) => {
      if (idx === 0) return 0;
      let diff = val - p[idx - 1];
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      return diff > 0 ? 1 : 0;
    });
    return buildSegmentsWithMinGap(mask, 1);
  }, [dataset]);

  const turnDownSegments = useMemo(() => {
    if (!dataset?.dense.pitch) return [];
    const p = dataset.dense.pitch;
    const mask = p.map((val, idx) => {
      if (idx === 0) return 0;
      let diff = val - p[idx - 1];
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      return diff < 0 ? 1 : 0;
    });
    return buildSegmentsWithMinGap(mask, 1);
  }, [dataset]);

  const turnLeftSegments = useMemo(() => {
    if (!dataset?.dense.mouseX) return [];
    const y = dataset.dense.mouseX;
    const mask = y.map((val, idx) => {
      if (idx === 0) return 0;
      let diff = val - y[idx - 1];
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      return diff > 0 ? 1 : 0;
    });
    return buildSegmentsWithMinGap(mask, 1);
  }, [dataset]);

  const turnRightSegments = useMemo(() => {
    if (!dataset?.dense.mouseX) return [];
    const y = dataset.dense.mouseX;
    const mask = y.map((val, idx) => {
      if (idx === 0) return 0;
      let diff = val - y[idx - 1];
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      return diff < 0 ? 1 : 0;
    });
    return buildSegmentsWithMinGap(mask, 1);
  }, [dataset]);

  const jumpCommandLines = useMemo(() => {
    return dataset
      ? computeJumpCommandLines(
          totalFrames,
          dataset.sparse.commands,
          dataset.dense.fuser2,
          dataset.dense.buttons
        )
      : [];
  }, [dataset, totalFrames]);

  const jumpHoldSegments = useMemo(() => {
    return dataset
      ? computeJumpHoldSegments(
          totalFrames,
          dataset.sparse.commands,
          dataset.dense.buttons
        )
      : [];
  }, [dataset, totalFrames]);

  const visibleWidth = scrollContainerRef.current?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth - 80 : 1800);
  const maxScroll = Math.max(1, totalFrames - visibleWidth);
  const trackWidth = typeof window !== "undefined" ? window.innerWidth - 80 : 1800;
  const thumbWidth = 100;
  const maxThumbLeft = Math.max(1, trackWidth - thumbWidth);
  const thumbLeft = clamp((scrollLeft / maxScroll) * maxThumbLeft, 0, maxThumbLeft);

  const handleViewportScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollbarTrackRef.current || !scrollContainerRef.current) return;
    const rect = scrollbarTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetThumbLeft = clamp(clickX - thumbWidth / 2, 0, maxThumbLeft);
    const targetScroll = Math.round((targetThumbLeft / maxThumbLeft) * maxScroll);
    scrollContainerRef.current.scrollLeft = targetScroll;
    setScrollLeft(targetScroll);
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startScrollLeft = scrollContainerRef.current ? scrollContainerRef.current.scrollLeft : 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const dx = moveEvent.clientX - startX;
      const dScroll = (dx / maxThumbLeft) * maxScroll;
      const newScroll = clamp(Math.round(startScrollLeft + dScroll), 0, maxScroll);
      scrollContainerRef.current.scrollLeft = newScroll;
      setScrollLeft(newScroll);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollContainerRef.current) return;
    e.preventDefault();
    const delta = e.deltaY || e.deltaX;
    const step = delta > 0 ? 200 : -200;
    const newScroll = clamp(scrollContainerRef.current.scrollLeft + step, 0, maxScroll);
    scrollContainerRef.current.scrollLeft = newScroll;
    setScrollLeft(newScroll);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
        return;
      }

      let step = 1;
      if (e.shiftKey) step = 10;
      if (e.ctrlKey) step = 100;

      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        setHoverFrameIndex((prev) => {
          const next = Math.max(0, prev - step);
          if (scrollContainerRef.current) {
            const vis = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollLeft = clamp(Math.round(next - 0.5 * vis), 0, maxScroll);
            setScrollLeft(scrollContainerRef.current.scrollLeft);
          }
          return next;
        });
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        setHoverFrameIndex((prev) => {
          const next = Math.min(totalFrames - 1, prev + step);
          if (scrollContainerRef.current) {
            const vis = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollLeft = clamp(Math.round(next - 0.5 * vis), 0, maxScroll);
            setScrollLeft(scrollContainerRef.current.scrollLeft);
          }
          return next;
        });
      } else if (e.code === "Home") {
        e.preventDefault();
        const start = dataset?.meta.startFrame ?? 0;
        setHoverFrameIndex(start);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = 0;
          setScrollLeft(0);
        }
      } else if (e.code === "End") {
        e.preventDefault();
        setHoverFrameIndex(totalFrames - 1);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = maxScroll;
          setScrollLeft(maxScroll);
        }
      } else if (e.code === "PageDown") {
        e.preventDefault();
        if (scrollContainerRef.current) {
          const vis = scrollContainerRef.current.clientWidth;
          const next = clamp(scrollContainerRef.current.scrollLeft + vis, 0, maxScroll);
          scrollContainerRef.current.scrollLeft = next;
          setScrollLeft(next);
        }
      } else if (e.code === "PageUp") {
        e.preventDefault();
        if (scrollContainerRef.current) {
          const vis = scrollContainerRef.current.clientWidth;
          const next = clamp(scrollContainerRef.current.scrollLeft - vis, 0, maxScroll);
          scrollContainerRef.current.scrollLeft = next;
          setScrollLeft(next);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalFrames, maxScroll, dataset]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setHoverFrameIndex((prev) => {
        if (prev >= totalFrames - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        if (scrollContainerRef.current) {
          const vis = scrollContainerRef.current.clientWidth;
          const target = Math.floor(next - 0.2 * vis);
          scrollContainerRef.current.scrollLeft = clamp(target, 0, maxScroll);
          setScrollLeft(scrollContainerRef.current.scrollLeft);
        }
        return next;
      });
    }, 10);
    return () => clearInterval(timer);
  }, [isPlaying, totalFrames, maxScroll]);

  const handleJumpClick = (jump: TechniqueVm) => {
    const text = `${jumpTitle(jump)} ${formatNum(jump.distance, 3)} maxspeed:${formatNum(jump.maxspeed, 3)} prestrafe:${formatNum(jump.prestrafe, 3)} strafes:${jump.strafes} sync:${formatNum(jump.sync, 0)}%`;
    navigator.clipboard?.writeText(text);
    setCopiedHint(true);
    setTimeout(() => setCopiedHint(false), 2000);
  };

  const handleViewportPointer = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dataset || totalFrames === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left + event.currentTarget.scrollLeft;
    setHoverFrameIndex(clamp(Math.round(clickX), 0, totalFrames - 1));
  };

  const hudData = dataset
    ? {
        frame: hoverFrame,
        serverTime: formatServerTime(dataset.dense.time[frameIndex] ?? 0),
        realFps: (dataset.dense.frametime[frameIndex] ?? 0) > 0 ? (1 / dataset.dense.frametime[frameIndex]).toFixed(5) : "0.00000",
        engineFps: dataset.dense.engineFps[frameIndex] ? Math.round(dataset.dense.engineFps[frameIndex]) : 0,
        frameLength: (dataset.dense.frametime[frameIndex] ?? 0).toFixed(8),
        msec: dataset.dense.frametime[frameIndex] ? Math.round(dataset.dense.frametime[frameIndex] * 1000) : 0,
        movetype: movetypeLabel(dataset.dense.movetype[frameIndex] ?? 0),
        health: dataset.dense.health[frameIndex] ?? 511,
        originX: formatNum(dataset.dense.originX[frameIndex] ?? 0, 3),
        originY: formatNum(dataset.dense.originY[frameIndex] ?? 0, 3),
        originZ: formatNum(dataset.dense.originZ[frameIndex] ?? 0, 3),
        velocityX: formatNum(dataset.dense.velocityX[frameIndex] ?? 0, 3),
        velocityY: formatNum(dataset.dense.velocityY[frameIndex] ?? 0, 3),
        velocityZ: formatNum(dataset.dense.velocityZ[frameIndex] ?? 0, 3),
        velocityXY: formatNum(dataset.dense.velocityXY[frameIndex] ?? 0, 3),
        fuser2: String(dataset.dense.fuser2?.[frameIndex] ?? 0),
        weapon: dataset.dense.weapon?.[frameIndex] || "n/a",
        maxspeed: formatNum(dataset.dense.maxspeed[frameIndex] ?? 0, 3),
        forwardmove: formatNum(dataset.dense.forwardmove[frameIndex] ?? 0, 3),
        sidemove: formatNum(dataset.dense.sidemove[frameIndex] ?? 0, 3),
        upmove: formatNum(dataset.dense.upmove[frameIndex] ?? 0, 3),
        flags: formatFlagsList(dataset.dense.flags[frameIndex] ?? 0),
        buttons: formatButtonsList(dataset.dense.buttons[frameIndex] ?? 0),
        commands: commandLines
      }
    : null;

  return (
    <div className="graph-viewer-root">
      <input
        ref={fileInputRef}
        type="file"
        accept=".dem"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      {dataset && hudData && (
        <div className="graph-shell">
          {/* Top HUD Panel: 5 exact columns matching Unique-KZ */}
          <section className="top-panel">
            <div className="toggle-fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}>
              Toggle<br />fullscreen
            </div>

            {/* Column 1: Frame info */}
            <div className="hud-col col-1">
              <div className="hud-row"><span className="hud-lbl">Frame</span><strong className="hud-val">{hudData.frame}</strong></div>
              <div className="hud-row"><span className="hud-lbl time-lbl">Server Time</span><strong className="hud-val">{hudData.serverTime}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Real fps</span><strong className="hud-val">{hudData.realFps}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Engine fps</span><strong className="hud-val">{hudData.engineFps}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Frame length</span><strong className="hud-val">{hudData.frameLength}</strong></div>
              <div className="hud-row"><span className="hud-lbl">MSec</span><strong className="hud-val">{hudData.msec}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Movetype</span><strong className="hud-val">{hudData.movetype}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Health</span><strong className="hud-val">{hudData.health}</strong></div>
            </div>

            {/* Column 2: Origin & Velocity */}
            <div className="hud-col col-2">
              <div className="hud-row"><span className="hud-lbl">Origin X</span><strong className="hud-val">{hudData.originX}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Origin Y</span><strong className="hud-val">{hudData.originY}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Origin Z</span><strong className="hud-val">{hudData.originZ}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Velocity X</span><strong className="hud-val">{hudData.velocityX}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Velocity Y</span><strong className="hud-val">{hudData.velocityY}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Velocity Z</span><strong className="hud-val">{hudData.velocityZ}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Velocity XY</span><strong className="hud-val">{hudData.velocityXY}</strong></div>
              <div className="hud-row"><span className="hud-lbl">fuser2</span><strong className="hud-val">{hudData.fuser2}</strong></div>
            </div>

            {/* Column 3: Weapon & Movement */}
            <div className="hud-col col-3">
              <div className="hud-row"><span className="hud-lbl">Weapon</span><strong className="hud-val">{hudData.weapon}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Maxspeed</span><strong className="hud-val">{hudData.maxspeed}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Forwardmove</span><strong className="hud-val">{hudData.forwardmove}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Sidemove</span><strong className="hud-val">{hudData.sidemove}</strong></div>
              <div className="hud-row"><span className="hud-lbl">Upmove</span><strong className="hud-val">{hudData.upmove}</strong></div>
            </div>

            {/* Column 4: Flags & Buttons */}
            <div className="hud-col col-4">
              <div className="hud-stacked">
                <span className="hud-lbl">Flags</span>
                <div className="hud-val-list">
                  {hudData.flags.map((flag) => (
                    <div key={flag} className="hud-val">{flag}</div>
                  ))}
                </div>
              </div>
              <div className="hud-stacked" style={{ marginTop: 25 }}>
                <span className="hud-lbl">Buttons</span>
                <div className="hud-val-list">
                  {hudData.buttons.map((btn) => (
                    <div key={btn} className="hud-val">{btn}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 5: Commands */}
            <div className="hud-col col-5">
              <div className="hud-stacked">
                <span className="hud-lbl">Commands</span>
                <div className="hud-val-list">
                  {hudData.commands.map((cmd, idx) => (
                    <div key={idx} className="hud-val">{cmd}</div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Switcher Bar: 30px height, from y=130 to 160 */}
          <div className="line-tabs">
            {(Object.keys(lineConfig) as LineKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={key === lineKey ? "active tab-item" : "tab-item"}
                onClick={() => setLineKey(key)}
              >
                {lineConfig[key].label}
              </button>
            ))}
          </div>

          {/* Main Visualizer Area */}
          <div className="graph-container-wrap">
            {/* Left Axis Gutter (80px wide) */}
            <div className="left-axis-gutter">
              <svg width={80} height={graphHeight} className="left-gutter-svg">
                {/* Plot scale ticks (Unique-KZ anchor (1, 1): bottom aligned directly on top of line) */}
                {scale.ticks.map((tick) => (
                  <text
                    key={`tick-${tick.label}`}
                    x={75}
                    y={plotTop + tick.y - 2}
                    textAnchor="end"
                    className="axis-label"
                    fill={tick.color}
                  >
                    {tick.label}
                  </text>
                ))}

                {/* 12 Lane labels */}
                {lanePositions.map((lane) => (
                  <text
                    key={`lane-lbl-${lane.key}`}
                    x={75}
                    y={lane.top + lane.height}
                    textAnchor="end"
                    className="lane-label-text"
                  >
                    {lane.label}
                  </text>
                ))}

                {/* 1px Vertical divider at x = 79 */}
                <line x1={79} y1={0} x2={79} y2={graphHeight} stroke="#7f7f7f" strokeWidth={1} />
              </svg>
            </div>

            {/* Scrollable Viewport: 1 frame = 1 pixel */}
            <div
              className="graph-viewport"
              ref={scrollContainerRef}
              onMouseMove={handleViewportPointer}
              onClick={handleViewportPointer}
              onScroll={handleViewportScroll}
              onWheel={handleWheel}
            >
              <svg
                width={graphWidth}
                height={graphHeight}
                className="main-graph"
                role="img"
                aria-label="Graph plot"
              >
                {/* Grid lines for plot ticks */}
                {scale.ticks.map((tick) => (
                  <line
                    key={`gl-${tick.label}`}
                    x1={0}
                    y1={plotTop + tick.y}
                    x2={graphWidth}
                    y2={plotTop + tick.y}
                    stroke="#444444"
                    strokeWidth={1}
                  />
                ))}

                {/* MouseX waveform */}
                {lineKey === "mouseX" &&
                  mouseXSegments.map((d, idx) => (
                    <path key={idx} d={d} fill="none" stroke="#ffffff" strokeWidth={1} />
                  ))}

                {/* EngineFps points */}
                {lineKey === "engineFps" &&
                  engineFpsPoints.map((pt, idx) => (
                    <rect key={idx} x={pt.x} y={pt.y} width={1} height={1} fill={pt.color} shapeRendering="crispEdges" />
                  ))}

                {/* RealFps points (pure red #ff0000) */}
                {lineKey === "realFps" &&
                  realFpsPoints.map((pt, idx) => (
                    <rect key={idx} x={pt.x} y={pt.y} width={1} height={1} fill={pt.color} shapeRendering="crispEdges" />
                  ))}

                {/* MouseX Speed points (#aaaaaa) */}
                {lineKey === "mouseXSpeed" &&
                  mouseXSpeedPoints.map((pt, idx) => (
                    <rect key={idx} x={pt.x} y={pt.y} width={1} height={1} fill="#aaaaaa" shapeRendering="crispEdges" />
                  ))}

                {/* Jump Height curves: Demo (#aaaaaa) and Calc (#00ffff) */}
                {lineKey === "jumpHeight" && (
                  <>
                    {jumpHeightPoints.demo.map((pt, idx) => (
                      <rect key={`jhd-${idx}`} x={pt.x} y={pt.y} width={1} height={1} fill="#aaaaaa" shapeRendering="crispEdges" />
                    ))}
                    {jumpHeightPoints.calc.map((pt, idx) => (
                      <rect key={`jhc-${idx}`} x={pt.x} y={pt.y} width={1} height={1} fill="#00ffff" shapeRendering="crispEdges" />
                    ))}
                  </>
                )}

                {/* 12 Lanes */}
                {lanePositions.map((lane) => {
                  const top = lane.top;
                  const h = lane.height;

                  return (
                    <g key={lane.key}>
                      {/* Divider line below lane */}
                      <line
                        x1={0}
                        y1={top + h + 2}
                        x2={graphWidth}
                        y2={top + h + 2}
                        stroke="#444444"
                        strokeWidth={1}
                      />

                      {/* Lane-specific contents */}
                      {lane.key === "techniques" &&
                        techniques.map((jump, jidx) => {
                          const w = jump.endFrame - jump.startFrame + 1;
                          const isBhop = jump.label === "sbj" || jump.label === "bj";
                          const markerColor = jump.isIdealBhop ? "#008800" : "#880000";

                          return (
                            <g key={`tech-${jidx}`} onClick={() => handleJumpClick(jump)} style={{ cursor: "pointer" }}>
                              {/* Jump rect */}
                              <rect x={jump.startFrame} y={top} width={w} height={h} fill={jump.color} />

                              {/* Bhop marker circle centered directly on startFrame */}
                              {isBhop && (
                                <>
                                  <circle cx={jump.startFrame} cy={top + 7.5} r={5.5} fill="#444444" />
                                  <circle cx={jump.startFrame} cy={top + 7.5} r={4.5} fill={markerColor} />
                                </>
                              )}

                              {/* Centered label */}
                              <text
                                x={jump.startFrame + w / 2}
                                y={top + 11.5}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="10px"
                                fontWeight="bold"
                                fontFamily="Roboto, sans-serif"
                              >
                                {jump.label}
                              </text>
                            </g>
                          );
                        })}

                      {lane.key === "jump" && (
                        <>
                          {/* Jump spacebar hold bars */}
                          {jumpHoldSegments.map((seg, sidx) => (
                            <rect
                              key={`jmph-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#555555"
                            />
                          ))}

                          {/* Jump command scroll notches: exact 1px lines matching Unique-KZ */}
                          {jumpCommandLines.map((cmd, cidx) => (
                            <rect
                              key={`jmpc-${cidx}`}
                              x={cmd.frame}
                              y={top + cmd.yOffset}
                              width={1}
                              height={cmd.h}
                              fill={cmd.color}
                              shapeRendering="crispEdges"
                            />
                          ))}
                        </>
                      )}

                      {lane.key === "ground" &&
                        groundSegments.map((seg, sidx) => (
                          <rect
                            key={`grd-${sidx}`}
                            x={seg.start}
                            y={top}
                            width={Math.max(1, seg.end - seg.start + 1)}
                            height={h}
                            fill="#555555"
                          />
                        ))}

                      {lane.key === "duck" && (
                        <>
                          {duckSegments.map((seg, sidx) => (
                            <g key={`dck-${sidx}`}>
                              <rect
                                x={seg.start}
                                y={top}
                                width={Math.max(1, seg.end - seg.start + 1)}
                                height={h}
                                fill="#555555"
                              />
                              {/* Red line at +duck */}
                              <line x1={seg.start} y1={top} x2={seg.start} y2={top + h} stroke="#ff0000" strokeWidth={1} />
                              {/* Blue line at -duck */}
                              <line x1={seg.end + 1} y1={top} x2={seg.end + 1} y2={top + h} stroke="#0000ff" strokeWidth={1} />
                            </g>
                          ))}
                        </>
                      )}

                      {lane.key === "duckstate" && (
                        <>
                          {duckstate1Segments.map((seg, sidx) => (
                            <rect
                              key={`ds1-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#ffa000"
                            />
                          ))}
                          {duckstate2Segments.map((seg, sidx) => (
                            <rect
                              key={`ds2-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#00ff88"
                            />
                          ))}
                        </>
                      )}

                      {lane.key === "forward" && (
                        <>
                          {forwardBase.map((seg, sidx) => (
                            <rect
                              key={`fwd-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#555555"
                            />
                          ))}
                          {turnUpSegments.map((seg, sidx) => (
                            <rect
                              key={`tu-${sidx}`}
                              x={seg.start}
                              y={top + 7.5}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={7.5}
                              fill="#888888"
                            />
                          ))}
                        </>
                      )}

                      {lane.key === "back" && (
                        <>
                          {backBase.map((seg, sidx) => (
                            <rect
                              key={`bk-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#555555"
                            />
                          ))}
                          {turnDownSegments.map((seg, sidx) => (
                            <rect
                              key={`td-${sidx}`}
                              x={seg.start}
                              y={top + 7.5}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={7.5}
                              fill="#888888"
                            />
                          ))}
                        </>
                      )}

                      {lane.key === "moveleft" && (
                        <>
                          {moveleftBase.map((seg, sidx) => (
                            <rect
                              key={`ml-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#555555"
                            />
                          ))}
                          {turnLeftSegments.map((seg, sidx) => (
                            <rect
                              key={`tl-${sidx}`}
                              x={seg.start}
                              y={top + 7.5}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={7.5}
                              fill="#888888"
                            />
                          ))}
                        </>
                      )}

                      {lane.key === "moveright" && (
                        <>
                          {moverightBase.map((seg, sidx) => (
                            <rect
                              key={`mr-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={h}
                              fill="#555555"
                            />
                          ))}
                          {turnRightSegments.map((seg, sidx) => (
                            <rect
                              key={`tr-${sidx}`}
                              x={seg.start}
                              y={top}
                              width={Math.max(1, seg.end - seg.start + 1)}
                              height={7.5}
                              fill="#888888"
                            />
                          ))}
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Vertical Cursor Line: cyan #00ffff */}
                <line x1={cursorX} y1={0} x2={cursorX} y2={graphHeight} stroke="#00ffff" strokeWidth={1} />

                {/* Vertical Start & Stop Lines: red #ff0000 at timer.start_frame / timer.stop_frame */}
                {dataset.meta.startFrame !== undefined && (
                  <line
                    x1={dataset.meta.startFrame}
                    y1={0}
                    x2={dataset.meta.startFrame}
                    y2={graphHeight}
                    stroke="#ff0000"
                    strokeWidth={1}
                  />
                )}
                {dataset.meta.stopFrame !== undefined && (
                  <line
                    x1={dataset.meta.stopFrame}
                    y1={0}
                    x2={dataset.meta.stopFrame}
                    y2={graphHeight}
                    stroke="#ff0000"
                    strokeWidth={1}
                  />
                )}
              </svg>

              {/* MouseX & MouseX Speed Tooltip (1:1 with Unique-KZ createStatsContainer) */}
              {(lineKey === "mouseX" || lineKey === "mouseXSpeed") && (
                <div
                  className="mouse-tooltip"
                  style={{
                    left: cursorX + 8,
                    top: lineKey === "mouseX"
                      ? Math.min(160, Math.max(15, plotTop + (1 - clamp(dataset.dense.mouseX[frameIndex] ?? 0, 0, 360) / 360) * 180 - 15))
                      : Math.min(160, Math.max(15, plotTop + (11.25 - (dataset.dense.mouseXSpeed[frameIndex] ?? 0)) * 8 - 15))
                  }}
                >
                  <div className="mouse-tooltip-row"><span>Angle:</span><strong>{formatNum(dataset.dense.mouseX[frameIndex] ?? 0, 3)}</strong></div>
                  <div className="mouse-tooltip-row"><span>YawSpeed:</span><strong>{formatNum(dataset.dense.mouseXSpeed[frameIndex] ?? 0, 3)}</strong></div>
                </div>
              )}

              {/* Jump Stats Popup (Authentic Unique-KZ) */}
              {activeJump && (
                <aside
                  className="jump-popup"
                  style={{
                    left: clamp(
                      (activeJump.startFrame + activeJump.endFrame) / 2 - 105,
                      scrollContainerRef.current ? scrollContainerRef.current.scrollLeft + 10 : 10,
                      scrollContainerRef.current ? scrollContainerRef.current.scrollLeft + scrollContainerRef.current.clientWidth - 225 : 1000
                    ),
                    top: Math.max(10, lanesTop + 60 - 240)
                  }}
                >
                  <h3>{jumpTitle(activeJump)}</h3>
                  <p><span>Frame:</span><strong>{activeJump.endFrame}</strong></p>
                  <p><span>Distance:</span><strong>{formatNum(activeJump.distance, 3)}</strong></p>
                  {activeJump.distanceXy !== undefined && (
                    <p><span>Distance X/Y:</span><strong>{formatNum(activeJump.distanceXy, 3)}</strong></p>
                  )}
                  <p><span>MaxSpeed:</span><strong>{formatNum(activeJump.maxspeed, 3)}</strong></p>
                  <p>
                    <span>Prestrafe:</span>
                    <strong>
                      {activeJump.preJumpVelocityJumpoff !== undefined && activeJump.preJumpVelocityJumpoff !== activeJump.prestrafe
                        ? `${formatNum(activeJump.prestrafe, 3)} (${formatNum(activeJump.preJumpVelocityJumpoff, 3)})`
                        : formatNum(activeJump.prestrafe, 3)}
                    </strong>
                  </p>
                  {activeJump.preJumpVelocityBeforeJumpoff !== undefined && (
                    <p><span>OldSpeed:</span><strong>{formatNum(activeJump.preJumpVelocityBeforeJumpoff, 3)}</strong></p>
                  )}
                  <p><span>Strafes:</span><strong>{activeJump.strafes}</strong></p>
                  <p><span>Sync:</span><strong>{formatNum(activeJump.sync, 0)}%</strong></p>
                  <p><span>Frames (duck/air):</span><strong>{activeJump.framesInDuck ?? 0}/{activeJump.frames ?? 0}</strong></p>
                  {activeJump.block !== undefined && (
                    <p><span>Block:</span><strong>{activeJump.block}</strong></p>
                  )}
                  <p><span>Jump off:</span><strong>{activeJump.jumpoff !== undefined ? formatNum(activeJump.jumpoff, 3) : activeJump.startFrame}</strong></p>
                  <p><span>Landing:</span><strong>{activeJump.landing !== undefined ? formatNum(activeJump.landing, 3) : activeJump.endFrame}</strong></p>
                  <div className="copy-hint">{copiedHint ? "Copied!" : "Click on a bar to copy"}</div>
                </aside>
              )}
            </div>
          </div>

          {/* Authentic Unique-KZ Bottom Scrollbar */}
          <div
            ref={scrollbarTrackRef}
            className="bottom-scrollbar"
            onClick={handleScrollbarClick}
          >
            <div
              className="scrollbar-thumb"
              style={{ left: thumbLeft }}
              onMouseDown={handleThumbMouseDown}
            />
          </div>
        </div>
      )}

      {busy && <div className="viewer-status">Loading...</div>}
      {errorText && <div className="viewer-status error">{errorText}</div>}
    </div>
  );
}

export default App;
