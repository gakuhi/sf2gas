# sf2gas — Salesforce → Google Sheets 連携テンプレート

Salesforce のデータ（SOQL / 集計クエリ / Report API）を Google スプレッドシートに
定期的に書き出すための Google Apps Script (GAS) テンプレートです。

`CONFIG` に「どのデータを・どのシートに出すか」を宣言的に並べるだけで、
SOQL・集計分割・レポートの3種類の取得を1つのスプレッドシートにまとめて同期できます。

## 特徴

- **宣言的な設定**: [main.gs](main.gs) の `CONFIG` 配列に定義を追加するだけ
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
| `main.gs` | 取得定義 `CONFIG` とエントリポイント（`onOpen` / `syncAll` / `syncOne`） |
| `salesforce_auth.gs` | Salesforce 認証（Username-Password Flow、トークンをキャッシュ） |
| `salesforce_soql.gs` | SOQL 実行・ページング・分割実行・ネスト平坦化 |
| `salesforce_reports.gs` | Report API 実行とレスポンスのパース |
| `salesforce_report_describe.gs` | Report の describe（フィルタ条件等のメタデータ確認）デバッグ用 |
| `sheets_writer.gs` | シートへの列単位上書き書き込み |
| `state_store.gs` | 実行状態の保存（`StateStore`）とログ（`AppLogger`） |
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

### 2. スクリプトプロパティに認証情報を設定

Apps Script エディタの「プロジェクトの設定 → スクリプト プロパティ」で以下を設定します。

| プロパティ | 必須 | 説明 |
| --- | --- | --- |
| `SF_CLIENT_ID` | ✅ | 接続アプリケーションの Consumer Key |
| `SF_CLIENT_SECRET` | ✅ | 接続アプリケーションの Consumer Secret |
| `SF_USER_NAME` | ✅ | Salesforce ユーザー名 |
| `SF_PASSWORD` | ✅ | パスワード + セキュリティトークン（連結） |
| `SF_LOGIN_URL` | | 既定 `https://login.salesforce.com`（Sandbox は `https://test.salesforce.com`） |
| `SF_API_VERSION` | | 既定 `v60.0` |
| `SF_DESCRIBE_REPORT_ID` | | `describeReport_run` で確認したいレポート ID（任意） |

> 認証は Username-Password OAuth Flow を使用しています。接続アプリ側で
> 「OAuth 設定を有効化」し、コールバック URL とスコープ（`api` など）を設定してください。

### 3. 取得定義を書く

[main.gs](main.gs) の `CONFIG` を自分の組織のオブジェクト/項目に合わせて編集します。
テンプレートには `soql` / `soql_split` / `report` の3種類のサンプルが入っています。

### 4. 実行

- スプレッドシートを開くと「🚀 SF連携」メニューが表示されます
  - **認証テスト**: 認証情報の確認
  - **全シート更新 (syncAll)**: `CONFIG` 全件を同期
- 定期実行したい場合は、Apps Script の「トリガー」で `syncAll` を時間主導で設定してください
- 1シートだけ試したいときは、エディタで `debugSyncOne` の `targetSheetName` を変更して実行

## ライセンス

MIT
