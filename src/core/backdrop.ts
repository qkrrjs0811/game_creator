import { chapterOf } from './endless'

/** 장면 뒤에 흩어 그릴 둥근 장식 */
export const BACKDROP_DECORS = ['clouds', 'hills', 'stars', 'bubbles', 'flowers', 'sun', 'snow', 'leaves'] as const
export type BackdropDecor = (typeof BACKDROP_DECORS)[number]

export interface Backdrop {
  /** 하늘 위쪽 색 */
  sky: string
  /** 하늘 아래쪽(땅 가까이) 색 */
  skyLow: string
  /** 땅 색 */
  ground: string
  decor: BackdropDecor
}

/** 장마다 돌아가며 쓰는 파스텔 배경. 1장은 원래 배경(하늘색→연두)이다 */
const THEMES: Backdrop[] = [
  { sky: '#bfe6ff', skyLow: '#e4f7d6', ground: '#c6e9a8', decor: 'clouds' },
  { sky: '#ffd8c8', skyLow: '#fff0d4', ground: '#f3d9a4', decor: 'hills' },
  { sky: '#d8ccff', skyLow: '#f3e8ff', ground: '#d9c8ef', decor: 'stars' },
  { sky: '#c4f0e6', skyLow: '#eafbf3', ground: '#a8e0cc', decor: 'bubbles' },
  { sky: '#ffd6e6', skyLow: '#fff0f4', ground: '#f6c8d8', decor: 'flowers' },
  { sky: '#fff2b0', skyLow: '#fffbe2', ground: '#e8e0a0', decor: 'sun' },
  { sky: '#c8eeff', skyLow: '#f0fbff', ground: '#dcecf5', decor: 'snow' },
  { sky: '#ffe2bc', skyLow: '#fff5e6', ground: '#f0c89a', decor: 'leaves' },
]

/** 장 번호의 배경. 같은 장은 늘 같고, 이웃한 장은 하늘과 장식이 다르다. 그림만 바꾸고 성장·저장과는 상관없다 */
export function chapterBackdrop(chapter: number): Backdrop {
  const c = Number.isFinite(chapter) && chapter >= 1 ? Math.floor(chapter) : 1
  return { ...THEMES[(c - 1) % THEMES.length] }
}

/** 스테이지 번호가 속한 장의 배경 */
export function stageBackdrop(no: number): Backdrop {
  return chapterBackdrop(chapterOf(no))
}
