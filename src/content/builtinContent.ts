// Built-in content for Loop Lab, copied from Appendix A of the approved build prompt.
// This is the ONLY place built-in drills, sessions and programs are defined.
// Items refer to each other by `builtInKey`; real ids are created when the content is seeded (see seed.ts).
//
// To change built-in content later: edit this file AND increase CONTENT_VERSION.
// Items Joe has edited (modifiedByUser = true) are never overwritten by an update.

import type { Benchmark, DrillSource, MetricType, SessionKind } from '../db/types'

/** Increase whenever anything in this file changes. */
export const CONTENT_VERSION = 1

// ---------------------------------------------------------------------------
// A.1 Categories
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'Loop from Backspin',
  'Push-to-Attack Transition',
  'Pressure and Match Simulation',
  'Serve, Receive and Third Ball',
  'Counter-Attack and Block',
  'Footwork and Conditioning',
  'All-Round Maintenance',
] as const

export type CategoryName = (typeof CATEGORIES)[number]

const LOOP: CategoryName = 'Loop from Backspin'
const PUSH: CategoryName = 'Push-to-Attack Transition'
const PRESSURE: CategoryName = 'Pressure and Match Simulation'
const SERVE: CategoryName = 'Serve, Receive and Third Ball'
const COUNTER: CategoryName = 'Counter-Attack and Block'
const FOOTWORK: CategoryName = 'Footwork and Conditioning'
const MAINT: CategoryName = 'All-Round Maintenance'

// ---------------------------------------------------------------------------
// Types for built-in definitions
// ---------------------------------------------------------------------------

export interface BuiltinDrill {
  builtInKey: string
  name: string
  category: CategoryName
  description: string
  metricType: MetricType
  defaultAttempts?: number
  defaultDurationMin: number
  suggestedSettings: string
  cues: string
  benchmark?: Benchmark
  source: DrillSource
}

export interface BuiltinTemplateItem {
  drillKey: string
  durationMin: number
  note?: string
}

export interface BuiltinTemplate {
  builtInKey: string
  name: string
  kind: SessionKind
  items: BuiltinTemplateItem[]
}

export interface BuiltinSlot {
  label: string
  templateKey: string
  /** Benchmark overrides for specific drills in this slot, keyed by drill builtInKey. */
  benchmarkOverrides?: Record<string, { benchmark: Benchmark; note?: string }>
}

export interface BuiltinWeek {
  weekNumber: number
  title: string
  goal?: string
  sessions: BuiltinSlot[]
}

export interface BuiltinProgram {
  builtInKey: string
  name: string
  category: CategoryName
  description: string
  repeating: boolean
  cycleLengthWeeks?: number
  sessionsPerWeek: number
  weeks: BuiltinWeek[]
  /** Guidance cards: paragraphs separated by a blank line. */
  notes: string
}

// ---------------------------------------------------------------------------
// A.2 Drills
// ---------------------------------------------------------------------------

