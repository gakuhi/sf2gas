/**
 * Salesforce API への認証を管理 (Username-Password Flow)
 */
const SalesforceAuth = {
  /**
   * アクセストークンを取得
   */
  getAccessToken: function() {
    const props = PropertiesService.getScriptProperties().getProperties();
    
    // スクリプトのキャッシュをチェック
    const cache = CacheService.getScriptCache();
    const cachedToken = cache.get("SF_ACCESS_TOKEN");
    if (cachedToken) {
      return {
        token: cachedToken,
        instanceUrl: props.SF_INSTANCE_URL
      };
    }

    // キャッシュがない場合は新規取得
    return this.authenticateWithPassword();
  },

  /**
   * ユーザー名とパスワードで認証
   */
  authenticateWithPassword: function() {
    const props = PropertiesService.getScriptProperties().getProperties();
    const clientId = props.SF_CLIENT_ID;
    const clientSecret = props.SF_CLIENT_SECRET;
    const userName = props.SF_USER_NAME;
    const password = props.SF_PASSWORD; // パスワード + セキュリティトークン
    const loginUrl = props.SF_LOGIN_URL || "https://login.salesforce.com";

    if (!clientId || !clientSecret || !userName || !password) {
      throw new Error("認証設定(SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USER_NAME, SF_PASSWORD)が不足しています。");
    }

    const payload = {
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
      username: userName,
      password: password
    };

    const options = {
      method: "post",
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(`${loginUrl}/services/oauth2/token`, options);
    const resContent = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      throw new Error("Authentication Failed: " + response.getContentText());
    }

    // 次回のためにキャッシュに保存 (約50分)
    CacheService.getScriptCache().put("SF_ACCESS_TOKEN", resContent.access_token, 3000);
    
    // インスタンスURLを保存
    PropertiesService.getScriptProperties().setProperty("SF_INSTANCE_URL", resContent.instance_url);

    return {
      token: resContent.access_token,
      instanceUrl: resContent.instance_url
    };
  }
};
