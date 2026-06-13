/**
 * Salesforce Report API を管理
 */
const SalesforceReports = {
  /**
   * レポートを実行してデータを取得
   * @param {string} reportId
   * @returns {Array<Object>}
   */
  executeReport: function(reportId) {
    const auth = SalesforceAuth.getAccessToken();
    const version = PropertiesService.getScriptProperties().getProperty("SF_API_VERSION") || "v60.0";
    
    const url = `${auth.instanceUrl}/services/data/${version}/analytics/reports/${reportId}?includeDetails=true`;
    
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        "Authorization": "Bearer " + auth.token,
        "Accept": "application/json"
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(`Report API Error [${response.getResponseCode()}]: ${response.getContentText()}`);
    }

    const data = JSON.parse(response.getContentText());
    return this.parseReportResponse(data);
  },

  /**
   * レポートJSONからデータの配列を生成
   * 基本的に表形式(Tabular)を想定
   */
  parseReportResponse: function(res) {
    const reportRows = res.factMap["T!T"].rows;
    const columns = res.reportMetadata.detailColumns;
    
    // カラムのラベルマップ作成
    const columnInfo = res.reportExtendedMetadata.detailColumnInfo;

    return reportRows.map(row => {
      const entry = {};
      row.dataCells.forEach((cell, index) => {
        const colName = columns[index];
        const label = columnInfo[colName] ? columnInfo[colName].label : colName;
        // 名前（表示値）を取得するように変更
        entry[label] = cell.label;
      });
      return entry;
    });
  }
};
