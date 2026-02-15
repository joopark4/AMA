#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed', 'thinking'];
const PROFILE_KEYS = [
  'movementSpeedMultiplier',
  'hopImpulse',
  'quickStepDistance',
  'expressionIntensity',
  'expressionHoldMs',
  'autoMoveDelayMultiplier',
];

const DEFAULT_CONFIG = {
  global: {
    responseClearMs: 5200,
    happyDanceMs: 3400,
    idleNeutralDelayMs: 3200,
  },
  emotions: {
    neutral: {
      movementSpeedMultiplier: 1.0,
      hopImpulse: 0,
      quickStepDistance: 120,
      expressionIntensity: 0.52,
      expressionHoldMs: 2200,
      autoMoveDelayMultiplier: 1.0,
    },
    happy: {
      movementSpeedMultiplier: 1.28,
      hopImpulse: 780,
      quickStepDistance: 150,
      expressionIntensity: 0.92,
      expressionHoldMs: 3000,
      autoMoveDelayMultiplier: 0.84,
    },
    sad: {
      movementSpeedMultiplier: 0.68,
      hopImpulse: 0,
      quickStepDistance: 90,
      expressionIntensity: 0.78,
      expressionHoldMs: 4300,
      autoMoveDelayMultiplier: 1.36,
    },
    angry: {
      movementSpeedMultiplier: 1.2,
      hopImpulse: 0,
      quickStepDistance: 240,
      expressionIntensity: 0.88,
      expressionHoldMs: 2600,
      autoMoveDelayMultiplier: 0.88,
    },
    surprised: {
      movementSpeedMultiplier: 1.36,
      hopImpulse: 920,
      quickStepDistance: 170,
      expressionIntensity: 1.0,
      expressionHoldMs: 2100,
      autoMoveDelayMultiplier: 0.78,
    },
    relaxed: {
      movementSpeedMultiplier: 0.87,
      hopImpulse: 0,
      quickStepDistance: 100,
      expressionIntensity: 0.62,
      expressionHoldMs: 3200,
      autoMoveDelayMultiplier: 1.2,
    },
    thinking: {
      movementSpeedMultiplier: 0.82,
      hopImpulse: 0,
      quickStepDistance: 110,
      expressionIntensity: 0.58,
      expressionHoldMs: 3600,
      autoMoveDelayMultiplier: 1.08,
    },
  },
};

const TARGETS = {
  global: {
    responseClearMs: 5000,
    happyDanceMs: 3400,
    idleNeutralDelayMs: 3000,
  },
  emotions: {
    neutral: {
      movementSpeedMultiplier: 1.0,
      hopImpulse: 0,
      quickStepDistance: 110,
      expressionIntensity: 0.5,
      expressionHoldMs: 2200,
      autoMoveDelayMultiplier: 1.0,
    },
    happy: {
      movementSpeedMultiplier: 1.3,
      hopImpulse: 820,
      quickStepDistance: 160,
      expressionIntensity: 0.95,
      expressionHoldMs: 3200,
      autoMoveDelayMultiplier: 0.82,
    },
    sad: {
      movementSpeedMultiplier: 0.65,
      hopImpulse: 0,
      quickStepDistance: 85,
      expressionIntensity: 0.8,
      expressionHoldMs: 4500,
      autoMoveDelayMultiplier: 1.45,
    },
    angry: {
      movementSpeedMultiplier: 1.22,
      hopImpulse: 0,
      quickStepDistance: 250,
      expressionIntensity: 0.9,
      expressionHoldMs: 2500,
      autoMoveDelayMultiplier: 0.86,
    },
    surprised: {
      movementSpeedMultiplier: 1.38,
      hopImpulse: 960,
      quickStepDistance: 180,
      expressionIntensity: 1.0,
      expressionHoldMs: 2000,
      autoMoveDelayMultiplier: 0.76,
    },
    relaxed: {
      movementSpeedMultiplier: 0.85,
      hopImpulse: 0,
      quickStepDistance: 95,
      expressionIntensity: 0.6,
      expressionHoldMs: 3400,
      autoMoveDelayMultiplier: 1.25,
    },
    thinking: {
      movementSpeedMultiplier: 0.8,
      hopImpulse: 0,
      quickStepDistance: 110,
      expressionIntensity: 0.56,
      expressionHoldMs: 3700,
      autoMoveDelayMultiplier: 1.12,
    },
  },
};

const BOUNDS = {
  movementSpeedMultiplier: [0.5, 1.6],
  hopImpulse: [0, 1100],
  quickStepDistance: [60, 320],
  expressionIntensity: [0.2, 1.0],
  expressionHoldMs: [1200, 7000],
  autoMoveDelayMultiplier: [0.6, 1.8],
  responseClearMs: [2500, 12000],
  happyDanceMs: [1200, 10000],
  idleNeutralDelayMs: [1200, 10000],
};

const STEP = {
  movementSpeedMultiplier: 0.06,
  hopImpulse: 80,
  quickStepDistance: 16,
  expressionIntensity: 0.04,
  expressionHoldMs: 220,
  autoMoveDelayMultiplier: 0.05,
  responseClearMs: 220,
  happyDanceMs: 180,
  idleNeutralDelayMs: 180,
};

