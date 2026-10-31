# dsh-eyes

给 DSH 上的 AI 一双**持续**的眼睛。

单次截图 DSH 的 `computer` 工具本来就会。这个补的是“持续”：后台每 2 秒拍一张，只留最近 60 张，之后可以随时倒回去看“刚才屏幕上发生了什么”。

## 为什么

AI 没有时间感。它看不到“用户刚才那十分钟在干什么”，只能看到两条消息之间的空白。有了这串帧，至少能回放。

## 用法

工具名 `eyes`，四个动作：

| 动作 | 说明 |
| --- | --- |
| `start` | 开始后台截屏 |
| `stop` | 停止（会等它收尾，把最后几张留下） |
| `status` | 现在有几张、最后一张是什么时候 |
| `recent` | 拿最近 N 张的路径（配合 `read_image` 看） |

## 配置

```yaml
- id: eyes
  name: dsh-eyes
  config:
    interval: 2     # 每隔几秒截一张
    keep: 60        # 保留最近几张
    dir: ''         # 留空则用系统临时目录下的 fy-eyes
```

## 前置条件

- **Windows**（用 `System.Windows.Forms` + `System.Drawing` 截屏）
- 截图脚本 `scripts/capture.ps1` 随包携带，不需要另外准备
- 多显示器时**只截主屏**

## License

MIT
