import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRoadmapLayout, createRoadmapStages, labelSize, MARKER_SIZE, MAX_FONT_SCALE, MIN_HIT_SIZE, pathWindow, ROAD_WIDTH,
  roadmapViewportHeight, roadSegments, scrollOffsetFor, scrubberOffset, scrubberWindow,
} from '../src/core/roadmap.ts';

const levels = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
const lessons = [
  { id: 'first', level: 'beginner' }, { id: 'second', level: 'beginner' },
  { id: 'third', level: 'intermediate' }, { id: 'fourth', level: 'expert' },
];
const snapshot = (level, placementComplete, completedLessonIds = []) => ({ profile: { level, placementComplete, completedLessonIds }, stats: {} });

const widths = [320, 375, 390, 430];
const fontScales = [1, 1.6];
const eachLayout = (check) => {
  for (const width of widths) for (const fontScale of fontScales) {
    const viewport = { width, height: roadmapViewportHeight(fontScale) };
    check(createRoadmapLayout(5, viewport, fontScale), viewport, `width ${width}, fontScale ${fontScale}`);
  }
};
const inside = (box, canvas) => box.left >= 0 && box.top >= 0 && box.left + box.width <= canvas.width && box.top + box.height <= canvas.height;
const apart = (a, b) => a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top;
const distanceToBox = (point, box) => Math.hypot(
  Math.max(box.left - point.x, 0, point.x - (box.left + box.width)),
  Math.max(box.top - point.y, 0, point.y - (box.top + box.height)),
);

test('placement unlocks reached levels without inventing completed lessons', () => {
  const stages = createRoadmapStages(snapshot('advanced', true, ['first', 'first', 'unknown']), lessons, levels);
  assert.deepEqual(stages.map(stage => stage.state), ['reached', 'reached', 'current', 'locked', 'locked']);
  assert.equal(stages[0].completedLessons, 1);
  assert.equal(stages[0].totalLessons, 2);
  assert.equal(stages[1].completedLessons, 0);
  assert.equal(stages[4].totalLessons, 0);
});

test('unplaced profiles preview stages without claiming levels were reached', () => {
  const stages = createRoadmapStages(snapshot('beginner', false), lessons, levels);
  assert.deepEqual(stages.map(stage => stage.state), ['placement', 'locked', 'locked', 'locked', 'locked']);
});

test('canvas is at least as wide as the viewport and exactly as tall', () => {
  eachLayout((layout, viewport, where) => {
    assert.ok(layout.canvas.width >= viewport.width, where);
    assert.equal(layout.canvas.height, viewport.height, where);
  });
  const narrow = createRoadmapLayout(1, { width: 430, height: 320 }, 1);
  assert.equal(narrow.canvas.width, 430);
  assert.equal(narrow.maxScroll, 0);
  assert.equal(narrow.stops[0].point.x, 215);
  assert.equal(narrow.stops[0].offset, 0);
});

test('a viewport shorter than the cards need still gets a canvas that holds them', () => {
  const layout = createRoadmapLayout(5, { width: 375, height: 200 }, 1.6);
  assert.equal(layout.canvas.height, roadmapViewportHeight(1.6));
  for (const stop of layout.stops) assert.ok(inside(stop.hit, layout.canvas));
});

test('stops and label cards stay inside the canvas at every width and text scale', () => {
  eachLayout((layout, _viewport, where) => {
    assert.equal(layout.stops.length, 5, where);
    for (const stop of layout.stops) {
      assert.ok(inside(stop.marker, layout.canvas), `${where}: marker ${stop.index}`);
      assert.ok(inside(stop.label, layout.canvas), `${where}: label ${stop.index}`);
      assert.ok(inside(stop.hit, layout.canvas), `${where}: hit box ${stop.index}`);
    }
  });
});

test('label cards never overlap each other or any marker', () => {
  eachLayout((layout, _viewport, where) => {
    for (const a of layout.stops) {
      for (const b of layout.stops) {
        if (a.index < b.index) assert.ok(apart(a.label, b.label), `${where}: labels ${a.index} and ${b.index}`);
        assert.ok(apart(a.label, b.marker), `${where}: label ${a.index} and marker ${b.index}`);
        if (a.index < b.index) assert.ok(apart(a.marker, b.marker), `${where}: markers ${a.index} and ${b.index}`);
      }
    }
  });
});

