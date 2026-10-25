import { describe, test, expect } from 'vitest'
import { DEX_LOOKAHEAD, dexKey, dexPage, dexShadows, monsterDex, newDexMonsters, upcomingMonsters } from './dex'
import { stageMinutesToWin } from './coach'
import { stageMonster, stageMonsterLook } from './endless'
import { MONSTERS } from './monsters'

describe('monsterDex 모은 몬스터', () => {
  test('아직 아무것도 못 깼으면 비어 있다', () => {
    expect(monsterDex(0)).toEqual({ entries: [], count: 0 })
    expect(monsterDex(Number.NaN).count).toBe(0)
    expect(monsterDex(-4).count).toBe(0)
  })

  test('깬 스테이지 몬스터를 처음 이긴 순서대로 모은다', () => {
    const dex = monsterDex(3)
    expect(dex.count).toBe(3)
    expect(dex.entries.map((e) => e.firstStage)).toEqual([1, 2, 3])
    expect(dex.entries.map((e) => e.monster.name)).toEqual([MONSTERS[0].name, MONSTERS[1].name, MONSTERS[2].name])
    expect(dex.entries.every((e) => !e.boss)).toBe(true)
  })

  test('보스도 모으고 보스라고 표시한다', () => {
    const dex = monsterDex(10)
    const king = dex.entries.find((e) => e.firstStage === 10)!
    expect(king.boss).toBe(true)
    expect(king.monster.name).toBe('왕 말랑')
  })

  test('모습이 같은 몬스터는 한 칸이고 처음 이긴 스테이지를 남긴다', () => {
    const n = 200
    const dex = monsterDex(n)
    const keys = dex.entries.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    // 모든 깬 스테이지의 모습이 도감에 있고, 처음 나온 스테이지가 적혀 있다
    for (let no = 1; no <= n; no++) {
      const entry = dex.entries.find((e) => e.key === dexKey(stageMonsterLook(no)))!
      expect(entry).toBeDefined()
      expect(entry.firstStage).toBeLessThanOrEqual(no)
    }
    // 같은 모습이 다시 나오는 경우가 있어서 칸 수가 스테이지 수보다 적다
    expect(dex.count).toBeLessThan(n)
    expect(dex.count).toBe(dex.entries.length)
  })

  test('더 깨면 도감은 줄지 않고 앞 칸은 그대로다', () => {
    const a = monsterDex(12)
    const b = monsterDex(25)
    expect(b.entries.slice(0, a.count)).toEqual(a.entries)
  })
})

test('모습만 따로 꺼내도 스테이지 몬스터와 같다', () => {
  for (const no of [1, 7, 10, 23, 60]) {
    const { stats: _stats, ...look } = stageMonster(no)
    expect(stageMonsterLook(no)).toEqual(look)
  }
})

describe('upcomingMonsters 다음에 만날 새 몬스터', () => {
  test('도감에 없는 모습만 다음 스테이지부터 차례로 고른다', () => {
    const next = upcomingMonsters(3, 3)
    expect(next.map((e) => e.firstStage)).toEqual([4, 5, 6])
    const owned = new Set(monsterDex(3).entries.map((e) => e.key))
    expect(next.every((e) => !owned.has(e.key))).toBe(true)
  })

  test('이미 모은 모습이 다시 나오는 스테이지는 건너뛴다', () => {
    const n = 200
    const owned = new Set(monsterDex(n).entries.map((e) => e.key))
    const next = upcomingMonsters(n, 3)
    for (const e of next) {
      expect(owned.has(e.key)).toBe(false)
      expect(dexKey(stageMonsterLook(e.firstStage))).toBe(e.key)
    }
    const stages = next.map((e) => e.firstStage)
    expect([...stages].sort((x, y) => x - y)).toEqual(stages)
    expect(new Set(next.map((e) => e.key)).size).toBe(next.length)
  })

  test('찾는 범위 안에서만 본다', () => {
    for (const e of upcomingMonsters(40, 5)) expect(e.firstStage).toBeLessThanOrEqual(40 + DEX_LOOKAHEAD)
  })
})

describe('dexShadows 그림자 칸', () => {
  test('다음 새 몬스터마다 운동 몇 분 더 하면 만나는지 알려 준다', () => {
    const minutes = { exercise: 0 }
    const shadows = dexShadows(minutes, [], 3, 3)
    expect(shadows).toHaveLength(3)
    for (const s of shadows) expect(s.toWin).toBe(stageMinutesToWin(minutes, [], s.firstStage))
    // 다음 스테이지는 처음부터 운동만 했을 때 조금 더 해야 한다
    expect(shadows[2].toWin!).toBeGreaterThan(0)
  })

  test('지금도 이길 만하면 0', () => {
    expect(dexShadows({ exercise: 0 }, [], 0, 1)[0]).toMatchObject({ firstStage: 1, toWin: 0 })
  })
})

describe('dexPage 장별로 나눠 보기', () => {
  test('고르지 않으면 지금 장, 그 장에서 처음 만난 몬스터만', () => {
    const page = dexPage(13)
    expect(page.chapter).toBe(2)
    expect(page.current).toBe(2)
    expect(page.prev).toBe(true)
    expect(page.next).toBe(false)
    expect(page.entries.length).toBeGreaterThan(0)
    expect(page.entries.every((e) => e.firstStage > 10 && e.firstStage <= 13)).toBe(true)
  })

  test('1장은 1~10스테이지에서 처음 만난 몬스터, 앞 장은 없다', () => {
    const page = dexPage(13, 1)
    expect(page.chapter).toBe(1)
    expect(page.prev).toBe(false)
    expect(page.next).toBe(true)
    expect(page.entries.map((e) => e.firstStage)).toEqual(monsterDex(10).entries.map((e) => e.firstStage))
  })

  test('장들을 모두 모으면 도감 전체와 같다', () => {
    const all = [1, 2, 3, 4, 5].flatMap((c) => dexPage(47, c).entries)
    expect(all).toEqual(monsterDex(47).entries)
  })

  test('지금 장 너머나 1보다 앞은 끝으로 맞춘다', () => {
    expect(dexPage(13, 9).chapter).toBe(2)
    expect(dexPage(13, 0).chapter).toBe(1)
    expect(dexPage(0).chapter).toBe(1)
    expect(dexPage(0).entries).toEqual([])
    expect(dexPage(10).chapter).toBe(2)
  })
})

describe('newDexMonsters 이번에 새로 모은 몬스터', () => {
  test('깬 스테이지가 늘며 도감에 처음 들어온 수를 센다', () => {
    expect(newDexMonsters(0, 1)).toBe(1)
    expect(newDexMonsters(0, 3)).toBe(3)
    expect(newDexMonsters(2, 25)).toBe(monsterDex(25).count - monsterDex(2).count)
  })

  test('그대로이거나 줄었으면 0', () => {
    expect(newDexMonsters(4, 4)).toBe(0)
    expect(newDexMonsters(6, 3)).toBe(0)
    expect(newDexMonsters(Number.NaN, 0)).toBe(0)
  })

  test('이미 모은 모습이 다시 나오는 스테이지를 깨면 세지 않는다', () => {
    let repeat = 0
    for (let no = 2; no <= 200 && !repeat; no++) {
      const keys = monsterDex(no - 1).entries.map((e) => e.key)
      if (keys.includes(dexKey(stageMonsterLook(no)))) repeat = no
    }
    expect(repeat).toBeGreaterThan(0)
    expect(newDexMonsters(repeat - 1, repeat)).toBe(0)
  })
})
