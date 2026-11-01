/**
 * dsh-feiyu-plugins —— 整合包入口。
 *
 * 装这一个包，八个小东西一起进来：
 *
 * 【一档 · 补短，不需要 Python】
 *   eyes             一双持续的眼睛（后台定时截屏，能回放"刚才屏幕上发生了什么"）
 *   usage            一本用量账本（读 DSH 的账，看花了多少 token 多少钱）
 *   backup_memory    一条保命线（打包备份，只留最近几份）
 *
 * 【二档 · 感官，需要 Python】
 *   watch_video      看视频：抽帧 + 字幕条拼图
 *   transcribe       听声音：本地 faster-whisper 离线转写
 *   scan_sessions    翻自己的会话：查哪些聊过但没写进日记
 *   room_picture     把一间屋子画成图
 *   voice_profile    给一段声音做画像：每句多长、停多久、音高、语速
 *
 * 实现上没走捷径：每个子包都是独立的，`apply` 直接复用它们的实现，
 * 这样"整合包"和"单独装某个包"用的是同一份代码，不会两套逻辑各说各话。
 */
import { apply as applyEyes } from '../dsh-eyes/lib/index.js'
import { apply as applyUsage } from '../dsh-usage/lib/index.js'
import { apply as applyBackup } from '../dsh-backup/lib/index.js'
import { apply as applyWatch } from '../dsh-watch/lib/index.js'
import { apply as applyListen } from '../dsh-listen/lib/index.js'
import { apply as applySessions } from '../dsh-sessions/lib/index.js'
import { apply as applyRoom } from '../dsh-room/lib/index.js'
import { apply as applyVoiceProfile } from '../dsh-voiceprofile/lib/index.js'

/** Cordis 插件名，必须和 cordis.patch.yml 里的 id 对应。 */
export const name = 'dsh-feiyu-plugins'

/** 依赖的服务：只用到工具注册表。 */
export const inject = ['tools']

export function apply(ctx, config) {
  const cfg = config || {}

  // ---- 一档 ----
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

  // ---- 二档 ----
  // 五个都不吃配置：Python 解释器走环境变量 DSH_PYTHON
  applyWatch(ctx)
  applyListen(ctx)
  applySessions(ctx)
  applyRoom(ctx)
  applyVoiceProfile(ctx)
}