test('label text boxes grow with the text scale so larger type is never clipped', () => {
  const small = labelSize(1);
  const large = labelSize(1.6);
  assert.ok(large.width > small.width && large.height > small.height);
  assert.deepEqual(labelSize(9), labelSize(MAX_FONT_SCALE));
  assert.deepEqual(labelSize(Number.NaN), small);
});

test('stops alternate between an upper and a lower band with the card on the road side', () => {
  eachLayout((layout, _viewport, where) => {
    layout.stops.forEach((stop, index) => {
      assert.equal(stop.band, index % 2 === 0 ? 'upper' : 'lower', where);
      if (stop.band === 'upper') {
        assert.ok(stop.label.top > stop.marker.top + stop.marker.height, `${where}: card below upper stop ${index}`);
      } else {
        assert.ok(stop.label.top + stop.label.height < stop.marker.top, `${where}: card above lower stop ${index}`);
      }
      if (index > 0) {
        assert.ok(stop.point.x > layout.stops[index - 1].point.x, where);
        assert.notEqual(stop.point.y, layout.stops[index - 1].point.y, where);
      }
    });
  });
});

test('markers are at least 56pt and every tap target is at least 44pt', () => {
  eachLayout((layout, _viewport, where) => {
    for (const stop of layout.stops) {
      assert.ok(stop.marker.width >= MARKER_SIZE && stop.marker.height >= MARKER_SIZE, where);
      assert.ok(stop.hit.width >= MIN_HIT_SIZE && stop.hit.height >= MIN_HIT_SIZE, where);
      assert.ok(stop.hit.left <= stop.marker.left && stop.hit.top <= stop.marker.top, where);
      assert.ok(stop.hit.left + stop.hit.width >= stop.marker.left + stop.marker.width, where);
      assert.ok(stop.hit.top + stop.hit.height >= stop.marker.top + stop.marker.height, where);
    }
  });
});

test('centreline samples strictly increase in x and never sit further apart than the step', () => {
  eachLayout((layout, _viewport, where) => {
    assert.ok(layout.samples.length > layout.stops.length, where);
    for (let i = 1; i < layout.samples.length; i++) {
      const a = layout.samples[i - 1];
      const b = layout.samples[i];
      assert.ok(b.x > a.x, `${where}: x at sample ${i}`);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= layout.step + 1e-9, `${where}: gap at sample ${i}`);
    }
    for (const sample of layout.samples) {
      assert.ok(sample.x >= 0 && sample.x <= layout.canvas.width && sample.y >= 0 && sample.y <= layout.canvas.height, where);
    }
  });
});

test('cumulative length starts at zero, increases, and matches the chords', () => {
  eachLayout((layout, _viewport, where) => {
    assert.equal(layout.lengths.length, layout.samples.length, where);
    assert.equal(layout.lengths[0], 0, where);
    let travelled = 0;
    for (let i = 1; i < layout.lengths.length; i++) {
      assert.ok(layout.lengths[i] > layout.lengths[i - 1], `${where}: length at sample ${i}`);
      travelled += Math.hypot(layout.samples[i].x - layout.samples[i - 1].x, layout.samples[i].y - layout.samples[i - 1].y);
      assert.ok(Math.abs(layout.lengths[i] - travelled) < 1e-6, where);
    }
  });
});

test('each stop sits exactly on the road and the stop sample indices are in order', () => {
  eachLayout((layout, _viewport, where) => {
    assert.deepEqual(layout.stopSamples, layout.stops.map(stop => stop.sample), where);
    assert.equal(layout.stopSamples[0], 0, where);
    assert.equal(layout.stopSamples[layout.stopSamples.length - 1], layout.samples.length - 1, where);
    layout.stopSamples.forEach((sample, index) => {
      if (index > 0) assert.ok(sample > layout.stopSamples[index - 1], where);
      assert.deepEqual(layout.samples[sample], layout.stops[index].point, `${where}: stop ${index}`);
    });
  });
});