const RANGE = {
  movementSpeedMultiplier: 1.1,
  hopImpulse: 1100,
  quickStepDistance: 260,
  expressionIntensity: 0.8,
  expressionHoldMs: 5800,
  autoMoveDelayMultiplier: 1.2,
  responseClearMs: 9500,
  happyDanceMs: 8800,
  idleNeutralDelayMs: 8800,
};

function parseArgs(argv) {
  const args = {
    hours: 5,
    iterations: null,
    seed: Date.now() % 2147483647,
    write: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--hours' && argv[i + 1]) {
      args.hours = Number(argv[++i]);
      continue;
    }
    if (token === '--iterations' && argv[i + 1]) {
      args.iterations = Number(argv[++i]);
      continue;
    }
    if (token === '--seed' && argv[i + 1]) {
      args.seed = Number(argv[++i]);
      continue;
    }
    if (token === '--dry-run') {
      args.write = false;
      continue;
    }
  }

  if (!Number.isFinite(args.hours) || args.hours <= 0) args.hours = 5;
  if (!Number.isFinite(args.seed)) args.seed = 42;
  if (args.iterations !== null && (!Number.isFinite(args.iterations) || args.iterations <= 0)) {
    args.iterations = null;
  }

  return args;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadInitialConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return deepClone(DEFAULT_CONFIG);
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (raw && raw.global && raw.emotions) {
      return {
        global: { ...DEFAULT_CONFIG.global, ...raw.global },
        emotions: {
          ...deepClone(DEFAULT_CONFIG.emotions),
          ...raw.emotions,
        },
      };
    }
  } catch (_error) {
  }

  return deepClone(DEFAULT_CONFIG);
}

function mutateProfileValue(value, key, rng, temperature) {
  const [min, max] = BOUNDS[key];
  const delta = (rng() * 2 - 1) * STEP[key] * (0.35 + temperature);
  return clamp(value + delta, min, max);
}

function mutateConfig(base, rng, temperature) {
  const candidate = deepClone(base);
  const selectedEmotion = EMOTIONS[Math.floor(rng() * EMOTIONS.length)];
  const mutationCount = rng() < 0.2 ? 2 : 1;

  for (let i = 0; i < mutationCount; i++) {
    const key = PROFILE_KEYS[Math.floor(rng() * PROFILE_KEYS.length)];
    const value = candidate.emotions[selectedEmotion][key];
    candidate.emotions[selectedEmotion][key] = mutateProfileValue(value, key, rng, temperature);
  }

  if (rng() < 0.15) {
    const globalKey = ['responseClearMs', 'happyDanceMs', 'idleNeutralDelayMs'][Math.floor(rng() * 3)];
    const value = candidate.global[globalKey];
    candidate.global[globalKey] = mutateProfileValue(value, globalKey, rng, temperature);
  }

  return candidate;
}

function normalizedSquaredDiff(actual, target, key) {
  const diff = (actual - target) / RANGE[key];
  return diff * diff;
}

function evaluate(config) {
  let score = 0;
  const profileWeights = {
    movementSpeedMultiplier: 3.5,
    hopImpulse: 2.0,
    quickStepDistance: 2.0,
    expressionIntensity: 3.2,
    expressionHoldMs: 2.4,
    autoMoveDelayMultiplier: 2.8,
  };
  const globalWeights = {
    responseClearMs: 1.5,
    happyDanceMs: 1.0,
    idleNeutralDelayMs: 1.0,
  };

  for (const emotion of EMOTIONS) {
    const current = config.emotions[emotion];
    const target = TARGETS.emotions[emotion];

    for (const key of PROFILE_KEYS) {
      score += profileWeights[key] * normalizedSquaredDiff(current[key], target[key], key);
    }

    if (emotion !== 'happy' && emotion !== 'surprised' && current.hopImpulse > 180) {
      score += Math.pow((current.hopImpulse - 180) / 300, 2);
    }

    if (emotion === 'sad' && current.movementSpeedMultiplier > 0.85) {
      score += Math.pow((current.movementSpeedMultiplier - 0.85) / 0.2, 2);
    }

    if (emotion === 'angry' && current.quickStepDistance < 180) {
      score += Math.pow((180 - current.quickStepDistance) / 100, 2);
    }
  }

  const arousalPath = ['sad', 'relaxed', 'neutral', 'thinking', 'happy', 'angry', 'surprised'];
  for (let i = 0; i < arousalPath.length - 1; i++) {
    const left = config.emotions[arousalPath[i]];
    const right = config.emotions[arousalPath[i + 1]];
    const leftArousal = left.expressionIntensity + left.movementSpeedMultiplier * 0.4;
    const rightArousal = right.expressionIntensity + right.movementSpeedMultiplier * 0.4;
    if (rightArousal + 0.05 < leftArousal) {
      score += Math.pow(leftArousal - rightArousal, 2) * 2;
    }
  }

  const responseClearMs = config.global.responseClearMs;
  const happyDanceMs = config.global.happyDanceMs;
  const idleNeutralDelayMs = config.global.idleNeutralDelayMs;

  score += globalWeights.responseClearMs * normalizedSquaredDiff(
    responseClearMs,
    TARGETS.global.responseClearMs,
    'responseClearMs'
  );
  score += globalWeights.happyDanceMs * normalizedSquaredDiff(
    happyDanceMs,
    TARGETS.global.happyDanceMs,
    'happyDanceMs'
  );
  score += globalWeights.idleNeutralDelayMs * normalizedSquaredDiff(
    idleNeutralDelayMs,
    TARGETS.global.idleNeutralDelayMs,
    'idleNeutralDelayMs'
  );

  if (happyDanceMs > responseClearMs) {
    score += Math.pow((happyDanceMs - responseClearMs) / 1200, 2);
  }

  return score;
}

