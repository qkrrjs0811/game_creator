import { describe, expect, it } from 'vitest'
import { PLAYER_MOVE, comboText, playerMoves } from './attackMove'

const p = (kind: 'hit' | 'miss', crit = false) => ({ actor: 'player' as const, kind, crit })
const e = (kind: 'hit' | 'miss') => ({ actor: 'enemy' as const, kind })

describe('말랑이 기본 공격 여러 가지', () => {
  it('말랑이 공격은 박치기 → 점프 찍기 → 회전 돌진을 돌아가며 쓴다', () => {
    const moves = playerMoves([p('hit'), e('hit'), p('hit'), e('miss'), p('hit'), e('hit'), p('hit')])
    expect(moves.map((m) => m.move)).toEqual(['tackle', null, 'hop', null, 'spin', null, 'tackle'])
  })

  it('치명타는 늘 점프 찍기로 크게 내려찍는다', () => {
    const moves = playerMoves([p('hit', true), p('hit', true), p('hit')])
    expect(moves.map((m) => m.move)).toEqual(['hop', 'hop', 'spin'])
  })

  it('연속으로 맞힌 수를 세고 빗나가면 처음부터 센다(몬스터 차례는 끊지 않는다)', () => {
    const moves = playerMoves([p('hit'), e('hit'), p('hit'), e('miss'), p('hit'), p('miss'), p('hit')])
    expect(moves.map((m) => m.combo)).toEqual([1, 0, 2, 0, 3, 0, 1])
  })

  it('세 번째 연속 명중부터 콤보 글자를 보여 준다', () => {
    expect(comboText(1)).toBeNull()
    expect(comboText(2)).toBeNull()
    expect(comboText(3)).toBe('3 콤보!')
    expect(comboText(7)).toBe('7 콤보!')
  })

  it('공격마다 이름이 있다', () => {
    expect(PLAYER_MOVE.tackle).toBe('몸통 박치기')
    expect(PLAYER_MOVE.hop).toBe('점프 찍기')
    expect(PLAYER_MOVE.spin).toBe('회전 돌진')
  })

  it('빈 전투 기록은 빈 목록', () => {
    expect(playerMoves([])).toEqual([])
  })
})