test('the road keeps clear of every label card', () => {
  eachLayout((layout, _viewport, where) => {
    for (const sample of layout.samples) {
      for (const stop of layout.stops) {
        assert.ok(distanceToBox(sample, stop.label) >= ROAD_WIDTH / 2, `${where}: road touches card ${stop.index} at ${sample.x.toFixed(1)}, ${sample.y.toFixed(1)}`);
      }
    }
  });
});

test('centring offsets are clamped to the scrollable range at both ends', () => {
  eachLayout((layout, viewport, where) => {
    assert.equal(layout.maxScroll, layout.canvas.width - viewport.width, where);
    for (const stop of layout.stops) {
      assert.ok(stop.offset >= 0 && stop.offset <= layout.maxScroll, `${where}: offset ${stop.index}`);
      const centred = stop.point.x - viewport.width / 2;
      if (centred > 0 && centred < layout.maxScroll) assert.equal(stop.offset, centred, where);
    }
    assert.equal(layout.stops[0].offset, 0, `${where}: the first stop is pinned to the start`);
    assert.equal(layout.stops[4].offset, layout.maxScroll, `${where}: the last stop is pinned to the end`);
  });
  assert.equal(scrollOffsetFor(10, 1000, 300), 0);
  assert.equal(scrollOffsetFor(990, 1000, 300), 700);
  assert.equal(scrollOffsetFor(500, 1000, 300), 350);
  assert.equal(scrollOffsetFor(500, 200, 300), 0);
});

test('road segments follow the chords between samples', () => {
  const layout = createRoadmapLayout(5, { width: 375, height: 320 }, 1);
  const segments = roadSegments(layout);
  assert.equal(segments.length, layout.samples.length - 1);
  segments.forEach((segment, i) => {
    const a = layout.samples[i];
    const b = layout.samples[i + 1];
    assert.ok(Math.abs(segment.length - Math.hypot(b.x - a.x, b.y - a.y)) < 1e-9);
    assert.ok(Math.abs(segment.x - (a.x + b.x) / 2) < 1e-9 && Math.abs(segment.y - (a.y + b.y) / 2) < 1e-9);
    assert.ok(segment.angle > -Math.PI / 2 && segment.angle < Math.PI / 2, 'x always advances, so the road never turns back');
  });
});

test('path windows run from the first to the last sample by distance', () => {
  const layout = createRoadmapLayout(5, { width: 375, height: 320 }, 1);
  const from = layout.stopSamples[1];
  const to = layout.stopSamples[2];
  const path = pathWindow(layout, from, to, 24);
  assert.equal(path.input.length, 24);
  assert.equal(path.input[0], 0);
  assert.equal(path.input[path.input.length - 1], 1);
  for (let i = 1; i < path.input.length; i++) assert.ok(path.input[i] > path.input[i - 1]);
  assert.deepEqual({ x: path.x[0], y: path.y[0] }, layout.stops[1].point);
  assert.deepEqual({ x: path.x[23], y: path.y[23] }, layout.stops[2].point);
  assert.equal(path.angle.length, 24);
  assert.ok(path.angle.every(angle => angle > -90 && angle < 90));
  const short = pathWindow(layout, 0, 3, 24);
  assert.equal(short.input.length, 4, 'never more points than samples');
  const still = pathWindow(layout, 5, 5, 24);
  assert.deepEqual(still.input, [0, 1]);
  assert.deepEqual(pathWindow(layout, to, from, 24), path, 'order of the ends does not matter');
});

test('mini-map window tracks the scroll range and taps centre it', () => {
  const { width, travel } = scrubberWindow(1300, 333, 305);
  assert.ok(Math.abs(width - 305 * 333 / 1300) < 1e-9);
  assert.ok(Math.abs(width + travel - 305) < 1e-9);
  assert.equal(scrubberWindow(300, 333, 305).travel, 0);
  assert.ok(scrubberWindow(100000, 333, 305).width >= 28);
  assert.equal(scrubberOffset(0, 305, 1300, 333), 0);
  assert.equal(scrubberOffset(305, 305, 1300, 333), 1300 - 333);
  const middle = scrubberOffset(152.5, 305, 1300, 333);
  assert.ok(Math.abs(middle - (1300 - 333) / 2) < 1e-9);
  assert.equal(scrubberOffset(50, 305, 300, 333), 0);
});
