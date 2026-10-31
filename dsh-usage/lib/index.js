/**
 * dsh-usage —— 一本用量账。
 *
 * 直接读 DSH 自己的用量账本 JSON（不走 Python，更快也更稳）。
 * 账本路径默认 ~/.dsh/dsh-usage/usage-ledger.json，可以用配置覆盖。
 *
 * 为什么值得做：用户拿它判断"值不值"，AI 拿它判断"是不是在瞎烧"。
 * 同一本账，两种用法。
 *
 * 注意：这个工具只**读**账本，不记账。没有账本时会明确报错并给出路径。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 对应。 */
export const name = 'dsh-usage'

/** 依赖的服务：只用到工具注册表。 */
export const inject = ['tools']

const TOKEN_KEYS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens']

function emptyBucket() {
  const b = { calls: 0, cost: 0 }
  for (const k of TOKEN_KEYS) b[k] = 0
  return b
}

function addTo(bucket, v) {
  for (const k of TOKEN_KEYS) bucket[k] += Number(v[k] || 0)
  bucket.calls += Number(v.calls || 0)
  bucket.cost += Number(v.cost || 0)
}

function tokensOf(b) {
  return b.inputTokens + b.outputTokens + b.cacheReadTokens
}

function summarize(days) {
  const total = emptyBucket()
  const byModel = new Map()
  const byDay = []

  for (const day of Object.keys(days).sort()) {
    const dayBucket = emptyBucket()
    for (const prov of Object.keys(days[day] || {})) {
      for (const model of Object.keys(days[day][prov] || {})) {
        const v = days[day][prov][model]
        addTo(dayBucket, v)
        addTo(total, v)
        const key = prov + '/' + model
        if (!byModel.has(key)) byModel.set(key, emptyBucket())
        addTo(byModel.get(key), v)
      }
    }
    byDay.push({ day, tokens: tokensOf(dayBucket), calls: dayBucket.calls, cost: dayBucket.cost })
  }

  const models = [...byModel.entries()]
    .map(([m, b]) => ({ model: m, tokens: tokensOf(b), calls: b.calls, cost: b.cost }))
    .sort((a, b) => b.cost - a.cost)

  return {
    dayCount: byDay.length,
    from: byDay.length ? byDay[0].day : '',
    to: byDay.length ? byDay[byDay.length - 1].day : '',
    total: { tokens: tokensOf(total), calls: total.calls, cost: total.cost },
    models: models.slice(0, 10),
    days: byDay.slice(-8),
  }
}

export function apply(ctx, config) {
  const cfg = config || {}
  const ledgerPath = cfg.ledgerPath || join(homedir(), '.dsh', 'dsh-usage', 'usage-ledger.json')

  function readLedger() {
    if (!existsSync(ledgerPath)) {
      throw new Error(
        '找不到用量账本：' + ledgerPath +
        '\n这个工具只读不写，需要 DSH 自己的用量统计在往这个文件里记账。' +
        '\n如果账本在别处，可以在插件配置里指定 ledgerPath。',
      )
    }
    const data = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    if (!data || !data.days) throw new Error('账本格式不对（没有 days 字段）：' + ledgerPath)
    return data.days
  }

  ctx.tools.register(
    defineTool({
      name: 'usage',
      description:
        '看自己的用量账：累计 token、调用次数、花了多少钱，以及按模型和最近几天的分布。想知道"最近烧了多少"时用这个。',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            dayCount: { type: 'integer', required: true },
            from: { type: 'string', required: true },
            to: { type: 'string', required: true },
            total: {
              type: 'object',
              required: true,
              additionalProperties: false,
              properties: {
                tokens: { type: 'integer', required: true },
                calls: { type: 'integer', required: true },
                cost: { type: 'number', required: true },
              },
            },
            models: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  model: { type: 'string', required: true },
                  tokens: { type: 'integer', required: true },
                  calls: { type: 'integer', required: true },
                  cost: { type: 'number', required: true },
                },
              },
            },
            days: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  day: { type: 'string', required: true },
                  tokens: { type: 'integer', required: true },
                  calls: { type: 'integer', required: true },
                  cost: { type: 'number', required: true },
                },
              },
            },
          },
        },
        render: (_args, value) => {
          const lines = [
            '累计 ' + value.dayCount + ' 天（' + value.from + ' ~ ' + value.to + '）',
            '合计 ' + value.total.tokens.toLocaleString() + ' tokens，' +
              value.total.calls.toLocaleString() + ' 次调用，¥' + value.total.cost.toFixed(2),
            '',
            '按模型：',
            ...value.models.map((m) => '  ' + m.model + '  ' + m.tokens.toLocaleString() + ' tok  ¥' + m.cost.toFixed(2)),
            '',
            '最近几天：',
            ...value.days.map((d) => '  ' + d.day + '  ' + d.tokens.toLocaleString() + ' tok  ¥' + d.cost.toFixed(2)),
          ]
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      async execute() {
        const days = readLedger()
        const s = summarize(days)
        if (!s.dayCount) throw new Error('账本里还没有任何记录：' + ledgerPath)
        return { ok: true, ...s }
      },
    }),
  )
}
