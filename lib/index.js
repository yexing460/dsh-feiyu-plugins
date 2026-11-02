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
 * ⚠️ 2026-11-02 两处修正：
 *   1. apply 必须是**同步**的。之前试过 async，别的插件全是同步，风险太大。
 *   2. 每个子包单独 try。之前八条静态 import 里只要缺一个子目录
 *      （GitHub 装下来的包二档五个目录是缺的），整包加载就全崩，
 *      连一档三个工具也一起消失，使用者完全看不出为什么。
 *      现在缺的跳过、重复注册的也跳过，其余照常装。
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
  const failed = []

  /** 一个子包装不上，不该连累别人。 */
  const run = (key, fn, sub) => {
    try {
      fn(ctx, sub)
    } catch (e) {
      failed.push(key + '：' + ((e && e.message) || e))
    }
  }

  // ---- 一档 ----
  // 三个子包的配置键名不一样，这里翻译一下
  run('eyes', applyEyes, {
    interval: cfg.eyesInterval,
    keepMinutes: cfg.eyesKeepMinutes,
    keep: cfg.eyesKeep,
    dir: cfg.eyesDir,
  })

  run('usage', applyUsage, {
    ledgerPath: cfg.ledgerPath,
  })

  run('backup_memory', applyBackup, {
    dest: cfg.backupDest,
    prefix: cfg.backupPrefix,
    keep: cfg.backupKeep,
    dirs: cfg.backupDirs,
    files: cfg.backupFiles,
  })

  // ---- 二档 ----
  // 五个都不吃配置：Python 解释器走环境变量 DSH_PYTHON
  run('watch_video', applyWatch)
  run('transcribe', applyListen)
  run('scan_sessions', applySessions)
  run('room_picture', applyRoom)
  run('voice_profile', applyVoiceProfile)

  if (failed.length) {
    const msg = '[dsh-feiyu-plugins] 有 ' + failed.length + ' 个没装上：\n  ' + failed.join('\n  ')
    if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(msg)
    else console.warn(msg)
  }
}