function roundConfig(config) {
  const rounded = deepClone(config);

  for (const emotion of EMOTIONS) {
    const profile = rounded.emotions[emotion];
    profile.movementSpeedMultiplier = Number(profile.movementSpeedMultiplier.toFixed(3));
    profile.hopImpulse = Math.round(profile.hopImpulse);
    profile.quickStepDistance = Math.round(profile.quickStepDistance);
    profile.expressionIntensity = Number(profile.expressionIntensity.toFixed(3));
    profile.expressionHoldMs = Math.round(profile.expressionHoldMs);
    profile.autoMoveDelayMultiplier = Number(profile.autoMoveDelayMultiplier.toFixed(3));
  }

  rounded.global.responseClearMs = Math.round(rounded.global.responseClearMs);
  rounded.global.happyDanceMs = Math.round(rounded.global.happyDanceMs);
  rounded.global.idleNeutralDelayMs = Math.round(rounded.global.idleNeutralDelayMs);

  return rounded;
}

function printSummary(before, after, scoreBefore, scoreAfter, hours, iterations, seed, filePath) {
  const improvePct = scoreBefore > 0
    ? ((scoreBefore - scoreAfter) / scoreBefore) * 100
    : 0;

  console.log(`Emotion tuning completed:`);
  console.log(`- virtual_hours: ${hours}`);
  console.log(`- iterations: ${iterations}`);
  console.log(`- seed: ${seed}`);
  console.log(`- score_before: ${scoreBefore.toFixed(6)}`);
  console.log(`- score_after: ${scoreAfter.toFixed(6)}`);
  console.log(`- improvement: ${improvePct.toFixed(2)}%`);
  console.log(`- output: ${filePath}`);

  const keyEmotions = ['happy', 'sad', 'angry', 'surprised'];
  for (const emotion of keyEmotions) {
    const b = before.emotions[emotion];
    const a = after.emotions[emotion];
    console.log(
      `  ${emotion}: speed ${b.movementSpeedMultiplier.toFixed(2)} -> ${a.movementSpeedMultiplier.toFixed(2)},` +
      ` expr ${b.expressionIntensity.toFixed(2)} -> ${a.expressionIntensity.toFixed(2)},` +
      ` hold ${Math.round(b.expressionHoldMs)} -> ${Math.round(a.expressionHoldMs)}`
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const iterations = args.iterations ?? Math.max(1200, Math.round(args.hours * 720));
  const cooling = Math.pow(0.02, 1 / Math.max(1, iterations));
  const rng = mulberry32(args.seed);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, '..');
  const outputPath = path.join(projectRoot, 'src/config/emotionTuning.generated.json');

  let current = loadInitialConfig(outputPath);
  let currentScore = evaluate(current);
  const initialConfig = deepClone(current);
  const initialScore = currentScore;
  let best = deepClone(current);
  let bestScore = currentScore;

  let temperature = 1.0;
  const progressStep = Math.max(1, Math.floor(iterations / 10));

  for (let i = 0; i < iterations; i++) {
    const candidate = mutateConfig(current, rng, temperature);
    const candidateScore = evaluate(candidate);
    const delta = candidateScore - currentScore;

    const accept = delta < 0 || Math.exp(-delta / Math.max(temperature, 0.0001)) > rng();
    if (accept) {
      current = candidate;
      currentScore = candidateScore;
      if (candidateScore < bestScore) {
        best = deepClone(candidate);
        bestScore = candidateScore;
      }
    }

    temperature *= cooling;

    if ((i + 1) % progressStep === 0) {
      const pct = (((i + 1) / iterations) * 100).toFixed(0);
      console.log(`progress ${pct}% | best_score=${bestScore.toFixed(6)}`);
    }
  }

  const result = roundConfig(best);
  result.meta = {
    generatedAt: new Date().toISOString(),
    optimizer: 'simulated-annealing',
    hours: args.hours,
    iterations,
    seed: args.seed,
    score: Number(bestScore.toFixed(6)),
  };

  if (args.write) {
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }

  printSummary(
    initialConfig,
    result,
    initialScore,
    bestScore,
    args.hours,
    iterations,
    args.seed,
    outputPath
  );
}

main();
