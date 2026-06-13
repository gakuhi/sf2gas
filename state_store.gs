/**
 * 実行状態の保存（分割実行用）
 */
const StateStore = {
  get: function(key) {
    return PropertiesService.getScriptProperties().getProperty("STATE_" + key);
  },
  set: function(key, value) {
    PropertiesService.getScriptProperties().setProperty("STATE_" + key, value);
  },
  clear: function(key) {
    PropertiesService.getScriptProperties().deleteProperty("STATE_" + key);
  }
};

/**
 * ログ・通知管理
 */
const AppLogger = {
  log: function(message, sheetName = "SYSTEM") {
    const timestamp = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss");
    const fullMessage = `[${timestamp}][${sheetName}] ${message}`;
    Logger.log(fullMessage);
    
    // TODO: ここに実行ログ専用シートへの書き込みや、Slack通地のロジックを追加可能
  },
  
  error: function(message, error, sheetName = "ERROR") {
    this.log(`FAILED: ${message} - ${error.toString()}`, sheetName);
    // TODO: 管理者へのメール通知等のTODO
  }
};
