import { describe, test, expect } from 'vitest'
import {
  STAGES_PER_CHAPTER,
  chapterBrowse,
  chapterOf,
  chapterStages,
  endlessStage,
  endlessStageOpen,
  homeMonster,
  stageEnemy,
  stageMonster,
  targetMinutes,
} from './endless'
import { playerFighter, simulateBattle } from './battle'
import { BASE_STAT } from './progression'
import { freshMinutesToWin } from './difficulty'
import { MONSTERS } from './monsters'
import { STAGES } from './stages'

describe('endlessStage 장과 순서', () => {
  test('한 장은 스테이지 10개, 10번째가 보스', () => {
    expect(STAGES_PER_CHAPTER).toBe(10)
    expect(endlessStage(1)).toMatchObject({ no: 1, chapter: 1, index: 1, boss: false })
    expect(endlessStage(10)).toMatchObject({ chapter: 1, index: 10, boss: true })
    expect(endlessStage(11)).toMatchObject({ chapter: 2, index: 1, boss: false })
    expect(endlessStage(20)).toMatchObject({ chapter: 2, index: 10, boss: true })
    expect(endlessStage(123)).toMatchObject({ chapter: 13, index: 3, boss: false })
  })

  test('이상한 번호는 1스테이지로 본다', () => {
    expect(endlessStage(0).no).toBe(1)
    expect(endlessStage(-3).no).toBe(1)
    expect(endlessStage(Number.NaN).no).toBe(1)
    expect(endlessStage(2.7).no).toBe(2)
  })

  test('같은 번호는 언제나 같은 스테이지', () => {
    expect(endlessStage(37)).toEqual(endlessStage(37))
  })
})

describe('endlessStage 모습', () => {
  test('1장 앞쪽 다섯 스테이지와 보스는 지금 이름·몬스터 모습을 다시 쓴다', () => {
    for (let i = 0; i < 5; i++) {
      const s = endlessStage(i + 1)
      expect(s.name).toBe(STAGES[i].name)
      expect(s.icon).toBe(STAGES[i].icon)
      expect(s.monster).toMatchObject({ name: MONSTERS[i].name, shape: MONSTERS[i].shape, color: MONSTERS[i].color, shade: MONSTERS[i].shade })
    }
    const boss = endlessStage(10)
    expect(boss.name).toBe(STAGES[5].name)
    expect(boss.monster).toMatchObject({ name: MONSTERS[5].name, shape: 'king', color: MONSTERS[5].color, boss: true })
  })

  test('보스는 왕 모양, 보통 스테이지는 보스 모양이 아니다', () => {
    for (let n = 1; n <= 40; n++) {
      const s = endlessStage(n)
      expect(s.monster.boss).toBe(s.boss)
      expect(s.monster.shape === 'king').toBe(s.boss)
    }
  })

  test('장이 바뀌면 이름과 몬스터 색 조합이 바뀐다', () => {
    for (let c = 1; c < 30; c++) {
      const a = endlessStage((c - 1) * 10 + 1)
      const b = endlessStage(c * 10 + 1)
      expect(b.chapterName).not.toBe(a.chapterName)
      expect(b.name).not.toBe(a.name)
      expect(b.monster.color).not.toBe(a.monster.color)
    }
  })

  test('몬스터 이름·아이콘이 비지 않고 몬스터마다 id가 다르다', () => {
    const ids = new Set<string>()
    for (let n = 1; n <= 60; n++) {
      const s = endlessStage(n)
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.icon.length).toBeGreaterThan(0)
      expect(s.monster.name.length).toBeGreaterThan(0)
      ids.add(s.monster.id)
    }
    expect(ids.size).toBe(60)
  })
})

describe('endlessStage 난이도', () => {
  test('목표 시간: 보통은 1.5 × (n−1)^1.75 분, 보스는 n+1 수준', () => {
    expect(targetMinutes(1)).toBe(0)
    expect(targetMinutes(2)).toBeCloseTo(1.5)
    expect(targetMinutes(9)).toBeCloseTo(1.5 * 8 ** 1.75)
    expect(targetMinutes(10)).toBeCloseTo(1.5 * 10 ** 1.75)
  })

  // 능력치는 운동 10분마다 오르므로 처음 몇 스테이지는 10분 한 칸까지 봐준다
  test.each([2, 3, 5, 9, 10, 20, 30, 50])('스테이지 %i은 기획서 곡선 ±25% 안에서 이길 만해진다', (n) => {
    const target = targetMinutes(n)
    const measured = freshMinutesToWin(endlessStage(n).enemy)!
    expect(measured).not.toBeNull()
    const slack = Math.max(target * 0.25, 10)
    expect(Math.abs(measured - target)).toBeLessThanOrEqual(slack)
  })

  test('보통 스테이지는 뒤로 갈수록 오래 걸리고, 보스는 앞 스테이지보다 오래 걸린다', () => {
    let last = 0
    for (let n = 1; n <= 40; n++) {
      const m = freshMinutesToWin(endlessStage(n).enemy)!
      if (endlessStage(n).boss) {
        expect(m).toBeGreaterThan(last)
        continue
      }
      expect(m).toBeGreaterThanOrEqual(last)
      last = m
    }
  })

  test('몬스터 전투 값은 이름이 몬스터 이름이고 피하기는 0~0.5', () => {
    for (let n = 1; n <= 30; n++) {
      const s = endlessStage(n)
      expect(s.enemy.name).toBe(s.monster.name)
      expect(s.enemy.dodge).toBeGreaterThanOrEqual(0)
      expect(s.enemy.dodge).toBeLessThanOrEqual(0.5)
      expect(s.enemy.hp).toBeGreaterThan(0)
    }
  })
})

