# BuyLens Specification

## 1. Runtime

- Static HTML / CSS / ES Modules
- No framework / no external runtime dependency
- Formal runtime: HTTP(S), intended for GitHub Pages
- Storage: IndexedDB
- Backup: JSON file

## 2. Navigation

Single page application with four views:

1. `products` — 商品一覧 / 登録 / 編集
2. `compare` — 比較対象 / 比較グループ / 結論
3. `preferences` — 共通・カテゴリ別の好み
4. `settings` — 予算 / Backup / Diagnostics

## 3. Product

```js
{
  id,
  name,
  imageUrl,
  productUrl,
  currentPrice,
  currency: "JPY",
  category,
  manufacturer,
  status,
  memo,
  createdAt,
  updatedAt
}
```

Allowed `status`:

- `interested` 気になる
- `comparing` 比較中
- `wanted` 欲しい
- `sale_wait` セール待ち
- `planned` 購入予定
- `purchased` 購入済み
- `skipped` 見送り

## 4. Research Snapshot

商品本体とは分離し、再調査時に履歴を残せる構造にする。

```js
{
  id,
  productId,
  price,
  features: [],
  pros: [],
  cons: [],
  concerns: [],
  reviewSummary,
  recommendedFor: [],
  personalFit,
  overallScore,
  valueScore,
  performanceScore,
  fitScore,
  researchedAt,
  createdAt
}
```

一覧 / 比較では `researchedAt` が最新のSnapshotを利用する。

## 5. Comparison Group

```js
{
  id,
  name,
  productIds: [],
  summary: {
    bestOverall,
    bestValue,
    bestPerformance,
    avoid,
    note
  },
  createdAt,
  updatedAt
}
```

- 比較対象は2〜4商品を基本UIとする
- 4件を超えてもデータとしては保持可能だが、MVP UIでは4件まで選択
- 比較表は横scrollを許可し、項目列はstickyにする

## 6. Preferences

Common profile:

```js
{
  id: "common",
  scope: "common",
  category: null,
  weights: {
    price: 4,
    performance: 4,
    value: 5,
    design: 3,
    durability: 4,
    size: 3,
    material: 3
  },
  priorities: [],
  avoid: [],
  updatedAt
}
```

Category profile uses `id: "category:<category>"`.

## 7. Budget

Setting key: `budget`

```js
{
  key: "budget",
  amount: 50000,
  currency: "JPY",
  updatedAt
}
```

Calculated values:

```text
plannedTotal = sum(product.currentPrice where status === "planned")
remainingAfterPlan = budget.amount - plannedTotal
```

Budget is **not** automatically decreased when a product becomes purchased.

## 8. IndexedDB

Database: `buylens`
Version: `1`

Object stores:

- `products` (`keyPath: id`)
- `researches` (`keyPath: id`, index: `productId`)
- `comparisonGroups` (`keyPath: id`)
- `preferences` (`keyPath: id`)
- `settings` (`keyPath: key`)

## 9. Backup Schema

```js
{
  app: "BuyLens",
  schemaVersion: 1,
  exportedAt,
  data: {
    products: [],
    researches: [],
    comparisonGroups: [],
    preferences: [],
    settings: []
  },
  diagnostics: []
}
```

### Import sequence

1. JSON parse
2. top-level validation
3. all stores validation
4. one IndexedDB readwrite transaction
5. clear target stores
6. add imported records
7. transaction commit
8. reload state

Invalid JSON / schema mismatch must not clear current data.

## 10. Diagnostics

Storage: `localStorage` key `buylens:diagnostics:v1`

- ring buffer max 100
- event shape: `{ id, at, level, action, meta }`
- `meta` may contain ids / counts / route / error type only
- do not log free-form product memo, preference text, token, cookie or credential values

## 11. UI rules

- Desktop first, responsive down to mobile widths
- Neutral shell; semantic colors only for statuses / warnings / positive-negative comparison
- Product list must expose image, name, price, score, top pros/cons, status without opening detail
- Empty states include a recovery action
- Modals support Escape close and visible focus
- External product links open in new tab with `rel="noopener noreferrer"`

## 12. Future-compatible boundaries

- Product source scraping/API must be introduced behind an adapter; UI must not depend directly on Amazon
- Cloud sync must not replace IndexedDB without migration/backup design
- Local image upload may use IndexedDB Blob in a later schema version
