# BuyLens

自分専用の「買い物比較・欲しいもの管理サイト」。

## 目的

Amazonなどの商品を買うときに、商品情報・ChatGPTの調査結果・自分の好み・予算・比較結果を1か所へ整理し、「結局どれを買うか」を短時間で判断できるようにする。

## Guide / Project Profile

- Adopted Guide Version: `1.10.0`
- Profiles: `STATIC + DATA + TOOL + AI-HANDOFF`
- Source of Truth: [`EliteMay/web-project-guide`](https://github.com/EliteMay/web-project-guide)

## MVP

- 商品の登録 / 編集 / 削除
- 商品一覧 / 商品詳細
- ChatGPT調査結果の保存
- 状態管理（気になる / 比較中 / 欲しい / セール待ち / 購入予定 / 購入済み / 見送り）
- 比較グループ
- 横並び比較
- 自分の好み（共通 / カテゴリ別）
- 現在の買い物予算
- 購入予定合計と予定反映後予算
- IndexedDB保存
- JSON Export / Import Backup
- Local diagnostics

## 保存

本体データはブラウザの `IndexedDB` に保存する。JSON Export / Importをバックアップ手段として用意する。

クラウド同期、Amazon自動取得、価格監視はMVP外。

## 開発

静的HTML / CSS / JavaScriptで構成し、GitHub Pagesでの利用を想定する。

`index.html` をHTTP(S)経由で開くこと。IndexedDBを安定して利用するため、`file://` 直開きは正式Runtimeとして扱わない。

## 主要フロー

```text
商品を登録
↓
ChatGPT調査結果を保存
↓
比較グループへ追加
↓
比較
↓
状態を決定
↓
JSONでバックアップ
```

## 文書

- [`REQUIREMENTS.md`](REQUIREMENTS.md)
- [`SPEC.md`](SPEC.md)
- [`PROJECT_LEARNINGS.md`](PROJECT_LEARNINGS.md)

## 未実装 / 将来候補

- 商品情報の自動取り込み
- 価格履歴 / セール通知
- Supabase等による複数端末同期
- 購入後レビュー
- 支出集計
- ChatGPT用プロンプト自動生成 / 固定JSON連携の強化
