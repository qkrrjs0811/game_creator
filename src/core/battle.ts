import { skillRanks } from './skills'
import type { StatId } from './types'

/** 전투에 나서는 한 쪽. 몬스터 능력치는 `monsters.ts`에 있다 */
export interface Fighter {
  name: string
  hp: number
  atk: number
  def: number
  spd: number
  /** 공격을 피할 확률(0~1) */
  dodge: number
}

export interface BattleEvent {
  actor: 'player' | 'enemy'
  kind: 'hit' | 'miss'
  damage: number
  /** 맞은 쪽의 남은 HP */
  targetHp: number
}

export interface BattleResult {
  win: boolean
  rounds: number
  playerHp: number
  enemyHp: number
  log: BattleEvent[]
}

/** 이만큼 주고받아도 안 끝나면 진 것으로 본다 */
export const MAX_ROUNDS = 30
const MAX_DODGE = 0.5

/** 능력치와 스킬로 말랑이의 전투 값을 만든다. 힘 → 공격, 체력 → HP·방어 */
export function playerFighter(stats: Record<StatId, number>, skills: string[]): Fighter {
  const r = skillRanks(skills)
  return {
    name: '말랑이',
    hp: 20 + stats.vit * 4,
    atk: stats.str + r.punch * 2,
    def: Math.floor(stats.vit / 2) + r.tough * 2,
    spd: 5 + r.quick * 2,
    dodge: Math.min(MAX_DODGE, r.quick * 0.05),
  }
}

/** 씨앗으로 정해지는 난수(mulberry32). 같은 씨앗이면 같은 전투 */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 자동 전투. 성장 값은 만들지 않고 승패와 기록만 돌려준다 */
export function simulateBattle(player: Fighter, enemy: Fighter, seed: number): BattleResult {
  const rand = rng(seed)
  const hp = { player: Math.max(1, player.hp), enemy: Math.max(1, enemy.hp) }
  const side = { player, enemy }
  const order: ('player' | 'enemy')[] = enemy.spd > player.spd ? ['enemy', 'player'] : ['player', 'enemy']
  const log: BattleEvent[] = []
  let rounds = 0

  while (rounds < MAX_ROUNDS && hp.player > 0 && hp.enemy > 0) {
    rounds++
    for (const actor of order) {
      const target = actor === 'player' ? 'enemy' : 'player'
      if (rand() < side[target].dodge) {
        log.push({ actor, kind: 'miss', damage: 0, targetHp: hp[target] })
        continue
      }
      const baseDamage = Math.max(1, side[actor].atk - side[target].def)
      const damage = baseDamage + Math.floor(rand() * (Math.ceil(baseDamage * 0.2) + 1))
      hp[target] = Math.max(0, hp[target] - damage)
      log.push({ actor, kind: 'hit', damage, targetHp: hp[target] })
      if (hp[target] === 0) break
    }
  }

  return { win: hp.enemy === 0, rounds, playerHp: hp.player, enemyHp: hp.enemy, log }
}

/**
 * 몬스터 처음 HP를 몇 % 깎았는지(내림). 지더라도 얼마나 다가갔는지 보여 주는 데 쓴다.
 * 지면 조금이라도 깎았을 때 1 이상, 다 깎지 못했으니 99 이하로 맞춘다. 이기면 100
 */
export function enemyDamagePercent(enemy: Fighter, result: BattleResult): number {
  if (result.win) return 100
  const max = Math.max(1, enemy.hp)
  const dealt = Math.min(max, Math.max(0, max - result.enemyHp))
  if (dealt === 0) return 0
  return Math.min(99, Math.max(1, Math.floor((dealt / max) * 100)))
}
