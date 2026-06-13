# sf2gas — Salesforce → Google Sheets 連携テンプレート

Salesforce のデータ（SOQL / 集計クエリ / Report API）を Google スプレッドシートに
定期的に書き出すための Google Apps Script (GAS) テンプレートです。

`CONFIG` に「どのデータを・どのシートに出すか」を宣言的に並べるだけで、
SOQL・集計分割・レポートの3種類の取得を1つのスプレッドシートにまとめて同期できます。

## 特徴

- **宣言的な設定**: [main.js](main.js) の `CONFIG` 配列に定義を追加するだけ
- **3つの取得方法**
  - `soql`: SOQL を1本実行
  - `soql_split`: 集計(GROUP BY)クエリを項目値ごとに分割実行（集計の 2000 行上限回避）
  - `report`: Salesforce Report API でレポートを取得
- **数式・メモ列の保護**: 既存ヘッダーに一致する列だけを上書きするので、シート上の手動の数式やメモは触りません
- **途中再開**: `syncAll` は最後に成功した位置を記録し、途中で止まっても続きから再開します
- **日付の自動変換**: ISO 日付/日時の文字列を Date 型に変換し、列の書式も自動設定します

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `main.js` | 取得定義 `CONFIG` とエントリポイント（`onOpen` / `syncAll` / `syncOne`） |
| `salesforce_auth.js` | Salesforce 認証（OAuth 2.0 Client Credentials Flow、トークンをキャッシュ） |
| `salesforce_soql.js` | SOQL 実行・ページング・分割実行・ネスト平坦化 |
| `salesforce_reports.js` | Report API 実行とレスポンスのパース |
| `salesforce_report_describe.js` | Report の describe（フィルタ条件等のメタデータ確認）デバッグ用 |
| `sheets_writer.js` | シートへの列単位上書き書き込み |
| `state_store.js` | 実行状態の保存（`StateStore`）とログ（`AppLogger`） |
| `appsscript.json` | GAS のマニフェスト |

## セットアップ

### 1. Apps Script プロジェクトを用意

スプレッドシートの「拡張機能 → Apps Script」から、または
[clasp](https://github.com/google/clasp) でプロジェクトを作成します。

clasp を使う場合:

```bash
npm install -g @google/clasp
clasp login

# このテンプレートをコードとして push する
cp .clasp.json.example .clasp.json
# .clasp.json の scriptId を自分のプロジェクト ID に書き換えてから:
clasp push
```

### 2. 接続アプリケーション（Client Credentials Flow）を設定

Salesforce 側で接続アプリケーションを作成し、以下を有効化します。

- 「OAuth 設定を有効化」にチェック
- **Client Credentials Flow を有効化**し、**実行ユーザー (Run-As User)** を割り当て
- OAuth スコープに `api`（必要に応じて追加権限）を付与
- 発行された Consumer Key / Consumer Secret を控える

> この方式はユーザー名/パスワードを使いません。サーバー間連携・定期実行向けです。

### 3. スクリプトプロパティに認証情報を設定

Apps Script エディタの「プロジェクトの設定 → スクリプト プロパティ」で以下を設定します。

| プロパティ | 必須 | 説明 |
| --- | --- | --- |
| `SF_CLIENT_ID` | ✅ | 接続アプリケーションの Consumer Key |
| `SF_CLIENT_SECRET` | ✅ | 接続アプリケーションの Consumer Secret |
| `SF_LOGIN_URL` | ✅ | My Domain の URL（例 `https://your-domain.my.salesforce.com`）。Client Credentials Flow はトークン取得に My Domain ホストを使います |
| `SF_API_VERSION` | | 既定 `v60.0` |
| `SF_DESCRIBE_REPORT_ID` | | `describeReport_run` で確認したいレポート ID（任意） |

### 4. 取得定義を書く

[main.js](main.js) の `CONFIG` を自分の組織のオブジェクト/項目に合わせて編集します。
テンプレートには `soql` / `soql_split` / `report` の3種類のサンプルが入っています。

### 5. 実行

- スプレッドシートを開くと「🚀 SF連携」メニューが表示されます
  - **認証テスト**: 認証情報の確認
  - **全シート更新 (syncAll)**: `CONFIG` 全件を同期
- 定期実行したい場合は、Apps Script の「トリガー」で `syncAll` を時間主導で設定してください
- 1シートだけ試したいときは、エディタで `debugSyncOne` の `targetSheetName` を変更して実行

## ライセンス

MIT
