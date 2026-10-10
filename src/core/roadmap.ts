import type { Lesson, Level, Snapshot } from './types';

export type RoadmapState = 'reached' | 'current' | 'locked' | 'placement';
export interface RoadmapStage {
  level: Level;
  state: RoadmapState;
  completedLessons: number;
  totalLessons: number;
}
export interface MapPoint { x: number; y: number }
export interface MapSize { width: number; height: number }
export interface MapBox { left: number; top: number; width: number; height: number }
export type RoadmapBand = 'upper' | 'lower';

export interface RoadmapStop {
  index: number;
  band: RoadmapBand;
  /** Marker centre, also the road centreline point for this stop. */
  point: MapPoint;
  marker: MapBox;
  /** Label card: below an upper stop, above a lower stop. */
  label: MapBox;
  /** Marker and label card together, used as the tap target. */
  hit: MapBox;
  /** Index into `RoadmapLayout.samples` where the road passes through this stop. */
  sample: number;
  /** Horizontal scroll offset that centres this stop, clamped to the canvas. */
  offset: number;
}

export interface RoadmapLayout {
  canvas: MapSize;
  stops: RoadmapStop[];
  /** Road centreline, strictly increasing in x and never more than `step` between neighbours. */
  samples: MapPoint[];
  /** Cumulative chord length at each sample, starting at 0. */
  lengths: number[];
  /** Same as `stops[i].sample`, kept as a plain array for animation ranges. */
  stopSamples: number[];
  step: number;
  /** Largest scroll offset: canvas width minus viewport width, never negative. */
  maxScroll: number;
}

export interface RoadSegment { x: number; y: number; length: number; angle: number }
export interface PathWindow { input: number[]; x: number[]; y: number[]; angle: number[] }

export const MARKER_SIZE = 56;
export const MIN_HIT_SIZE = 44;
export const MAX_FONT_SCALE = 1.6;
/** Outer width of the road casing; the road surface is drawn narrower. */
export const ROAD_WIDTH = 26;
export const SEGMENT_STEP = 14;

const CARD_GAP = 10;
const CARD_CLEARANCE = 8;
const STOP_GAP = 120;
const TOP_INSET = 54;
const BOTTOM_INSET = 20;
const EDGE_PAD = 24;
const FLAG_ROOM = 54;
const FINE_STEPS = 240;
const MIN_WINDOW = 28;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function createRoadmapStages(snapshot: Snapshot, lessons: readonly Lesson[], levels: readonly Level[]): RoadmapStage[] {
  const current = levels.indexOf(snapshot.profile.level);
  const completed = new Set(snapshot.profile.completedLessonIds);
  return levels.map((level, index) => {
    const levelLessons = lessons.filter(lesson => lesson.level === level);
    const state: RoadmapState = !snapshot.profile.placementComplete
      ? index === current ? 'placement' : 'locked'
      : index < current ? 'reached' : index === current ? 'current' : 'locked';
    return { level, state, completedLessons: levelLessons.filter(lesson => completed.has(lesson.id)).length, totalLessons: levelLessons.length };
  });
}

function textScale(fontScale: number) {
  return clamp(Number.isFinite(fontScale) ? fontScale : 1, 1, MAX_FONT_SCALE);
}

/** Label card size for the text scale. Text is capped at MAX_FONT_SCALE by the card, so this is an upper bound. */
export function labelSize(fontScale: number): MapSize {
  const scale = textScale(fontScale);
  return { width: Math.ceil(126 * scale) + 28, height: Math.ceil(54 * scale) + 30 };
}

/** Viewport height that leaves room for the overlays above the upper stops and the cards below them. */
export function roadmapViewportHeight(fontScale: number) {
  return Math.ceil(320 + 40 * (textScale(fontScale) - 1));
}

/** Scroll offset that puts canvas x in the middle of the viewport, clamped to the scrollable range. */
export function scrollOffsetFor(x: number, canvasWidth: number, viewportWidth: number) {
  return clamp(x - viewportWidth / 2, 0, Math.max(0, canvasWidth - viewportWidth));
}

function sectionCurve(from: MapPoint, to: MapPoint, labelWidth: number): MapPoint[] {
  // The road runs flat past each label card and only changes band in the gap between cards.
  const bendStart = from.x + labelWidth / 2 + CARD_CLEARANCE;
  const bendEnd = to.x - labelWidth / 2 - CARD_CLEARANCE;
  const run = Math.max(1, bendEnd - bendStart);
  return Array.from({ length: FINE_STEPS + 1 }, (_, k) => {
    if (k === FINE_STEPS) return { x: to.x, y: to.y };
    const x = from.x + (to.x - from.x) * k / FINE_STEPS;
    return { x, y: from.y + (to.y - from.y) * smootherstep(clamp((x - bendStart) / run, 0, 1)) };
  });
}

function resample(curve: MapPoint[], maxStep: number): MapPoint[] {
  const cumulative = [0];
  for (let i = 1; i < curve.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y));
  const total = cumulative[cumulative.length - 1];
  const pieces = Math.max(1, Math.ceil(total / maxStep));
  const out = [curve[0]];
  let cursor = 1;
  for (let piece = 1; piece < pieces; piece++) {
    const target = total * piece / pieces;
    while (cumulative[cursor] < target) cursor++;
    const span = cumulative[cursor] - cumulative[cursor - 1];
    const t = span > 0 ? (target - cumulative[cursor - 1]) / span : 0;
    out.push({
      x: curve[cursor - 1].x + (curve[cursor].x - curve[cursor - 1].x) * t,
      y: curve[cursor - 1].y + (curve[cursor].y - curve[cursor - 1].y) * t,
    });
  }
  out.push(curve[curve.length - 1]);
  return out;
}

