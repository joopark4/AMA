/// URL에서 바이너리 데이터를 가져오는 Tauri 명령
/// WebView에서 외부 도메인 fetch가 차단되는 경우 Rust 사이드에서 우회

use std::net::ToSocketAddrs;

/// SSRF 방지: 허용된 도메인만 접근 가능
const ALLOWED_HOSTS: &[&str] = &[
    "supertoneapi.com",
    "cdn.supertoneapi.com",
    "cloudfront.net",        // Supertone 음성 샘플 CDN
    "storage.googleapis.com",
];

/// 내부 네트워크 IP 접근 차단
fn is_private_ip(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => {
            v4.is_loopback()           // 127.0.0.0/8
            || v4.is_private()         // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            || v4.is_link_local()      // 169.254.0.0/16
            || v4.is_unspecified()     // 0.0.0.0
        }
        std::net::IpAddr::V6(v6) => {
            v6.is_loopback() || v6.is_unspecified()
        }
    }
}

#[tauri::command]
pub async fn fetch_url_bytes(url: String) -> Result<Vec<u8>, String> {
    // URL 파싱 및 스킴 검증
    let parsed = reqwest::Url::parse(&url)
        .map_err(|e| format!("Invalid URL: {}", e))?;

    if parsed.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed".to_string());
    }

    // 호스트 허용 목록 검증
    let host = parsed.host_str()
        .ok_or("URL has no host")?;

    let is_allowed = ALLOWED_HOSTS.iter().any(|allowed| {
        host == *allowed || host.ends_with(&format!(".{}", allowed))
    });
    if !is_allowed {
        return Err(format!("Host '{}' is not in the allowed list", host));
    }

    // DNS 확인 후 내부 IP 차단
    let port = parsed.port().unwrap_or(443);
    let addr_str = format!("{}:{}", host, port);
    if let Ok(addrs) = addr_str.to_socket_addrs() {
        for addr in addrs {
            if is_private_ip(addr.ip()) {
                return Err("Access to internal network addresses is not allowed".to_string());
            }
        }
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(3))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    // 리다이렉트 후 최종 URL도 검증
    let final_url = response.url();
    let final_host = final_url.host_str().unwrap_or("");
    let final_allowed = ALLOWED_HOSTS.iter().any(|allowed| {
        final_host == *allowed || final_host.ends_with(&format!(".{}", allowed))
    });
    if !final_allowed {
        return Err(format!("Redirect to '{}' is not allowed", final_host));
    }

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    // 응답 크기 제한 (50MB)
    const MAX_RESPONSE_SIZE: u64 = 50 * 1024 * 1024;
    if let Some(len) = response.content_length() {
        if len > MAX_RESPONSE_SIZE {
            return Err(format!("Response too large: {} bytes", len));
        }
    }

    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Failed to read body: {}", e))
}