export const BUILTIN_DRILLS: BuiltinDrill[] = [
  // Original 12-week program (source: "original")
  {
    builtInKey: 'orig-A',
    name: 'Pure Repetition Loop',
    category: LOOP,
    description: 'Loop every ball to a single target zone on the table.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 15,
    suggestedSettings: 'Heavy backspin, medium speed, fixed to one zone (forehand first, then repeat on backhand).',
    cues: 'Let the ball drop to the ideal contact height; brush low-to-high; drive from the legs.',
    benchmark: {
      metricType: 'hits_attempts',
      threshold: 0.8,
      minAttempts: 10,
      consecutiveSessions: 1,
      description: '8/10. Aim to reach by the end of week 3.',
    },
    source: 'original',
  },
  {
    builtInKey: 'orig-B',
    name: 'Spin Calibration Blocks',
    category: LOOP,
    description:
      'Same target for every ball. Feel how much the racket angle must change for each spin level. This is the most important drill for consistency, because most inconsistency is a mistimed racket-angle guess, not a bad stroke.',
    metricType: 'hits_attempts',
    defaultAttempts: 30,
    defaultDurationMin: 15,
    suggestedSettings: 'Alternate blocks of 10: light, medium, heavy backspin, same zone. Log all 30 attempts as one drill.',
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-C',
    name: 'Push-Push-Loop Pattern',
    category: PUSH,
    description:
      'Push the first two, attack the third. Installs the physical habit of switching gears on a predictable pattern. A hit is a pattern where the third-ball attack lands.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 15,
    suggestedSettings:
      "Two pushes to you, then a slightly higher or shorter third ball (use the robot's sequence mode if it has one, otherwise vary manually).",
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-D',
    name: 'Loop Then Sustain',
    category: LOOP,
    description:
      'Opening loop off backspin, then continuous topspin-to-topspin rallying. A hit is a sequence where the opener lands and you sustain 5 or more topspin balls.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 20,
    suggestedSettings: 'Backspin feed; after your first loop the robot switches to topspin or block-speed feed for 3-5 balls.',
    cues: '',
    benchmark: { metricType: 'hits_attempts', threshold: 0.7, minAttempts: 10, consecutiveSessions: 1, description: '7/10 sequences.' },
    source: 'original',
  },
  {
    builtInKey: 'orig-E',
    name: 'Two-Zone Attack',
    category: LOOP,
    description:
      'Loop whichever zone is fed and recover position between shots. Adds footwork into consistency, which is where a lot of match inconsistency actually breaks down.',
    metricType: 'hits_attempts',
    defaultAttempts: 20,
    defaultDurationMin: 15,
    suggestedSettings: 'Heavy backspin, alternating between two target zones (for example wide forehand and middle).',
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-F',
    name: 'Footwork Ladder',
    category: FOOTWORK,
    description:
      'Pure recovery footwork between loops, so fatigue and positioning do not wreck backspin technique later. Rate recovery quality 1-5.',
    metricType: 'rating',
    defaultDurationMin: 10,
    suggestedSettings: 'Wide-angle oscillation, no-spin or light spin, moderate speed.',
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-G',
    name: 'Random Depth',
    category: PUSH,
    description:
      'Push short balls, attack long or high ones. This is the core drill for the "is this ball attackable?" decision under real time pressure. A hit is a ball where you chose correctly, by your own tagging.',
    metricType: 'hits_attempts',
    defaultAttempts: 20,
    defaultDurationMin: 15,
    suggestedSettings: 'Randomise ball depth (short and long), backspin only.',
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-H',
    name: 'Random Spin',
    category: PUSH,
    description:
      'Read the ball off the bounce before committing to push or loop. Watch for committing your racket angle before the ball bounces. A hit is a correct choice.',
    metricType: 'hits_attempts',
    defaultAttempts: 20,
    defaultDurationMin: 15,
    suggestedSettings: 'Randomise backspin and no-spin or float, same depth.',
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-I',
    name: 'Traffic Light',
    category: PUSH,
    description:
      'Tag each ball the instant it leaves the robot: Green (attack), Yellow (cautious loop), Red (push). Then execute. A hit is a ball where your tag and execution were right.',
    metricType: 'hits_attempts',
    defaultAttempts: 20,
    defaultDurationMin: 15,
    suggestedSettings: 'Fully randomised depth and spin.',
    cues: '',
    benchmark: {
      metricType: 'hits_attempts',
      threshold: 0.7,
      minAttempts: 20,
      consecutiveSessions: 2,
      description: '70% correct shot selection across 2 consecutive sessions.',
    },
    source: 'original',
  },
  {
    builtInKey: 'orig-J',
    name: 'Full Random Oscillation',
    category: PRESSURE,
    description:
      'Read, decide, execute, recover. Score +1 for a correct decision with clean execution, -1 for a wrong decision or unforced error. Log a set of 10 balls: hits = balls scored +1.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 20,
    suggestedSettings: 'Full randomisation of spin, depth, speed and target zone.',
    cues: '',
    benchmark: { metricType: 'hits_attempts', threshold: 0.7, minAttempts: 10, consecutiveSessions: 1, description: '7/10 per set.' },
    source: 'original',
  },
  {
    builtInKey: 'orig-K',
    name: 'Serve and Receive Simulation',
    category: SERVE,
    description:
      'Push the return, then attack the robot\'s follow-up ball. Mirrors match-start situations where opponents feed backspin to suppress your attack. A hit is a follow-up attack that lands.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 15,
    suggestedSettings: 'Simulate a heavy backspin serve (short, low, spin-loaded).',
    cues: '',
    source: 'original',
  },
  {
    builtInKey: 'orig-L',
    name: 'Survival Sets',
    category: PRESSURE,
    description:
      'Rally to 15 consecutive correct-decision shots before a miss ends the set, then reset and go again. Log your best streak.',
    metricType: 'streak',
    defaultDurationMin: 10,
    suggestedSettings: 'Random everything, higher frequency.',
    cues: '',
    benchmark: {
      metricType: 'streak',
      threshold: 15,
      consecutiveSessions: 2,
      description: 'Streak of 15 or more in 2 consecutive sessions.',
    },
    source: 'original',
  },
  {
    builtInKey: 'orig-cooldown',
    name: 'Free Multiball Cool-down',
    category: MAINT,
    description: 'Free multiball, no target, just rhythm.',
    metricType: 'duration',
    defaultDurationMin: 5,
    suggestedSettings: 'Any.',
    cues: '',
    source: 'original',
  },

  // Holistic and pressure drills
  {
    builtInKey: 'pl-warmup',
    name: 'Grooved Loop Warm-up',
    category: LOOP,
    description: 'Technical reset, not the focus.',
    metricType: 'duration',
    defaultDurationMin: 5,
    suggestedSettings: 'Predictable backspin feed, one zone.',
    cues: '',
    source: 'pressure',
  },
  {
    builtInKey: 'pl-streak',
    name: 'Pressure Streak Game',
    category: PRESSURE,
    description:
      'String together a target number of correct push-or-attack decisions in a row, or the set restarts. This recreates the "can\'t afford to mess up" feeling of a match. Keep a personal-best counter. Use the between-ball routine on every point: breath, towel, reset. The target is set per program item (for example 8, then 12).',
    metricType: 'streak',
    defaultDurationMin: 25,
    suggestedSettings: 'Random depth and spin feed (the Random Depth drill, now with consequences).',
    cues: '',
    source: 'pressure',
  },
  {
    builtInKey: 'pl-play11',
    name: 'Play to 11 vs Robot',
    category: PRESSURE,
    description:
      'You play to 11 against the robot. A loop that goes in is your point, a miss is the robot\'s. Use the between-ball routine on every point. Try to win by a bigger margin each week.',
    metricType: 'score_vs_robot',
    defaultDurationMin: 10,
    suggestedSettings: 'Same random feed.',
    cues: '',
    source: 'pressure',
  },
  {
    builtInKey: 'pl-serve',
    name: 'Serve Practice (off robot)',
    category: SERVE,
    description:
      "Robots cannot replicate real toss, contact or deception, so practise serves on the table without the robot: spin variety, short and long placement, and toss consistency. Rate the session's serve quality 1-5.",
    metricType: 'rating',
    defaultDurationMin: 15,
    suggestedSettings: '',
    cues: '',
    source: 'holistic',
  },
  {
    builtInKey: 'pl-third',
    name: 'Receive and Third-Ball Loop',
    category: SERVE,
    description:
      'Take an immediate third-ball attack rather than resetting to a neutral rally. In league, the first-game goal is a high-percentage loop that goes in, not a winner. A hit is a third-ball attack that lands.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 30,
    suggestedSettings:
      'The feed simulates a return off your serve at varying depth and spin. Start at about 70% power with heavy deep backspin to the middle; in the second week add random placement.',
    cues: '',
    source: 'pressure',
  },
  {
    builtInKey: 'pl-multiball',
    name: 'Wide Block/Counter Multiball',
    category: COUNTER,
    description:
      'Block-counter exchanges and mid-distance footwork together. Structure the feed so recovery to base position between shots is forced, not optional. Rate rally quality and recovery 1-5.',
    metricType: 'rating',
    defaultDurationMin: 35,
    suggestedSettings: 'Multiball alternating wide forehand and backhand at a faster pace than the loop sessions.',
    cues: '',
    source: 'holistic',
  },
  {
    builtInKey: 'pl-shadow',
    name: 'Shadow Footwork (off table)',
    category: FOOTWORK,
    description: 'Optional shadow footwork patterns and side-to-side movement, away from the robot. Light conditioning only.',
    metricType: 'duration',
    defaultDurationMin: 10,
    suggestedSettings: '',
    cues: '',
    source: 'holistic',
  },
  {
    builtInKey: 'sp-tactical',
    name: 'Club Sparring: Tactical Focus',
    category: PRESSURE,
    description:
      'Before sparring, pick one specific tactical focus (for example "every short backspin ball gets a forehand attack, no exceptions") and write it in the note. Rotate partners of different styles where possible. Treat at least one game as match-realistic: full scoring, no coaching mid-game. Rate how well you stuck to the focus 1-5.',
    metricType: 'rating',
    defaultDurationMin: 45,
    suggestedSettings: '',
    cues: '',
    source: 'holistic',
  },

  // Starter drafts (source: "starter-draft")
  {
    builtInKey: 'st-blockplace',
    name: 'Block Placement (Wide FH/BH)',
    category: COUNTER,
    description: 'Block every ball to a target zone.',
    metricType: 'hits_attempts',
    defaultAttempts: 20,
    defaultDurationMin: 15,
    suggestedSettings: 'Topspin feed, medium-fast, alternating wide forehand and backhand.',
    cues: 'Meet the ball early, short compact stroke, recover to base.',
    source: 'starter-draft',
  },
  {
    builtInKey: 'st-blockcounter',
    name: 'Block-to-Counter Switch',
    category: COUNTER,
    description:
      'Block the first two balls, then counter-hit or loop the third. Trains switching from passive to active mid-rally, the same habit as Push-Push-Loop but against topspin. A hit is a third-ball counter that lands.',
    metricType: 'hits_attempts',
    defaultAttempts: 10,
    defaultDurationMin: 15,
    suggestedSettings: 'Topspin feed, medium pace.',
    cues: '',
    source: 'starter-draft',
  },
  {
    builtInKey: 'st-counterloop',
    name: 'Loop vs Topspin (mid-distance)',
    category: COUNTER,
    description: 'Step back and loop-to-loop. Log the best streak of consecutive successful loops.',
    metricType: 'streak',
    defaultDurationMin: 15,
    suggestedSettings: "Heavier topspin, medium speed, as far back from the table as the robot's pace allows.",
    cues: '',
    source: 'starter-draft',
  },
  {
    builtInKey: 'st-pushtouch',
    name: 'Short Push Touch Control',
    category: MAINT,
    description: 'Push short and low to a target zone. A hit is a push that lands on target.',
    metricType: 'hits_attempts',
    defaultAttempts: 20,
    defaultDurationMin: 10,
    suggestedSettings: 'Short backspin to forehand and backhand.',
    cues: '',
    source: 'starter-draft',
  },
]

