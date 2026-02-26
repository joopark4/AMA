use tauri_plugin_shell::ShellExt;

/// 허용된 OAuth 제공자 호스트 확인
fn is_allowed_oauth_host(host: &str) -> bool {
    const ALLOWED_HOSTS: &[&str] = &[
        "accounts.google.com",
        "appleid.apple.com",
        "www.facebook.com",
        "facebook.com",
        "twitter.com",
        "x.com",
    ];
    ALLOWED_HOSTS.contains(&host) || host.ends_with(".supabase.co")
}

/// OAuth URL을 기본 브라우저에서 열기
/// 허용된 OAuth 제공자 호스트만 허용하여 보안 강화
#[tauri::command]
pub async fn open_oauth_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| format!("잘못된 URL: {e}"))?;

    if parsed.scheme() != "https" {
        return Err("HTTPS URL만 허용됩니다".to_string());
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "호스트를 파싱할 수 없습니다".to_string())?;

    if !is_allowed_oauth_host(host) {
        return Err(format!("허용되지 않은 OAuth 호스트: {host}"));
    }

    app.shell()
        .open(&url, None)
        .map_err(|e| format!("브라우저를 열 수 없습니다: {e}"))
}

/// 딥링크 URL에서 OAuth 콜백 파라미터 파싱
/// mypartnerai://auth/callback?code=...&state=...
#[tauri::command]
pub fn parse_auth_callback(url: String) -> Result<AuthCallbackParams, String> {
    let parsed = url::Url::parse(&url).map_err(|e| format!("URL 파싱 실패: {e}"))?;

    // mypartnerai://auth/callback 형식 검증
    // - standard URL: host="auth", path="/callback"
    // - cannot-be-a-base URL: path="auth/callback"
    let is_valid = match parsed.host_str() {
        Some("auth") => parsed.path() == "/callback",
        None => parsed.path() == "auth/callback",
        _ => false,
    };
    if !is_valid {
        return Err(format!(
            "잘못된 콜백 URL (host={:?}, path={})",
            parsed.host_str(),
            parsed.path()
        ));
    }

    let mut code = None;
    let mut state = None;
    let mut error = None;

    for (key, value) in parsed.query_pairs() {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => state = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            _ => {}
        }
    }

    if let Some(err) = error {
        return Ok(AuthCallbackParams {
            code: None,
            state: None,
            error: Some(err),
        });
    }

    Ok(AuthCallbackParams { code, state, error: None })
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct AuthCallbackParams {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}
