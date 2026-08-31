# 要件定義

## 0. Guide / Project Profile

- Adopted Guide Version: `1.10.0`
- Profiles: `STATIC + DATA + TOOL + AI-HANDOFF`

## 1. 目的

Amazon等で商品を買う際に、商品情報・ChatGPT調査結果・比較・自分の好み・現在予算を1か所へ保存し、購入判断の手間を減らす。

## 2. 使用者・公開範囲

- 使用者: 自分専用
- 主端末: PC
- 主ブラウザ: 現行Firefox / Chromium系を想定
- Offline: 読み込み済みページでは外部API不要。正式RuntimeはHTTP(S)

## 3. 必要機能

### MVP

- 商品登録 / 編集 / 削除
- 商品画像URL / 商品URL / 現在価格 / カテゴリ / メーカー / メモ
- ChatGPT調査結果の保存（特徴、メリット、デメリット、懸念、レビュー傾向、向いている人、自分との相性、評価、調査日）
- 商品状態管理
- 商品検索 / 状態フィルター
- 複数商品比較
- 比較グループ保存
- 比較結論（一番おすすめ / コスパ / 性能 / あえて選ばない）
- 自分の好み（共通 / カテゴリ別）
- 現在の買い物予算
- 購入予定合計 / 予定反映後予算の自動計算
- IndexedDB保存
- JSON Export / Import Backup
- Local Diagnostics

### 後回し

- Amazon等からの自動取り込み
- 自動価格監視 / セール通知
- 複数端末同期 / Supabase
- 購入後レビュー / 支出分析
- ChatGPT向けプロンプト・JSON連携の自動化強化

## 4. 主要利用フロー

```text
商品登録
↓
ChatGPT調査結果を保存
↓
比較対象を選択
↓
比較グループとして保存
↓
比較結果を確認
↓
状態を更新
↓
JSON Backup
```

## 5. 画面構成

| 画面 | 目的 | 主操作 | 重要状態 |
|---|---|---|---|
| 商品 | 候補を一覧管理 | 追加 / 編集 / 削除 / 比較選択 | Empty / Success / Error |
| 比較 | 候補を横並び比較 | グループ保存 / 結論保存 | Empty / Success |
| 好み | 判断基準を保存 | 共通 / カテゴリ別編集 | Success / Error |
| 設定 | 予算・Backup・Diagnostics | 予算変更 / Export / Import | Success / Error |

## 5A. Visual Design Direction

- Visual Quality重要度: high
- Design Concept: 買い物判断用ワークスペース。装飾より情報密度と比較速度を優先
- Layout Type: application shell + dense list/table
- Navigation Type: top navigation
- Content Density: medium-high
- Typography Direction: compact product UI
- Color Rule: neutral中心、状態・評価・予算にだけsemantic color
- Component Rule: 商品は画像付きlist/card、比較はtable、設定はsection
- Decorative Effect Policy: shadow/gradientは最小。境界・余白・背景差でHierarchyを作る
- Wireframeを先に作る: Yes
- 構造的に異なるDesign Directionを比較する: No（主要Workflowが明確な個人ToolのMVPを優先）
- 避けたいAI Template Pattern: 巨大Hero、全面Card Grid、Glass/Glow、過剰Gradient

## 6. データ構成

| データ | 正本 | Schema/ID | 想定最大量 |
|---|---|---|---|
| Products | IndexedDB `products` | UUID | 1,000 |
| Research snapshots | IndexedDB `researches` | UUID + productId | 10,000 |
| Comparison groups | IndexedDB `comparisonGroups` | UUID | 500 |
| Preferences | IndexedDB `preferences` | 固定ID + category | 100 |
| Settings | IndexedDB `settings` | key | 100 |
| Diagnostics | localStorage ring buffer | timestamp/id | 100 events |

## 7. 保存方法

- 本体: IndexedDB
- Backup: JSON Export / Import
- Import: 全体Validation後に1 transactionで置換
- Import失敗: transaction rollbackにより現行データを維持
- 画像: MVPでは画像URLのみ。画像Blob保存は将来対応
- 複数タブ競合: MVPでは警告のみを将来候補。高頻度同時編集は想定しない

## 8. Development Diagnostics / Project Memory

- `PROJECT_LEARNINGS.md`: Yes
- Runtime Diagnostics: Yes
- Breadcrumb: app init / product create-update-delete / group save / budget save / export / import
- Error: JavaScript / unhandled rejection / IndexedDB failure / import failure
- 保存先: localStorage
- 保持上限: 100 events
- Diagnostic Export: JSON Backupに含める
- 記録禁止: 入力本文、商品メモ本文、Token、Cookie、Authorization情報

## 9. 外部依存

- API / CDN / Auth / Cloud DB: なし
- Provider停止時: 影響なし

## 10. 崩してはいけない仕様

1. ユーザーデータをValidation前に破壊しない
2. 商品と調査Snapshotを別Storeとして扱う
3. 現在予算はユーザー入力値を正本とし、購入済み変更だけで自動減額しない
4. 外部サービス無しでもCore機能を利用可能にする

## 11. 高コスト設計判断

- 保存: IndexedDB + JSON Backup
- ID: `crypto.randomUUID()`を基本とする固定ID
- 通貨: MVPはJPY、整数円
- GitHub Pages: 対応する
- Migration: DB Version / Backup schemaVersionを持つ
- Page Structure: 1ページApp、4主要View

## 12. 変更可能範囲

### 原則として改善してよい

- UI密度
- フィルター / 並び替え
- 入力補助
- 比較表示

### 確認が必要

- 保存方式の変更
- Cloud導入
- 自動購入 / 自動外部送信
- Schema互換性を壊す変更

## 13. 性能・規模

- 商品: 1,000件程度までをMVP目安
- 調査Snapshot: 10,000件程度
- 外部画像: lazy loading
- 初期表示: 全商品metadataを読み込む。画像は遅延

## 14. 完成条件

- [ ] 商品登録 → 保存 → 再読込が通る
- [ ] 調査結果保存 → 商品表示に反映
- [ ] 2商品以上を比較できる
- [ ] 比較グループを保存・再読込できる
- [ ] 予算と購入予定合計が正しく計算される
- [ ] JSON Export / Importが通る
- [ ] 不正Importで現行データが消えない
- [ ] 空状態・エラー状態がある
- [ ] 主要ボタンが反応する
- [ ] 重大な横overflowがない（比較表は意図した内部scrollのみ）
- [ ] Static Validation成功
- [ ] README / SPEC / PROJECT_LEARNINGSと実装が一致

## 15. 未確認予定

- 実Firefox / Chromiumでの最終E2E
- GitHub Pages公開設定
