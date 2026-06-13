/**
 * 取得定義の集中管理
 *
 * ここに「どのデータを・どのシートに出すか」を宣言的に並べます。
 * 各定義は type によって取得方法が変わります。
 *
 *   type: "soql"        … SOQL を1本実行する
 *   type: "soql_split"  … 集計(GROUP BY)クエリを splitBy.field の値ごとに分割実行して結合
 *                         （Salesforce 集計クエリの 2000 行上限を回避する用途）
 *   type: "report"      … Salesforce Report API でレポートを取得する
 *
 * 任意で fieldMap を付けると、SOQL の API 名を任意の列見出しにリネームできます。
 *
 * 下記はあくまでサンプルです。自分の組織のオブジェクト/項目に書き換えてください。
 */
const CONFIG = (function() {
  const config = [];

  // --- 例1: SOQL を1本実行する ---------------------------------------------
  config.push({
    sheetName: "Accounts",
    type: "soql",
    soql: "SELECT Id, Name, CreatedDate FROM Account WHERE CreatedDate = LAST_N_DAYS:30",
    // 任意: API名 -> シート見出し のリネーム
    fieldMap: {
      "Id": "アカウントID",
      "Name": "アカウント名",
      "CreatedDate": "作成日"
    }
  });

  // --- 例2: 集計クエリを分割実行する (soql_split) ---------------------------
  // soqlTemplate 内の "{SPLIT_FILTER}" が `AND <field> = <value>` に置換されます。
  // splitBy.field の distinct 値ごとにクエリを分けて実行し、結果を結合します。
  config.push({
    sheetName: "DailyCountByType",
    type: "soql_split",
    soqlTemplate:
      "SELECT DAY_ONLY(CreatedDate), Type, COUNT(Id) total FROM Account " +
      "WHERE IsDeleted = FALSE {SPLIT_FILTER} " +
      "GROUP BY DAY_ONLY(CreatedDate), Type ORDER BY DAY_ONLY(CreatedDate) DESC",
    splitBy: {
      field: "Type",
      fromObject: "Account",
      baseWhere: "IsDeleted = FALSE"
    }
  });

  // --- 例3: Salesforce Report を取得する -----------------------------------
  config.push({
    sheetName: "MyReport",
    type: "report",
    reportId: "00OXXXXXXXXXXXXXXX" // ← 自分のレポート ID に置き換え
  });

  return config;
})();

/**
 * メニューの作成
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 SF連携')
    .addItem('全シート更新 (syncAll)', 'syncAll')
    .addSeparator()
    .addItem('認証テスト', 'testAuth')
    .addToUi();
}

/**
 * 認証テスト用の関数
 */
function testAuth() {
  try {
    const auth = SalesforceAuth.getAccessToken();
    SpreadsheetApp.getUi().alert("認証成功！ InstanceURL: " + auth.instanceUrl);
  } catch (e) {
    SpreadsheetApp.getUi().alert("認証失敗: " + e.toString());
  }
}

/**
 * 全ての定義を更新
 * 分割実行を考慮し、途中で止まった場合は続きから再開するロジック
 */
function syncAll() {
  AppLogger.log("全件更新を開始します。");

  // 最後に成功したインデックスを取得
  let startIndex = parseInt(StateStore.get("CURRENT_INDEX") || "0");

  for (let i = startIndex; i < CONFIG.length; i++) {
    const def = CONFIG[i];

    try {
      syncOne(def.sheetName);
      StateStore.set("CURRENT_INDEX", (i + 1).toString());
    } catch (e) {
      AppLogger.error(`[${def.sheetName}] 更新失敗`, e);
      // エラー時は中断しエラーを通知（必要に応じて continue に変更）
      return;
    }
  }

  // 全て完了したらインデックスをクリア
  StateStore.clear("CURRENT_INDEX");
  AppLogger.log("全ての更新が正常に完了しました。");
}

/**
 * デバッグ用：特定の1シートだけを指定して実行
 * GASエディタ上の実行ボタンでこれを選択して実行してください
 */
function debugSyncOne() {
  // ここに実行したいシート名（CONFIG の sheetName）を入れてください
  const targetSheetName = "Accounts";

  try {
    syncOne(targetSheetName);
    SpreadsheetApp.getActiveSpreadsheet().toast(`${targetSheetName} の更新が完了しました。`);
  } catch (e) {
    AppLogger.error(`[${targetSheetName}] デバッグ実行失敗`, e);
    throw e;
  }
}

/**
 * 1つの定義を実行
 */
function syncOne(sheetName) {
  const def = CONFIG.find(c => c.sheetName === sheetName);
  if (!def) throw new Error(`定義が見つかりません: ${sheetName}`);

  AppLogger.log(`更新開始`, sheetName);
  const startTime = new Date();

  let data;
  if (def.type === "soql") {
    data = SalesforceSOQL.executeQuery(def.soql);
  } else if (def.type === "soql_split") {
    data = SalesforceSOQL.executeSplit(def.soqlTemplate, def.splitBy);
  } else if (def.type === "report") {
    data = SalesforceReports.executeReport(def.reportId);
  }

  if (def.fieldMap) {
    data = data.map(row => {
      const renamed = {};
      for (const k in row) {
        renamed[def.fieldMap[k] || k] = row[k];
      }
      return renamed;
    });
  }

  SheetsWriter.writeAsOverwrite(def.sheetName, data);

  const endTime = new Date();
  const diff = (endTime - startTime) / 1000;
  AppLogger.log(`更新完了 (${data.length}件, ${diff}秒)`, sheetName);
}