// ---------------------------------------------------------------------------
// A.3 Session templates
// ---------------------------------------------------------------------------

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { builtInKey: 'T-orig-p1', name: 'Original Phase 1 Session', kind: 'robot', items: [
    { drillKey: 'orig-A', durationMin: 15 }, { drillKey: 'orig-B', durationMin: 15 },
    { drillKey: 'orig-C', durationMin: 15 }, { drillKey: 'orig-cooldown', durationMin: 5 } ] },
  { builtInKey: 'T-orig-p2', name: 'Original Phase 2 Session', kind: 'robot', items: [
    { drillKey: 'orig-D', durationMin: 20 }, { drillKey: 'orig-E', durationMin: 15 }, { drillKey: 'orig-F', durationMin: 10 } ] },
  { builtInKey: 'T-orig-p3', name: 'Original Phase 3 Session', kind: 'robot', items: [
    { drillKey: 'orig-G', durationMin: 15 }, { drillKey: 'orig-H', durationMin: 15 }, { drillKey: 'orig-I', durationMin: 15 } ] },
  { builtInKey: 'T-orig-p4', name: 'Original Phase 4 Session', kind: 'robot', items: [
    { drillKey: 'orig-J', durationMin: 20 }, { drillKey: 'orig-K', durationMin: 15 }, { drillKey: 'orig-L', durationMin: 10 } ] },
  { builtInKey: 'T-reset', name: 'Monthly Technique Reset', kind: 'robot', items: [
    { drillKey: 'orig-A', durationMin: 15 }, { drillKey: 'orig-B', durationMin: 15 }, { drillKey: 'orig-cooldown', durationMin: 5 } ] },
  { builtInKey: 'T-hol-A', name: 'Holistic A: Pressure Loop and Recognition', kind: 'robot', items: [
    { drillKey: 'pl-warmup', durationMin: 5 }, { drillKey: 'pl-streak', durationMin: 30 }, { drillKey: 'pl-play11', durationMin: 10 } ] },
  { builtInKey: 'T-hol-B', name: 'Holistic B: Serve, Receive, Third Ball', kind: 'robot', items: [
    { drillKey: 'pl-serve', durationMin: 15 }, { drillKey: 'pl-third', durationMin: 30 } ] },
  { builtInKey: 'T-hol-C', name: 'Holistic C: Block/Counter and Footwork', kind: 'robot', items: [
    { drillKey: 'pl-multiball', durationMin: 35 }, { drillKey: 'pl-shadow', durationMin: 10 } ] },
  { builtInKey: 'T-club', name: 'Club Sparring: Tactical', kind: 'club', items: [{ drillKey: 'sp-tactical', durationMin: 45 }] },
  { builtInKey: 'T-pl-S1', name: 'Pressure Loop: Session 1', kind: 'robot', items: [
    { drillKey: 'pl-warmup', durationMin: 5 }, { drillKey: 'pl-streak', durationMin: 25 }, { drillKey: 'pl-play11', durationMin: 10 } ] },
  { builtInKey: 'T-pl-S2', name: 'Pressure Loop: Session 2', kind: 'robot', items: [
    { drillKey: 'pl-serve', durationMin: 12 }, { drillKey: 'pl-third', durationMin: 30 } ] },
  { builtInKey: 'T-pl-S3', name: 'Pressure Loop: Session 3', kind: 'robot', items: [
    { drillKey: 'pl-multiball', durationMin: 35 }, { drillKey: 'pl-streak', durationMin: 10, note: 'tired, end of session' } ] },
  { builtInKey: 'T-ct-1', name: 'Counter Week 1', kind: 'robot', items: [
    { drillKey: 'st-blockplace', durationMin: 15 }, { drillKey: 'pl-multiball', durationMin: 25 } ] },
  { builtInKey: 'T-ct-2', name: 'Counter Week 2', kind: 'robot', items: [
    { drillKey: 'st-blockplace', durationMin: 10 }, { drillKey: 'st-blockcounter', durationMin: 15 }, { drillKey: 'pl-multiball', durationMin: 20 } ] },
  { builtInKey: 'T-ct-3', name: 'Counter Week 3', kind: 'robot', items: [
    { drillKey: 'st-blockcounter', durationMin: 10 }, { drillKey: 'st-counterloop', durationMin: 15 }, { drillKey: 'pl-multiball', durationMin: 20 } ] },
  { builtInKey: 'T-mt-1', name: 'Maintenance 1: Technique', kind: 'robot', items: [
    { drillKey: 'orig-A', durationMin: 15 }, { drillKey: 'orig-B', durationMin: 15 }, { drillKey: 'orig-cooldown', durationMin: 5 } ] },
  { builtInKey: 'T-mt-2', name: 'Maintenance 2: Decisions', kind: 'robot', items: [
    { drillKey: 'orig-G', durationMin: 15 }, { drillKey: 'st-blockplace', durationMin: 15 }, { drillKey: 'st-pushtouch', durationMin: 10 } ] },
  { builtInKey: 'T-mt-3', name: 'Maintenance 3: Match Feel', kind: 'robot', items: [
    { drillKey: 'orig-J', durationMin: 20 }, { drillKey: 'pl-serve', durationMin: 10 }, { drillKey: 'orig-cooldown', durationMin: 5 } ] },
  { builtInKey: 'T-sr-1', name: 'Serve/Receive 1', kind: 'robot', items: [
    { drillKey: 'pl-serve', durationMin: 15 }, { drillKey: 'pl-third', durationMin: 20 }, { drillKey: 'st-pushtouch', durationMin: 10 } ] },
  { builtInKey: 'T-sr-2', name: 'Serve/Receive 2', kind: 'robot', items: [
    { drillKey: 'pl-serve', durationMin: 15 }, { drillKey: 'orig-K', durationMin: 20 } ] },
  { builtInKey: 'T-sr-3', name: 'Serve/Receive 3', kind: 'robot', items: [
    { drillKey: 'pl-serve', durationMin: 10 }, { drillKey: 'pl-third', durationMin: 20 }, { drillKey: 'orig-K', durationMin: 15 } ] },
  { builtInKey: 'T-fw-1', name: 'Footwork 1', kind: 'robot', items: [
    { drillKey: 'orig-F', durationMin: 10 }, { drillKey: 'pl-multiball', durationMin: 25 }, { drillKey: 'pl-shadow', durationMin: 10 } ] },
  { builtInKey: 'T-fw-2', name: 'Footwork 2', kind: 'robot', items: [
    { drillKey: 'orig-E', durationMin: 15 }, { drillKey: 'pl-shadow', durationMin: 10 }, { drillKey: 'orig-F', durationMin: 10 } ] },
  { builtInKey: 'T-fw-3', name: 'Footwork 3', kind: 'robot', items: [
    { drillKey: 'pl-multiball', durationMin: 30 }, { drillKey: 'pl-shadow', durationMin: 10 } ] },
]

