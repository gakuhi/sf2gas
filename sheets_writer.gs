/**
 * シートへの書き込みを制御するクラス
 */
const SheetsWriter = {
  /**
   * データをシートに書き込む（カラム指定上書きモード）
   * - ヘッダー名が一致する列だけを更新する
   * - それ以外の列（手動の数式やメモ）は一切触らない
   * @param {string} sheetName 出力先シート名
   * @param {Array<Object>} data データの配列
   */
  writeAsOverwrite: function(sheetName, data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

    if (!data || data.length === 0) {
      Logger.log(`[${sheetName}] 書き込むデータがありません。`);
      return;
    }

    // 1. 今回のデータに含まれるヘッダー一覧
    const newHeaders = this.extractHeaders(data);
    
    // 2. シートの現在のヘッダーを取得
    let existingHeaders = [];
    if (sheet.getLastColumn() > 0) {
      existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // 3. 各項目の出力先列（インデックス）を特定
    const columnMapping = newHeaders.map(header => {
      let colIdx = existingHeaders.indexOf(header);
      if (colIdx === -1) {
        // 見つからない場合は右端に追加
        colIdx = existingHeaders.length;
        existingHeaders.push(header);
        sheet.getRange(1, colIdx + 1).setValue(header);
      }
      return { header: header, colIdx: colIdx + 1 };
    });

    // 4. データ行の清掃（Salesforce由来の列のみ、2行目から最終行まで）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      columnMapping.forEach(mapping => {
        sheet.getRange(2, mapping.colIdx, lastRow - 1, 1).clearContent();
      });
    }

    // 5. データの書き込み（Salesforce由来の列ごとに1列ずつ一括投入）
    // 数式列を保護するため、1列ごとに setValues を行います
    columnMapping.forEach(mapping => {
      const colValues = data.map(row => [this.toCellValue(row[mapping.header])]);

      if (colValues.length > 0) {
        const range = sheet.getRange(2, mapping.colIdx, colValues.length, 1);
        range.setValues(colValues);

        // Date列ならフォーマットを明示的に設定（既存の書式なしテキスト等を上書き）
        const dateFormat = this.detectDateFormat(colValues);
        if (dateFormat) {
          range.setNumberFormat(dateFormat);
        }
      }
    });

    Logger.log(`[${sheetName}] ${data.length} 件を更新しました。対象列: ${newHeaders.join(', ')}`);
  },

  /**
   * データから一意なヘッダーリストを抽出
   */
  extractHeaders: function(data) {
    const headerSet = new Set();
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'attributes') {
          headerSet.add(key);
        }
      });
    });
    return Array.from(headerSet);
  },

  /**
   * 列内のDate値を見て適切な番号フォーマットを返す
   * - 全部 date-only (時刻が 00:00:00) なら "yyyy-mm-dd"
   * - 時刻があれば "yyyy-mm-dd hh:mm:ss"
   * - Date が一つも無ければ null
   */
  detectDateFormat: function(colValues) {
    let hasDate = false;
    let hasTime = false;
    for (let i = 0; i < colValues.length; i++) {
      const v = colValues[i][0];
      if (v instanceof Date) {
        hasDate = true;
        if (v.getHours() !== 0 || v.getMinutes() !== 0 || v.getSeconds() !== 0) {
          hasTime = true;
        }
      }
    }
    if (!hasDate) return null;
    return hasTime ? "yyyy-mm-dd hh:mm:ss" : "yyyy-mm-dd";
  },

  /**
   * セルに入れる値に変換する
   * - ISOの date / datetime 文字列は Date オブジェクトに変換（シート側で日付として扱える）
   * - オブジェクトは JSON 文字列化
   * - null/undefined は空文字
   */
  toCellValue: function(val) {
    if (val === null || val === undefined) return "";
    if (val instanceof Date) return val;
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'string') {
      // YYYY-MM-DD (Date)
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
      if (dateOnly) {
        return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      }
      // YYYY-MM-DDTHH:mm:ss(.sss)?(Z|±HHMM|±HH:MM) (Datetime)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return val;
  }
};
