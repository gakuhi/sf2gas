/**
 * SOQLの実行とページング処理を管理
 */
const SalesforceSOQL = {
  /**
   * SOQLを実行して全件取得
   * @param {string} soql
   * @returns {Array<Object>}
   */
  executeQuery: function(soql) {
    const auth = SalesforceAuth.getAccessToken();
    const version = PropertiesService.getScriptProperties().getProperty("SF_API_VERSION") || "v60.0";
    
    let allRecords = [];
    let url = `${auth.instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soql)}`;

    while (url) {
      const response = UrlFetchApp.fetch(url, {
        method: "get",
        headers: {
          "Authorization": "Bearer " + auth.token,
          "Content-Type": "application/json"
        },
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        throw new Error(`SOQL Error [${response.getResponseCode()}]: ${response.getContentText()}`);
      }

      const result = JSON.parse(response.getContentText());
      allRecords = allRecords.concat(result.records);

      // ページング処理 (nextRecordsUrlがある場合は次をリクエスト)
      if (result.nextRecordsUrl) {
        url = auth.instanceUrl + result.nextRecordsUrl;
      } else {
        url = null;
      }
    }

    // GROUP BY クエリの場合、階層を平坦化
    return this.flattenRecords(allRecords);
  },

  /**
   * 分割実行: splitBy.field の distinct 値ごとに soqlTemplate を実行して結果を結合
   * - 集計(GROUP BY)クエリの 2000 行上限を回避する用途
   * - soqlTemplate 内の "{SPLIT_FILTER}" を `AND <field> = <value>` に置換
   * @param {string} soqlTemplate
   * @param {{field:string, fromObject:string, baseWhere:string}} splitBy
   * @returns {Array<Object>}
   */
  executeSplit: function(soqlTemplate, splitBy) {
    const distinctSoql = `SELECT ${splitBy.field} FROM ${splitBy.fromObject} WHERE ${splitBy.baseWhere} GROUP BY ${splitBy.field}`;
    const distinctRecords = this.executeQuery(distinctSoql);

    let merged = [];
    distinctRecords.forEach(rec => {
      const val = rec[splitBy.field];
      const filter = (val === null || val === undefined)
        ? `AND ${splitBy.field} = null`
        : `AND ${splitBy.field} = '${String(val).replace(/'/g, "\\'")}'`;
      const soql = soqlTemplate.replace("{SPLIT_FILTER}", filter);
      merged = merged.concat(this.executeQuery(soql));
    });
    return merged;
  },

  /**
   * 集計クエリやリレーションのネストを平坦化（多段ネスト対応）
   * 例: { Account: { campaignSource__r: { Name: 'xxx' } } } -> { "Account.campaignSource__r.Name": 'xxx' }
   */
  flattenRecords: function(records) {
    return records.map(record => this._flatten(record, ''));
  },

  _flatten: function(obj, prefix) {
    const result = {};
    for (const key in obj) {
      if (key === 'attributes') continue;
      const newKey = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(result, this._flatten(val, newKey));
      } else {
        result[newKey] = val;
      }
    }
    return result;
  }
};