// ---------------------------------------------------------------------------
// A.5 Match-day protocol (also used as a guide card in a later stage)
// ---------------------------------------------------------------------------

export const MATCH_DAY_PROTOCOL = [
  'Pre-match: short physical warm-up plus one single mental cue for the day (for example "let the ball come to you before committing"). One cue, not a checklist, because trying to fix everything live is part of the pressure problem.',
  'In-match: stick to that one cue. Add a second only if the first is solid.',
  'Post-match (5 min): log what worked and where the push-to-attack decision broke down: against what serve, what spin, what score. Use the Matches tab for this.',
]

// Static prompts shown on the Block Review screen (spec 3.8).
export const BLOCK_REVIEW_PROMPTS = [
  "If recognition under pressure is still the main issue, increase Session A's randomisation and pressure load.",
  "If serve/receive is solid but block/counter rallies are the new leak, shift Session C's feed pace up.",
]

// ---------------------------------------------------------------------------
// A.4 Programs
// ---------------------------------------------------------------------------

/** Build weeks where every session slot is one of the given templates, in order. */
function weeksOf(
  from: number,
  to: number,
  title: string,
  goal: string | undefined,
  slots: Array<{ label: string; templateKey: string }>,
): BuiltinWeek[] {
  const weeks: BuiltinWeek[] = []
  for (let n = from; n <= to; n++) {
    weeks.push({ weekNumber: n, title, goal, sessions: slots.map((s) => ({ ...s })) })
  }
  return weeks
}

