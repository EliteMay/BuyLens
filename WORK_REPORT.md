# Work Report — BuyLens MVP v0.1

Date: 2026-08-31

## 目的

BuyLensの最初の実用MVPとして、次の主要フローをGitHub上へ実装する。

```text
商品を登録
→ ChatGPT調査結果を保存
→ 比較する
→ 状態と結論を管理
→ 予算を確認
→ JSON Backup
```

## 採用Guide

- `EliteMay/web-project-guide` v1.10.0
- Profiles: `STATIC + DATA + TOOL + AI-HANDOFF`

## 実装内容

- 商品の登録 / 編集 / 削除
- 商品画像URL / 商品URL / 価格 / カテゴリ / メーカー / メモ
- 7種類の商品状態
- ChatGPT調査結果を商品本体と分離したSnapshotとして保存
- 商品一覧で価格・状態・総合評価・コスパ・性能・相性・メリット・デメリットを確認
- 検索 / 状態Filter / 並び替え
- 最大4商品を横並び比較
- 比較グループ保存
- 一番おすすめ / コスパ重視 / 性能重視 / あえて選ばない / 結論メモ
- 共通 / カテゴリ別の買い物好み
- 現在の買い物予算
- 購入予定商品の合計
- 予定反映後の残り予算
- IndexedDBによるLocal-first保存
- JSON Backup Export / Import
- Import全体Validation + IndexedDB transaction rollback
- Local diagnostics ring buffer（最大100件）
- PC中心 + mobile responsive UI
- GitHub Actions Static Validation

## 保存仕様

- Core data: IndexedDB `buylens` schema v1
- Backup: BuyLens JSON schema v1
- Diagnostics: localStorage, max 100 entries
- Cloud / Auth / Amazon API: MVPでは未使用

### 予算

現在予算はユーザー入力値を正本とする。

```text
予定反映後 = 現在予算 - status=購入予定 の商品価格合計
```

商品を「購入済み」にしただけでは現在予算を自動減額しない。

## 変更経路

- Initial README commit
- `build/mvp-v0.1` branch
- PR #1 `Build BuyLens MVP v0.1`
- Static validation成功後にSquash Merge

## Validation

Final main commit `2baa0ceb10eea1c7a539a0979986f3942c1a4494` で GitHub Actions `Validate BuyLens` を実行。

成功:

- `node --check src/db.js`
- `node --check src/app.js`
- `node tests/validate.mjs`

## 未確認

- Firefox / Chromium実ブラウザでのE2E操作確認
- IndexedDB Backup → Restoreの実ブラウザRegression
- 320px〜DesktopでのVisual Review
- GitHub Pages公開設定

これらは未確認のため、実機確認済みとは扱わない。

## 次に優先する候補

1. GitHub Pages公開 + 実ブラウザE2E
2. 実際の商品を数件入れて一覧 / 比較UIを調整
3. ChatGPT調査結果を貼り付けやすい固定JSON Import / Prompt生成
4. 必要性を確認してから価格履歴・購入後レビュー等を追加
