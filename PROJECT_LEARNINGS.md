# Project Learnings

BuyLensで再発防止価値の高い失敗・成功だけを記録する。

## Successes

### S-001 — Product と Research Snapshot を分離

- Date: 2026-08-31
- Problem / Goal: 再調査で価格・評価が変わっても過去調査の意味を失わない構造にする
- Adopted Pattern: 商品基本情報と調査Snapshotを別Object Storeへ保存
- Why it worked: 最新表示と履歴保持を両立でき、将来の価格履歴にも拡張しやすい
- Trade-off: 読み込み時に最新Snapshotを商品へ結合する処理が必要
- Reuse conditions: 時点によって意味が変わるAI分析や価格を扱う場合
- Related files: `SPEC.md`, `src/db.js`, `src/app.js`
- Guideへの還元候補: No（GuideのSnapshot原則を適用）

### S-002 — 予算を自動残高にしない

- Date: 2026-08-31
- Problem / Goal: BuyLensが把握していない収入・別支出により残高がズレるのを防ぐ
- Adopted Pattern: 現在予算はユーザー入力を正本とし、購入予定合計だけを派生表示
- Why it worked: 不完全な家計簿として振る舞わず、買い物判断に必要な情報だけを扱える
- Trade-off: 購入後に予算を更新する場合はユーザー操作が必要
- Reuse conditions: 金銭残高を外部口座と同期しない個人Tool
- Related files: `SPEC.md`, `src/app.js`
- Guideへの還元候補: No

## Failures

現時点ではなし。高コストBugが発生した場合に追記する。