/** The same template three times in a week: "Session 1/2/3". */
function threeOf(templateKey: string) {
  return [1, 2, 3].map((i) => ({ label: `Session ${i}`, templateKey }))
}

const streakTarget = (n: number): Benchmark => ({
  metricType: 'streak',
  threshold: n,
  consecutiveSessions: 1,
  description: `Streak of ${n}`,
})
const thirdBallTarget = (hits: number): Benchmark => ({
  metricType: 'hits_attempts',
  threshold: hits / 10,
  minAttempts: 10,
  consecutiveSessions: 1,
  description: `${hits}/10 third-ball attacks landing`,
})

const P1_NOTES = [
  'If a benchmark is not hit after 3 weeks in a phase, stay there rather than moving on, because later phases assume the earlier ones are solid and rushing relocates the inconsistency rather than fixing it.',
  'After week 12, do not retire Phase 1: use the Monthly Technique Reset session about once a month, because randomised drills sharpen reflexes but let small technical faults creep back in.',
].join('\n\n')

const P2_NOTES = [
  'Before each league match: 5 minutes of grooved looping off backspin, then pick one cue ("let the ball drop").',
  'In league: aim for a high-percentage loop in the first game, not a winner. Take the slow, heavy, deep backspin ball in the middle at about 70% power with full follow-through, and stop trying to loop everything.',
  'After each match: 5 minutes noting where the push-to-attack decision broke down.',
  'A few league matches is a small sample, so judge the work on loop attempts and confidence, not early results.',
].join('\n\n')

