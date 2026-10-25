import { describe, test, expect } from 'vitest'
import { AUTO_RUN_MAX, autoRun, autoRunSeed } from './autorun'
import { playerFighter, simulateBattle } from './battle'
import { stageEnemy } from './endless'
import { statsFromMinutes } from './progression'
import type { SaveData } from './types'

const base: SaveData = { version: 1, records: [], active: null, skills: [], stageProgress: 0, cosmetics: [], worn: [] }

const stats = (minutes: number) => statsFromMinutes({ exercise: minutes })

describe('autoRun', () => {
  test('다음 스테이지부터 이어 싸우다 처음 지는 곳에서 멈춘다', () => {
    const run = autoRun(base, stats(0), [])
    expect(run.from).toBe(0)
    expect(run.battles[0].no).toBe(1)
    const last = run.battles[run.battles.length - 1]
    expect(last.win).toBe(false)
    expect(run.battles.slice(0, -1).every((b) => b.win)).toBe(true)
    expect(run.to).toBe(last.no - 1)
    expect(run.save.stageProgress).toBe(run.to)
    expect(run.stoppedAt).toBe(last.no)
  })

  test('판마다 스테이지마다 정해진 씨앗으로 싸운다(같은 조건이면 같은 결과)', () => {
    const me = playerFighter(stats(300), [])
    const run = autoRun(base, stats(300), [])
    for (const b of run.battles) expect(b.win).toBe(simulateBattle(me, stageEnemy(b.no), autoRunSeed(b.no)).win)
    expect(autoRun(base, stats(300), [])).toEqual(run)
  })

  test('한 번에 최대 10판에서 멈추고, 다 이기면 멈춘 곳이 없다', () => {
    const run = autoRun(base, stats(100000), [])
    expect(run.battles).toHaveLength(AUTO_RUN_MAX)
    expect(run.battles.every((b) => b.win)).toBe(true)
    expect(run.to).toBe(AUTO_RUN_MAX)
    expect(run.stoppedAt).toBeNull()
    expect(autoRun(base, stats(100000), [], 3).battles).toHaveLength(3)
  })

  test('장 보스를 깨면 그 장 모자를 받아 저장한다', () => {
    const run = autoRun({ ...base, stageProgress: 5 }, stats(100000), [])
    expect(run.to).toBe(15)
    expect(run.rewards.map((r) => r.id)).toContain('hat-ch1')
    expect(run.save.cosmetics).toContain('hat-ch1')
  })

  test('바꾸는 건 깬 스테이지 수와 꾸미기뿐이다(기록·스킬은 그대로)', () => {
    const save = { ...base, skills: ['punch'], records: [{ activity: 'exercise', start: 0, end: 600000 }] } as unknown as SaveData
    const run = autoRun(save, stats(100000), save.skills)
    expect(run.save.records).toBe(save.records)
    expect(run.save.skills).toBe(save.skills)
    expect(run.save.version).toBe(save.version)
  })

  test('첫 판부터 지면 저장을 그대로 돌려준다', () => {
    const save = { ...base, stageProgress: 40 }
    const run = autoRun(save, stats(0), [])
    expect(run.battles).toHaveLength(1)
    expect(run.battles[0]).toMatchObject({ no: 41, win: false })
    expect(run.to).toBe(40)
    expect(run.save).toBe(save)
    expect(run.rewards).toEqual([])
  })
})
