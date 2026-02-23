const FEATURE_TIMES = [0, 0.2, 0.4, 0.6, 0.8, 1];
const FEATURE_BONES = [
  'hips',
  'spine',
  'chest',
  'head',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
];

export const LOWER_BODY_BONES = new Set([
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
]);

const KNOWN_EMOTIONS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'thinking',
  'relaxed',
  'bridge',
];

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function asRotation(frame) {
  return {
    x: isFiniteNumber(frame?.rotation?.x) ? frame.rotation.x : 0,
    y: isFiniteNumber(frame?.rotation?.y) ? frame.rotation.y : 0,
    z: isFiniteNumber(frame?.rotation?.z) ? frame.rotation.z : 0,
  };
}

function asPosition(frame) {
  return {
    x: isFiniteNumber(frame?.position?.x) ? frame.position.x : 0,
    y: isFiniteNumber(frame?.position?.y) ? frame.position.y : 0,
    z: isFiniteNumber(frame?.position?.z) ? frame.position.z : 0,
  };
}

function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

export function getPrimaryEmotionTag(emotionTags) {
  if (!Array.isArray(emotionTags)) return 'bridge';
  for (const tag of emotionTags) {
    if (KNOWN_EMOTIONS.includes(tag)) return tag;
  }
  return 'bridge';
}

export function buildFrameGroups(keyframes) {
  const groups = new Map();

  for (const frame of keyframes || []) {
    if (!frame || typeof frame !== 'object') continue;
    if (typeof frame.bone !== 'string') continue;
    if (!groups.has(frame.bone)) {
      groups.set(frame.bone, []);
    }
    groups.get(frame.bone).push(frame);
  }

  for (const frames of groups.values()) {
    frames.sort((a, b) => {
      const ta = isFiniteNumber(a.time) ? a.time : 0;
      const tb = isFiniteNumber(b.time) ? b.time : 0;
      return ta - tb;
    });
  }

  return groups;
}

function sampleFrame(frames, time) {
  if (!frames || frames.length === 0) {
    return {
      rotation: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
    };
  }

  let prev = frames[0];
  let next = frames[frames.length - 1];

  for (const frame of frames) {
    const frameTime = clamp01(isFiniteNumber(frame.time) ? frame.time : 0);

    if (frameTime <= time) prev = frame;
    if (frameTime >= time) {
      next = frame;
      break;
    }
  }

  const prevTime = clamp01(isFiniteNumber(prev.time) ? prev.time : 0);
  const nextTime = clamp01(isFiniteNumber(next.time) ? next.time : 0);
  const alpha = nextTime <= prevTime
    ? 0
    : clamp01((time - prevTime) / (nextTime - prevTime));

  const prevRotation = asRotation(prev);
  const nextRotation = asRotation(next);
  const prevPosition = asPosition(prev);
  const nextPosition = asPosition(next);

  return {
    rotation: {
      x: lerp(prevRotation.x, nextRotation.x, alpha),
      y: lerp(prevRotation.y, nextRotation.y, alpha),
      z: lerp(prevRotation.z, nextRotation.z, alpha),
    },
    position: {
      x: lerp(prevPosition.x, nextPosition.x, alpha),
      y: lerp(prevPosition.y, nextPosition.y, alpha),
      z: lerp(prevPosition.z, nextPosition.z, alpha),
    },
  };
}

export function buildFeatureVector(clipData) {
  const groups = buildFrameGroups(clipData?.keyframes || []);
  const vector = [];

  for (const bone of FEATURE_BONES) {
    const frames = groups.get(bone) || [];
    const previousSamples = [];

    for (const time of FEATURE_TIMES) {
      const sample = sampleFrame(frames, time);
      vector.push(sample.rotation.x, sample.rotation.y, sample.rotation.z);

      if (bone === 'hips') {
        vector.push(sample.position.x, sample.position.y, sample.position.z);
      }

      previousSamples.push(sample);
    }

    for (let i = 1; i < previousSamples.length; i += 1) {
      const prev = previousSamples[i - 1];
      const curr = previousSamples[i];
      vector.push(
        curr.rotation.x - prev.rotation.x,
        curr.rotation.y - prev.rotation.y,
        curr.rotation.z - prev.rotation.z
      );

      if (bone === 'hips') {
        vector.push(
          curr.position.x - prev.position.x,
          curr.position.y - prev.position.y,
          curr.position.z - prev.position.z
        );
      }
    }
  }

  return vector;
}

export function normalizedDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }

  return Math.sqrt(sum / a.length);
}

export function hasLowerBodyMotion(clipData) {
  const frames = Array.isArray(clipData?.keyframes) ? clipData.keyframes : [];
  return frames.some((frame) => LOWER_BODY_BONES.has(frame.bone));
}

