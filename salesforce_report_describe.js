/**
 * Salesforce Report の describe API でメタデータ（フィルタ条件等）を取得して
 * コンソールに表示する。
 *
 * 使い方:
 *   describeReport_run() を実行すると、スクリプトプロパティ SF_DESCRIBE_REPORT_ID の
 *   レポート ID で describe を実行する。
 *   未設定の場合は REPORT_ID 定数を直接書き換えても良い。
 */

function describeReport_run() {
  const reportId =
    PropertiesService.getScriptProperties().getProperty("SF_DESCRIBE_REPORT_ID") ||
    ""; // ここに直書きしても OK (例: "00OXXXXXXXXXXXXXXX")

  if (!reportId) {
    throw new Error("レポート ID を SF_DESCRIBE_REPORT_ID に設定するか、コード内に直接記述してください。");
  }

  const meta = SalesforceReportDescribe.describe(reportId);
  SalesforceReportDescribe.logSummary(meta);
}

const SalesforceReportDescribe = {
  /**
   * describe エンドポイントを呼んでメタデータを取得
   * @param {string} reportId
   * @returns {Object} レスポンス JSON
   */
  describe: function(reportId) {
    const auth = SalesforceAuth.getAccessToken();
    const version = PropertiesService.getScriptProperties().getProperty("SF_API_VERSION") || "v60.0";

    const url = `${auth.instanceUrl}/services/data/${version}/analytics/reports/${reportId}/describe`;

    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        "Authorization": "Bearer " + auth.token,
        "Accept": "application/json"
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Report Describe API Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }

    return JSON.parse(response.getContentText());
  },

  /**
   * 取得したメタデータの要点をログ出力
   */
  logSummary: function(meta) {
    const rm = meta.reportMetadata || {};
    const rtm = meta.reportTypeMetadata || {};

    Logger.log("===== Report Describe Summary =====");
    Logger.log("name           : %s", rm.name);
    Logger.log("id             : %s", rm.id);
    Logger.log("reportFormat   : %s", rm.reportFormat);
    Logger.log("reportType     : %s", rm.reportType && rm.reportType.type);
    Logger.log("currency       : %s", rm.currency);
    Logger.log("scope          : %s", rm.scope);

    Logger.log("\n----- Standard Date Filter -----");
    if (rm.standardDateFilter) {
      Logger.log(JSON.stringify(rm.standardDateFilter, null, 2));
    } else {
      Logger.log("(none)");
    }

    Logger.log("\n----- Boolean Filter -----");
    Logger.log(rm.reportBooleanFilter || "(none)");

    Logger.log("\n----- Report Filters (%s) -----", (rm.reportFilters || []).length);
    (rm.reportFilters || []).forEach((f, i) => {
      Logger.log("  [%s] %s %s %s", i + 1, f.column, f.operator, f.value);
    });

    Logger.log("\n----- Standard Filters (%s) -----", (rm.standardFilters || []).length);
    (rm.standardFilters || []).forEach((f, i) => {
      Logger.log("  [%s] %s = %s", i + 1, f.name, f.value);
    });

    Logger.log("\n----- Cross Filters (%s) -----", (rm.crossFilters || []).length);
    (rm.crossFilters || []).forEach((f, i) => {
      Logger.log("  [%s] %s", i + 1, JSON.stringify(f));
    });

    Logger.log("\n----- Detail Columns (%s) -----", (rm.detailColumns || []).length);
    (rm.detailColumns || []).forEach(c => Logger.log("  - %s", c));

    Logger.log("\n----- Groupings Down (%s) -----", (rm.groupingsDown || []).length);
    (rm.groupingsDown || []).forEach(g => Logger.log("  - %s (%s)", g.name, g.sortOrder));

    Logger.log("\n----- Groupings Across (%s) -----", (rm.groupingsAcross || []).length);
    (rm.groupingsAcross || []).forEach(g => Logger.log("  - %s (%s)", g.name, g.sortOrder));

    Logger.log("\n----- Sort By -----");
    Logger.log(JSON.stringify(rm.sortBy || [], null, 2));

    Logger.log("\n===== Raw reportMetadata (JSON) =====");
    Logger.log(JSON.stringify(rm, null, 2));
  }
};