export function createRoadmapLayout(stageCount: number, viewport: MapSize, fontScale: number): RoadmapLayout {
  const count = Math.max(1, Math.floor(stageCount));
  const label = labelSize(fontScale);
  const height = Math.max(viewport.height, roadmapViewportHeight(fontScale));
  const half = MARKER_SIZE / 2;
  const upperY = TOP_INSET + half;
  const lowerY = height - BOTTOM_INSET - half;
  const sideInset = Math.max(label.width / 2, half + FLAG_ROOM) + EDGE_PAD;
  const spacing = label.width + STOP_GAP;
  const naturalWidth = sideInset * 2 + (count - 1) * spacing;
  const width = Math.max(viewport.width, naturalWidth);
  const shift = (width - naturalWidth) / 2;
  const maxScroll = Math.max(0, width - viewport.width);

  const points: MapPoint[] = Array.from({ length: count }, (_, index) => ({
    x: shift + sideInset + index * spacing,
    y: index % 2 === 0 ? upperY : lowerY,
  }));

  const samples: MapPoint[] = [points[0]];
  const stopSamples = [0];
  for (let index = 1; index < count; index++) {
    const section = resample(sectionCurve(points[index - 1], points[index], label.width), SEGMENT_STEP);
    samples.push(...section.slice(1));
    stopSamples.push(samples.length - 1);
  }
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) lengths.push(lengths[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));

  const stops: RoadmapStop[] = points.map((point, index) => {
    const band: RoadmapBand = index % 2 === 0 ? 'upper' : 'lower';
    const marker: MapBox = { left: point.x - half, top: point.y - half, width: MARKER_SIZE, height: MARKER_SIZE };
    const card: MapBox = {
      left: point.x - label.width / 2,
      top: band === 'upper' ? point.y + half + CARD_GAP : point.y - half - CARD_GAP - label.height,
      width: label.width,
      height: label.height,
    };
    const top = Math.min(marker.top, card.top);
    const bottom = Math.max(marker.top + marker.height, card.top + card.height);
    return {
      index,
      band,
      point,
      marker,
      label: card,
      hit: { left: card.left, top, width: card.width, height: bottom - top },
      sample: stopSamples[index],
      offset: scrollOffsetFor(point.x, width, viewport.width),
    };
  });

  return { canvas: { width, height }, stops, samples, lengths, stopSamples, step: SEGMENT_STEP, maxScroll };
}

/** One entry per chord between neighbouring samples, ready to draw as a rotated rounded rectangle. */
export function roadSegments(layout: RoadmapLayout): RoadSegment[] {
  return layout.samples.slice(1).map((end, index) => {
    const start = layout.samples[index];
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, length: Math.hypot(end.x - start.x, end.y - start.y), angle: Math.atan2(end.y - start.y, end.x - start.x) };
  });
}

/**
 * Evenly spaced points along the road between two samples, for piecewise-linear animation ranges.
 * `input` runs 0 to 1 by distance along the road; `angle` is the road direction in degrees.
 */
export function pathWindow(layout: RoadmapLayout, from: number, to: number, maxPoints: number): PathWindow {
  const last = layout.samples.length - 1;
  const start = clamp(Math.min(from, to), 0, last);
  const end = clamp(Math.max(from, to), 0, last);
  const span = end - start;
  if (span === 0) {
    const point = layout.samples[start];
    return { input: [0, 1], x: [point.x, point.x], y: [point.y, point.y], angle: [0, 0] };
  }
  const count = Math.max(2, Math.min(Math.floor(maxPoints), span + 1));
  const indices = Array.from({ length: count }, (_, k) => start + Math.round(span * k / (count - 1)));
  const total = layout.lengths[end] - layout.lengths[start];
  const points = indices.map(index => layout.samples[index]);
  return {
    input: indices.map(index => (layout.lengths[index] - layout.lengths[start]) / total),
    x: points.map(point => point.x),
    y: points.map(point => point.y),
    angle: points.map((_, k) => {
      const before = points[Math.max(0, k - 1)];
      const after = points[Math.min(points.length - 1, k + 1)];
      return Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
    }),
  };
}

/** Width of the mini-map window and how far it can travel along the track. */
export function scrubberWindow(canvasWidth: number, viewportWidth: number, trackWidth: number) {
  const ratio = canvasWidth > 0 ? Math.min(1, viewportWidth / canvasWidth) : 1;
  const width = clamp(trackWidth * ratio, Math.min(MIN_WINDOW, trackWidth), trackWidth);
  return { width, travel: trackWidth - width };
}

/** Scroll offset that centres the mini-map window on a tap at `trackX`. */
export function scrubberOffset(trackX: number, trackWidth: number, canvasWidth: number, viewportWidth: number) {
  const { width, travel } = scrubberWindow(canvasWidth, viewportWidth, trackWidth);
  const maxScroll = Math.max(0, canvasWidth - viewportWidth);
  return travel > 0 ? clamp((trackX - width / 2) / travel, 0, 1) * maxScroll : 0;
}