const P3_NOTES = [
  'Optional: log Club Sparring: Tactical separately as a club session. Club sparring does not count toward the weekly robot target.',
  'Sparring rules: before sparring, pick one specific tactical focus and write it in the note. Rotate partners of different styles where possible. Treat at least one game as match-realistic: full scoring, no coaching mid-game. Rate how well you stuck to the focus 1-5.',
  'Week 4 is the consolidate and review week. It should land after a league match. After week 4, open Block Review.',
  ...MATCH_DAY_PROTOCOL.map((t, i) => (i === 0 ? `Match-day protocol. ${t}` : t)),
  ...BLOCK_REVIEW_PROMPTS,
].join('\n\n')

export const BUILTIN_PROGRAMS: BuiltinProgram[] = [
  {
    builtInKey: 'P1',
    name: 'Loop and Transition, 12 Weeks',
    category: LOOP,
    description:
      'Four phases of three weeks: groove the loop, loop and sustain, push-to-attack under randomness, then game-realistic simulation. Three robot sessions a week.',
    repeating: false,
    sessionsPerWeek: 3,
    weeks: [
      ...weeksOf(1, 3, 'Phase 1: Groove the loop', 'Benchmark: Pure Repetition Loop 8/10.', threeOf('T-orig-p1')),
      ...weeksOf(4, 6, 'Phase 2: Loop and sustain', 'Benchmark: Loop Then Sustain 7/10.', threeOf('T-orig-p2')),
      ...weeksOf(7, 9, 'Phase 3: Push-to-attack under randomness', 'Benchmark: Traffic Light 70% in 2 consecutive sessions.', threeOf('T-orig-p3')),
      ...weeksOf(10, 12, 'Phase 4: Game-realistic simulation', 'Benchmarks: Full Random Oscillation 7/10; Survival Sets streak 15.', threeOf('T-orig-p4')),
    ].map((w, i) => ({ ...w, weekNumber: i + 1 })),
    notes: P1_NOTES,
  },
  {
    builtInKey: 'P2',
    name: 'Pressure Loop, 2 Weeks (post-league)',
    category: PRESSURE,
    description:
      'Two weeks of pressure-loop work after league matches. At the end of week 2 the app shows a check of your best streak, loop attempts in matches and confidence.',
    repeating: false,
    sessionsPerWeek: 3,
    weeks: [
      {
        weekNumber: 1,
        title: 'Week 1',
        sessions: [
          { label: 'Session 1', templateKey: 'T-pl-S1', benchmarkOverrides: { 'pl-streak': { benchmark: streakTarget(8) } } },
          { label: 'Session 2', templateKey: 'T-pl-S2', benchmarkOverrides: { 'pl-third': { benchmark: thirdBallTarget(7) } } },
          { label: 'Session 3', templateKey: 'T-pl-S3', benchmarkOverrides: { 'pl-streak': { benchmark: streakTarget(8) } } },
        ],
      },
      {
        weekNumber: 2,
        title: 'Week 2',
        sessions: [
          { label: 'Session 1', templateKey: 'T-pl-S1', benchmarkOverrides: { 'pl-streak': { benchmark: streakTarget(12) } } },
          {
            label: 'Session 2',
            templateKey: 'T-pl-S2',
            benchmarkOverrides: { 'pl-third': { benchmark: thirdBallTarget(8), note: 'Then add random placement.' } },
          },
          { label: 'Session 3', templateKey: 'T-pl-S3', benchmarkOverrides: { 'pl-streak': { benchmark: streakTarget(12) } } },
        ],
      },
    ],
    notes: P2_NOTES,
  },
  {
    builtInKey: 'P3',
    name: 'Holistic Phase 2, Rolling 4-Week Blocks',
    category: PRESSURE,
    description:
      'A 4-week cycle that repeats: weeks 1-3 build, week 4 consolidates and reviews. Each week has Sessions A, B and C. Club sparring is logged separately.',
    repeating: true,
    cycleLengthWeeks: 4,
    sessionsPerWeek: 3,
    weeks: [
      ...weeksOf(1, 3, 'Build', undefined, [
        { label: 'Session A', templateKey: 'T-hol-A' },
        { label: 'Session B', templateKey: 'T-hol-B' },
        { label: 'Session C', templateKey: 'T-hol-C' },
      ]),
      ...weeksOf(4, 4, 'Consolidate and review', 'Block Review this week. It should land after a league match.', [
        { label: 'Session A', templateKey: 'T-hol-A' },
        { label: 'Session B', templateKey: 'T-hol-B' },
        { label: 'Session C', templateKey: 'T-hol-C' },
      ]),
    ].map((w, i) => ({ ...w, weekNumber: i + 1 })),
    notes: P3_NOTES,
  },
  {
    builtInKey: 'P4',
    name: 'Counter-Attack and Block, 3 Weeks',
    category: COUNTER,
    description: 'Starter draft: block placement, block-to-counter switching and loop against topspin. No benchmarks.',
    repeating: false,
    sessionsPerWeek: 3,
    weeks: [
      { weekNumber: 1, title: 'Week 1', sessions: threeOf('T-ct-1') },
      { weekNumber: 2, title: 'Week 2', sessions: threeOf('T-ct-2') },
      { weekNumber: 3, title: 'Week 3', sessions: threeOf('T-ct-3') },
    ],
    notes: '',
  },
  {
    builtInKey: 'P5',
    name: 'All-Round Maintenance, 1 Week',
    category: MAINT,
    description: 'Starter draft: one repeating week of technique, decisions and match feel. Benchmarks come from the drills.',
    repeating: true,
    cycleLengthWeeks: 1,
    sessionsPerWeek: 3,
    weeks: [
      {
        weekNumber: 1,
        title: 'Maintenance week',
        sessions: [
          { label: 'Technique', templateKey: 'T-mt-1' },
          { label: 'Decisions', templateKey: 'T-mt-2' },
          { label: 'Match Feel', templateKey: 'T-mt-3' },
        ],
      },
    ],
    notes: '',
  },
  {
    builtInKey: 'P6',
    name: 'Serve and Receive Focus, 2 Weeks',
    category: SERVE,
    description: 'Starter draft: serve practice, third-ball attacks and serve-and-receive simulation.',
    repeating: false,
    sessionsPerWeek: 3,
    weeks: [1, 2].map((n) => ({
      weekNumber: n,
      title: `Week ${n}`,
      sessions: [
        { label: 'Session 1', templateKey: 'T-sr-1' },
        { label: 'Session 2', templateKey: 'T-sr-2' },
        { label: 'Session 3', templateKey: 'T-sr-3' },
      ],
    })),
    notes: '',
  },
  {
    builtInKey: 'P7',
    name: 'Footwork and Conditioning, 2 Weeks',
    category: FOOTWORK,
    description: 'Starter draft: footwork ladder, two-zone attack, wide multiball and shadow footwork.',
    repeating: false,
    sessionsPerWeek: 3,
    weeks: [1, 2].map((n) => ({
      weekNumber: n,
      title: `Week ${n}`,
      sessions: [
        { label: 'Session 1', templateKey: 'T-fw-1' },
        { label: 'Session 2', templateKey: 'T-fw-2' },
        { label: 'Session 3', templateKey: 'T-fw-3' },
      ],
    })),
    notes: '',
  },
]
