import { BASE_STAT } from './progression'
import { skillRanks } from './skills'
import type { MonsterTrait } from './traits'
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
  /** 치명타 확률(0~1). 몬스터는 없다 */
  crit?: number
  /** 날쌘(swift) 상대의 회피를 이만큼 깎는다. 말랑이의 집중에서 나온다 */
  accuracy?: number
  /** 몬스터 성격(`traits.ts`). 말랑이는 없다 */
  trait?: MonsterTrait
}

export interface BattleEvent {
  actor: 'player' | 'enemy'
  kind: 'hit' | 'miss'
  damage: number
  /** 치명타였는지. 치명타일 때만 붙는다 */
  crit?: boolean
  /** 단단한 상대의 방어를 치명타가 뚫었는지. 그럴 때만 붙는다 */
  pierce?: boolean
  /** 집중이 날쌘 상대의 회피를 깎지 않았다면 빗나갔을 공격인지. 그럴 때만 붙는다 */
  aimed?: boolean
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
const MAX_CRIT = 0.3
/** 집중으로 얻는 회피의 끝. 발 스킬 회피와 더해도 MAX_DODGE 를 넘지 않는다 */
export const MAX_FOCUS_DODGE = 0.2
/** 날쌘 발 한 단계마다 붙는 회피 */
export const QUICK_DODGE = 0.05
/** 치명타는 이만큼 곱해 아프다 */
const CRIT_MULTIPLIER = 1.5

/**
 * 능력치와 스킬로 말랑이의 전투 값을 만든다. 힘 → 공격, 체력 → HP·방어,
 * 지능 → 치명타(1마다 1%)와 요령(2마다 공격 +1, 4마다 방어 +1, 1마다 HP +2: 두루 조금씩).
 * 공부 10분(지능 +2)이 운동 10분(힘·체력 +1)만큼 되게 맞췄고, 치명타만큼 조금 더 낫다.
 * 스킬 단계와 곱하지 않아 오래 공부해도 운동보다 훨씬 앞서 가지 않는다.
 * 집중(독서)은 요령 대신 끈기로 같은 만큼 두루 오르고, 치명타 대신 회피(1마다 1%, 집중으로는 최대 20%)가 붙는다.
 * 지능·집중은 기본값을 넘은 만큼만 쳐서 운동만 한 말랑이는 예전 값 그대로다
 */
export function playerFighter(stats: Record<StatId, number>, skills: string[]): Fighter {
  const r = skillRanks(skills)
  const smart = Math.max(0, stats.int - BASE_STAT)
  const calm = Math.max(0, stats.focus - BASE_STAT)
  // 요령과 끈기는 같은 규칙이라 합쳐서 센다(나눠 내림하면 섞을 때 손해를 본다)
  const knack = smart + calm
  return {
    name: '말랑이',
    hp: 20 + stats.vit * 4 + knack * 2,
    atk: stats.str + r.punch * 2 + Math.floor(knack / 2),
    def: Math.floor(stats.vit / 2) + r.tough * 2 + Math.ceil(knack / 4),
    spd: 5 + r.quick * 2,
    dodge: Math.min(MAX_DODGE, r.quick * QUICK_DODGE + Math.min(MAX_FOCUS_DODGE, calm * 0.01)),
    crit: Math.min(MAX_CRIT, smart * 0.01),
    // 집중이 없으면 붙이지 않아 운동만 한 말랑이의 값은 예전 그대로다
    ...(calm > 0 ? { accuracy: Math.min(MAX_FOCUS_DODGE, calm * 0.01) } : {}),
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
      // 날쌘 상대는 집중으로 덜 피한다(주사위 수는 그대로)
      const dodge = side[target].trait === 'swift' ? Math.max(0, side[target].dodge - (side[actor].accuracy ?? 0)) : side[target].dodge
      const dodgeRoll = rand()
      if (dodgeRoll < dodge) {
        log.push({ actor, kind: 'miss', damage: 0, targetHp: hp[target] })
        continue
      }
      const spread = rand()
      const roll = (def: number) => {
        const baseDamage = Math.max(1, side[actor].atk - def)
        return baseDamage + Math.floor(spread * (Math.ceil(baseDamage * 0.2) + 1))
      }
      let damage = roll(side[target].def)
      // 치명타가 없는 쪽은 주사위를 굴리지 않아 같은 씨앗이면 예전과 같은 전투가 된다
      const critChance = side[actor].crit ?? 0
      const crit = critChance > 0 && rand() < critChance
      // 단단한 상대에게 치명타는 방어를 반만 받는다
      const pierce = crit && side[target].trait === 'sturdy' && side[target].def > 0
      if (pierce) damage = roll(Math.floor(side[target].def / 2))
      if (crit) damage = Math.floor(damage * CRIT_MULTIPLIER)
      hp[target] = Math.max(0, hp[target] - damage)
      const aimed = dodgeRoll < side[target].dodge
      log.push({ actor, kind: 'hit', damage, ...(crit ? { crit } : {}), ...(pierce ? { pierce } : {}), ...(aimed ? { aimed } : {}), targetHp: hp[target] })
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