export function computeDiversityMetrics(records) {
  const prepared = [];

  for (const record of records || []) {
    const clip = record?.clip;
    const data = record?.data ?? record?.clipData;
    if (!clip || !data) continue;

    prepared.push({
      id: clip.id,
      emotion: getPrimaryEmotionTag(clip.emotion_tags),
      feature: buildFeatureVector(data),
      hasLowerBody: hasLowerBodyMotion(data),
    });
  }

  const byEmotion = Object.fromEntries(
    KNOWN_EMOTIONS.map((emotion) => [emotion, []])
  );

  for (const item of prepared) {
    byEmotion[item.emotion] ??= [];
    byEmotion[item.emotion].push(item);
  }

  const totalWithLowerBody = prepared.filter((item) => item.hasLowerBody).length;

  const summaryByEmotion = {};

  for (const [emotion, items] of Object.entries(byEmotion)) {
    const withLowerBody = items.filter((item) => item.hasLowerBody).length;
    const nearestByClip = [];

    for (const clip of items) {
      let nearestDistance = Infinity;
      let nearestId = '';

      for (const other of items) {
        if (other.id === clip.id) continue;
        const distance = normalizedDistance(clip.feature, other.feature);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestId = other.id;
        }
      }

      nearestByClip.push({
        id: clip.id,
        nearest_id: nearestId,
        nearest_distance: Number.isFinite(nearestDistance) ? nearestDistance : Infinity,
      });
    }

    const finiteDistances = nearestByClip
      .map((entry) => entry.nearest_distance)
      .filter((value) => Number.isFinite(value));

    const avgNearestDistance = finiteDistances.length > 0
      ? finiteDistances.reduce((sum, value) => sum + value, 0) / finiteDistances.length
      : Infinity;

    const minNearestDistance = finiteDistances.length > 0
      ? Math.min(...finiteDistances)
      : Infinity;

    const maxNearestDistance = finiteDistances.length > 0
      ? Math.max(...finiteDistances)
      : 0;

    summaryByEmotion[emotion] = {
      total: items.length,
      with_lower_body: withLowerBody,
      lower_body_ratio: items.length > 0 ? withLowerBody / items.length : 0,
      avg_nearest_distance: avgNearestDistance,
      min_nearest_distance: minNearestDistance,
      max_nearest_distance: maxNearestDistance,
      nearest_by_clip: nearestByClip,
    };
  }

  return {
    total_clips: prepared.length,
    global_lower_body_ratio: prepared.length > 0 ? totalWithLowerBody / prepared.length : 0,
    by_emotion: summaryByEmotion,
  };
}

export const DIVERSITY_POLICY = {
  minGlobalLowerBodyRatio: 0.62,
  minLowerBodyRatioByEmotion: {
    neutral: 0.5,
    happy: 0.7,
    sad: 0.5,
    angry: 0.7,
    surprised: 0.7,
    thinking: 0.5,
    relaxed: 0.5,
    bridge: 0.45,
  },
  minAvgNearestDistanceByEmotion: {
    neutral: 0.014,
    happy: 0.02,
    sad: 0.014,
    angry: 0.018,
    surprised: 0.02,
    thinking: 0.016,
    relaxed: 0.014,
    bridge: 0.01,
  },
  minSingleNearestDistanceByEmotion: {
    neutral: 0.007,
    happy: 0.009,
    sad: 0.007,
    angry: 0.009,
    surprised: 0.009,
    thinking: 0.008,
    relaxed: 0.007,
    bridge: 0.005,
  },
};

export function evaluateDiversityMetrics(metrics, policy = DIVERSITY_POLICY) {
  const issues = [];

  if (!metrics || typeof metrics !== 'object') {
    return ['diversity metrics are unavailable'];
  }

  if (metrics.global_lower_body_ratio < policy.minGlobalLowerBodyRatio) {
    issues.push(
      `lower-body ratio below global threshold (${metrics.global_lower_body_ratio.toFixed(3)} < ${policy.minGlobalLowerBodyRatio.toFixed(3)})`
    );
  }

  for (const emotion of KNOWN_EMOTIONS) {
    const summary = metrics.by_emotion?.[emotion];
    if (!summary || summary.total === 0) {
      issues.push(`${emotion}: no clips available for diversity checks`);
      continue;
    }

    const lowerBodyThreshold = policy.minLowerBodyRatioByEmotion[emotion];
    if (summary.lower_body_ratio < lowerBodyThreshold) {
      issues.push(
        `${emotion}: lower-body ratio below threshold (${summary.lower_body_ratio.toFixed(3)} < ${lowerBodyThreshold.toFixed(3)})`
      );
    }

    if (summary.total < 2) {
      issues.push(`${emotion}: need at least 2 clips for nearest-distance diversity checks`);
      continue;
    }

    const avgThreshold = policy.minAvgNearestDistanceByEmotion[emotion];
    if (summary.avg_nearest_distance < avgThreshold) {
      issues.push(
        `${emotion}: avg nearest distance too small (${summary.avg_nearest_distance.toFixed(4)} < ${avgThreshold.toFixed(4)})`
      );
    }

    const minThreshold = policy.minSingleNearestDistanceByEmotion[emotion];
    if (summary.min_nearest_distance < minThreshold) {
      const tooClose = summary.nearest_by_clip
        .filter((entry) => entry.nearest_distance < minThreshold)
        .sort((a, b) => a.nearest_distance - b.nearest_distance)
        .slice(0, 3)
        .map((entry) => `${entry.id}~${entry.nearest_id}:${entry.nearest_distance.toFixed(4)}`)
        .join(', ');

      issues.push(
        `${emotion}: near-duplicate clips detected (min ${summary.min_nearest_distance.toFixed(4)} < ${minThreshold.toFixed(4)}; ${tooClose})`
      );
    }
  }

  return issues;
}
