// Static guide cards for Train > Guides (spec 5). Wording follows the spec and Appendix A; nothing here is stored.
import { MATCH_DAY_PROTOCOL } from './builtinContent'

export interface GuideCard {
  id: string
  title: string
  intro?: string
  points: Array<{ heading?: string; text: string }>
}

export const GUIDES: GuideCard[] = [
  {
    id: 'diagnosis',
    title: 'Diagnosis: why the loop is inconsistent',
    points: [
      { text: 'Rushing' },
      { text: 'Racket angle not matched to spin' },
      { text: 'Inconsistent brush contact' },
      { text: 'Weak leg drive' },
      { text: 'Push-to-attack is a recognition skill.' },
    ],
  },
  {
    id: 'routine',
    title: 'Between-ball routine',
    intro: 'Used on every point.',
    points: [{ text: 'Breath' }, { text: 'Towel' }, { text: 'Reset' }],
  },
  {
    id: 'match-day',
    title: 'Match-day protocol',
    intro: 'From the Holistic program.',
    points: MATCH_DAY_PROTOCOL.map((t) => ({ text: t })),
  },
]