describe('endlessStageOpen', () => {
  test('깬 스테이지와 바로 다음이 열리고, 끝이 없다', () => {
    expect(endlessStageOpen(0, 1)).toBe(true)
    expect(endlessStageOpen(0, 2)).toBe(false)
    expect(endlessStageOpen(25, 26)).toBe(true)
    expect(endlessStageOpen(25, 27)).toBe(false)
    expect(endlessStageOpen(25, 0)).toBe(false)
  })

  test('이전 저장(6스테이지 보스까지 깸)의 진행을 그대로 이어 간다', () => {
    // 예전 1장은 6스테이지가 끝이었다. 깬 6개는 그대로 깬 것이고 7스테이지가 새로 열린다
    for (let no = 1; no <= 6; no++) expect(endlessStageOpen(6, no)).toBe(true)
    expect(endlessStageOpen(6, 7)).toBe(true)
    expect(endlessStageOpen(6, 8)).toBe(false)
  })

  test('이상한 값(백업)이어도 깨지지 않는다', () => {
    expect(endlessStageOpen(-4, 1)).toBe(true)
    expect(endlessStageOpen(Number.NaN, 1)).toBe(true)
    expect(endlessStageOpen(Number.NaN, 2)).toBe(false)
  })
})

describe('스테이지로 찾기', () => {
  test('스테이지 몬스터와 전투 값', () => {
    expect(stageMonster(3)).toEqual(endlessStage(3).monster)
    expect(stageEnemy(3)).toEqual(endlessStage(3).enemy)
    expect(stageEnemy(0)).toEqual(stageEnemy(1))
  })

  test('처음 시작한 말랑이도 1스테이지는 이기고 3스테이지는 아직 어렵다', () => {
    const me = playerFighter({ str: BASE_STAT, vit: BASE_STAT, int: BASE_STAT }, [])
    for (let seed = 0; seed < 300; seed++) {
      expect(simulateBattle(me, stageEnemy(1), seed).win).toBe(true)
      expect(simulateBattle(me, stageEnemy(3), seed).win).toBe(false)
    }
  })

  test('홈 장면에는 다음에 도전할 스테이지의 몬스터가 나오고, 끝이 없다', () => {
    expect(homeMonster(0).id).toBe(MONSTERS[0].id)
    expect(homeMonster(2).id).toBe(MONSTERS[2].id)
    expect(homeMonster(9).id).toBe(MONSTERS[5].id)
    expect(homeMonster(6)).toEqual(stageMonster(7))
    expect(homeMonster(42)).toEqual(stageMonster(43))
    expect(homeMonster(-3).id).toBe(MONSTERS[0].id)
  })
})

describe('chapterStages', () => {
  test('지금 장(다음에 깰 스테이지가 있는 장)의 10칸', () => {
    const list = chapterStages(0)
    expect(list.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(list.map((s) => s.state)).toEqual(['open', ...Array(9).fill('locked')])
    expect(chapterStages(10)[0].no).toBe(11)
    expect(chapterStages(9)[9].no).toBe(10)
  })

  test('깸·도전 가능·잠김 상태', () => {
    expect(chapterStages(12).map((s) => s.state)).toEqual(['cleared', 'cleared', 'open', ...Array(7).fill('locked')])
  })

  test('이전 저장(6까지 깸)은 1장의 6칸이 깬 것, 7스테이지가 도전', () => {
    expect(chapterStages(6).map((s) => s.state)).toEqual([...Array(6).fill('cleared'), 'open', 'locked', 'locked', 'locked'])
  })

  test('다른 장을 골라 볼 수 있고, 이상한 값(백업)이어도 깨지지 않는다', () => {
    expect(chapterStages(12, 1).every((s) => s.state === 'cleared')).toBe(true)
    expect(chapterStages(0, 3).every((s) => s.state === 'locked')).toBe(true)
    expect(chapterStages(-1)[0].state).toBe('open')
    expect(chapterStages(Number.NaN)[0].no).toBe(1)
    expect(chapterOf(10)).toBe(1)
    expect(chapterOf(11)).toBe(2)
  })
})

describe('chapterBrowse 앞뒤 장 넘겨 보기', () => {
  test('지금 장에서 앞 장들과 바로 다음 장 하나까지 볼 수 있다', () => {
    expect(chapterBrowse(17)).toEqual({ chapter: 2, current: 2, prev: true, next: true, revealed: true })
    expect(chapterBrowse(17, 1)).toEqual({ chapter: 1, current: 2, prev: false, next: true, revealed: true })
    expect(chapterBrowse(17, 3)).toEqual({ chapter: 3, current: 2, prev: true, next: false, revealed: false })
  })

  test('처음에는 1장, 다음 장(2장)은 이름이 비밀', () => {
    expect(chapterBrowse(0)).toEqual({ chapter: 1, current: 1, prev: false, next: true, revealed: true })
    expect(chapterBrowse(0, 2).revealed).toBe(false)
  })

  test('범위를 넘거나 이상한 값이면 볼 수 있는 끝으로 맞춘다', () => {
    expect(chapterBrowse(17, 9).chapter).toBe(3)
    expect(chapterBrowse(17, 0).chapter).toBe(1)
    expect(chapterBrowse(17, Number.NaN).chapter).toBe(2)
    expect(chapterBrowse(Number.NaN, 5).chapter).toBe(2)
  })

  test('장 보스를 깨면 다음 장이 지금 장이 된다', () => {
    expect(chapterBrowse(10)).toMatchObject({ chapter: 2, current: 2, revealed: true })
  })
})
