/**
 * Salesforce API への認証を管理 (OAuth 2.0 Client Credentials Flow)
 *
 * 接続アプリケーション側の前提:
 *   - 「OAuth 設定を有効化」し、Client Credentials Flow を有効化していること
 *   - 実行ユーザー (Run-As User) を割り当てていること
 *   - スコープに `api`（必要に応じて `refresh_token` 以外の権限）を含めること
 *
 * この方式はユーザー名/パスワードを使いません。client_id / client_secret のみで
 * トークンを取得します（サーバー間連携・定期実行向け）。
 */
const SalesforceAuth = {
  /**
   * アクセストークンを取得（キャッシュがあれば再利用）
   */
  getAccessToken: function() {
    const props = PropertiesService.getScriptProperties().getProperties();

    // スクリプトのキャッシュをチェック
    const cache = CacheService.getScriptCache();
    const cachedToken = cache.get("SF_ACCESS_TOKEN");
    const cachedInstanceUrl = props.SF_INSTANCE_URL;
    if (cachedToken && cachedInstanceUrl) {
      return {
        token: cachedToken,
        instanceUrl: cachedInstanceUrl
      };
    }

    // キャッシュがない場合は新規取得
    return this.authenticateWithClientCredentials();
  },

  /**
   * Client Credentials Flow でトークンを取得
   */
  authenticateWithClientCredentials: function() {
    const props = PropertiesService.getScriptProperties().getProperties();
    const clientId = props.SF_CLIENT_ID;
    const clientSecret = props.SF_CLIENT_SECRET;
    // Client Credentials Flow のトークンエンドポイントは My Domain のホストを使います。
    // SF_LOGIN_URL に My Domain (例: https://your-domain.my.salesforce.com) を設定してください。
    const loginUrl = props.SF_LOGIN_URL || "https://login.salesforce.com";

    if (!clientId || !clientSecret) {
      throw new Error("認証設定(SF_CLIENT_ID, SF_CLIENT_SECRET)が不足しています。");
    }

    const payload = {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
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
