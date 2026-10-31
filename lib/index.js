/**
 * dsh-feiyu-plugins —— 整合包入口。
 *
 * 装这一个包，三个工具一起进来：
 *   eyes          一双持续的眼睛（后台定时截屏，能回放"刚才屏幕上发生了什么"）
 *   usage         一本用量账本（读 DSH 的账，看花了多少 token 多少钱）
 *   backup_memory 一条保命线（打包备份，只留最近几份）
 *
 * 实现上没走捷径：直接复用同仓库里三个独立包的实现，
 * 这样"整合包"和"单独装某个包"用的是同一份代码，不会出现两套逻辑各说各话。
 */
import { apply as applyEyes } from '../dsh-eyes/lib/index.js'
import { apply as applyUsage } from '../dsh-usage/lib/index.js'
import { apply as applyBackup } from '../dsh-backup/lib/index.js'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 对应。 */
export const name = 'dsh-feiyu-plugins'

/** 依赖的服务：只用到工具注册表。 */
export const inject = ['tools']

export function apply(ctx, config) {
  const cfg = config || {}

  // 三个子包的配置键名不一样，这里翻译一下
  applyEyes(ctx, {
    interval: cfg.eyesInterval,
    keep: cfg.eyesKeep,
    dir: cfg.eyesDir,
  })

  applyUsage(ctx, {
    ledgerPath: cfg.ledgerPath,
  })

  applyBackup(ctx, {
    dest: cfg.backupDest,
    prefix: cfg.backupPrefix,
    keep: cfg.backupKeep,
    dirs: cfg.backupDirs,
    files: cfg.backupFiles,
  })
}
