import { describe, test, expect } from 'vitest'
import { SKILLS, learnSkill, remainingSkillPoints, skillRanks } from './skills'
import { newSave } from './session'

describe('SKILLS', () => {
  test('스킬은 3종', () => {
    expect(SKILLS).toHaveLength(3)
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(3)
  })
})

describe('remainingSkillPoints', () => {
  test('남은 포인트 = 레벨 - 1 - 배운 스킬 수', () => {
    expect(remainingSkillPoints(1, [])).toBe(0)
    expect(remainingSkillPoints(4, [])).toBe(3)
    expect(remainingSkillPoints(4, ['punch', 'tough'])).toBe(1)
  })

  test('배운 수가 더 많아도(이상한 백업) 0 아래로 내려가지 않음', () => {
    expect(remainingSkillPoints(2, ['punch', 'punch', 'tough'])).toBe(0)
  })
})

describe('skillRanks', () => {
  test('같은 스킬을 여러 번 배우면 단계가 오른다', () => {
    expect(skillRanks(['punch', 'tough', 'punch'])).toEqual({ punch: 2, tough: 1, quick: 0 })
  })

  test('모르는 스킬 이름은 단계에 넣지 않는다', () => {
    expect(skillRanks(['punch', 'fly'])).toEqual({ punch: 1, tough: 0, quick: 0 })
  })
})

describe('learnSkill', () => {
  test('포인트가 있으면 skills 끝에 붙인 새 저장', () => {
    const save = newSave()
    const next = learnSkill(save, 3, 'quick')
    expect(next?.skills).toEqual(['quick'])
    expect(save.skills).toEqual([])
    expect(learnSkill(next!, 3, 'quick')?.skills).toEqual(['quick', 'quick'])
  })

  test('포인트가 없으면 null', () => {
    expect(learnSkill(newSave(), 1, 'punch')).toBeNull()
    expect(learnSkill({ ...newSave(), skills: ['punch'] }, 2, 'tough')).toBeNull()
  })

  test('없는 스킬은 null', () => {
    expect(learnSkill(newSave(), 5, 'fly')).toBeNull()
  })

  test('기록은 건드리지 않는다', () => {
    const save = { ...newSave(), records: [{ id: 'a', activity: 'exercise' as const, startedAt: 0, endedAt: 60_000 }] }
    expect(learnSkill(save, 2, 'punch')?.records).toBe(save.records)
  })
})
