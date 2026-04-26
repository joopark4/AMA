use std::fs;
use std::path::Path;

fn main() {
    tauri_build::build();

    // --- Default VRM embedding pipeline ---
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
    let vrm_source = Path::new("assets/default.vrm");
    let key_source = Path::new("src/commands/vrm_key.bin");

    println!("cargo:rerun-if-changed=assets/default.vrm");
    println!("cargo:rerun-if-changed=src/commands/vrm_key.bin");

    if vrm_source.exists() && key_source.exists() {
        use aes_gcm::aead::{Aead, KeyInit, OsRng};
        use aes_gcm::Nonce;
        use rand::RngCore;

        // vrm_key.bin 런타임 읽기 (include! 대신 — 파일 미존재 시 컴파일 에러 방지)
        let key_content = fs::read_to_string(key_source)
            .expect("Failed to read vrm_key.bin");
        let key_bytes: [u8; 16] = eval_key_array(&key_content);

        let plain = fs::read(vrm_source).expect("Failed to read default.vrm");
        let cipher = aes_gcm::Aes128Gcm::new_from_slice(&key_bytes)
            .expect("Invalid AES key length");

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, plain.as_ref())
            .expect("AES-GCM encryption failed");

        let mut enc_data = Vec::with_capacity(12 + ciphertext.len());
        enc_data.extend_from_slice(&nonce_bytes);
        enc_data.extend_from_slice(&ciphertext);

        let enc_path = Path::new(&out_dir).join("default_vrm.enc");
        fs::write(&enc_path, &enc_data).expect("Failed to write encrypted VRM");

        let rs_path = Path::new(&out_dir).join("vrm_embedded.rs");
        fs::write(&rs_path, "pub const HAS_DEFAULT_VRM: bool = true;\n")
            .expect("Failed to write vrm_embedded.rs");

        println!(
            "cargo:warning=Default VRM embedded: {} bytes plaintext -> {} bytes encrypted",
            plain.len(),
            enc_data.len()
        );

        // vrm_key_const.rs — 실제 키
        let key_rs = format!(
            "pub const DEFAULT_VRM_KEY: [u8; 16] = {:?};\n",
            key_bytes
        );
        let key_rs_path = Path::new(&out_dir).join("vrm_key_const.rs");
        fs::write(&key_rs_path, &key_rs).expect("Failed to write vrm_key_const.rs");
    } else {
        // 릴리스 빌드에서는 VRM/키 누락 시 빌드 실패 (배포 사고 방지)
        // OSS/CI 빌드에서는 AMA_ALLOW_NO_VRM=1 환경변수로 placeholder 허용
        let allow_no_vrm = std::env::var("AMA_ALLOW_NO_VRM").unwrap_or_default() == "1";
        let is_release = std::env::var("PROFILE").unwrap_or_default() == "release";

        if is_release && !allow_no_vrm {
            panic!(
                "Release build requires assets/default.vrm and src/commands/vrm_key.bin. \
                 Set AMA_ALLOW_NO_VRM=1 to build without embedded VRM (OSS/CI only)."
            );
        }

        // 개발/OSS 빌드: 빈 placeholder 생성
        let enc_path = Path::new(&out_dir).join("default_vrm.enc");
        fs::write(&enc_path, b"").expect("Failed to write empty enc file");

        let rs_path = Path::new(&out_dir).join("vrm_embedded.rs");
        fs::write(&rs_path, "pub const HAS_DEFAULT_VRM: bool = false;\n")
            .expect("Failed to write vrm_embedded.rs");

        // vrm_key_const.rs — zero placeholder
        let key_rs_path = Path::new(&out_dir).join("vrm_key_const.rs");
        fs::write(&key_rs_path, "pub const DEFAULT_VRM_KEY: [u8; 16] = [0u8; 16];\n")
            .expect("Failed to write vrm_key_const.rs");
    }
}

/// vrm_key.bin 파일 내용 (Rust 배열 리터럴)을 파싱하여 [u8; 16]으로 변환.
/// 파일 형식 예: [0x4D, 0x50, 0x41, 0x49, // comment ...]
///
/// 파싱 실패 시 어떤 토큰에서 터졌는지 패닉 메시지에 포함시켜 원인 추적을 돕는다.
fn eval_key_array(content: &str) -> [u8; 16] {
    // 1) 줄 단위로 `//` 주석 제거 후 공백 구분 단일 문자열로 합침.
    let cleaned: String = content
        .lines()
        .map(|line| match line.find("//") {
            Some(idx) => &line[..idx],
            None => line,
        })
        .collect::<Vec<_>>()
        .join(" ");

    // 2) 대괄호/쉼표/공백 등 경계 문자를 구분자로 삼아 토큰을 추출한다.
    let mut bytes: Vec<u8> = Vec::with_capacity(16);
    for token in cleaned.split(|c: char| c == ',' || c == '[' || c == ']' || c.is_whitespace()) {
        let t = token.trim();
        if t.is_empty() {
            continue;
        }
        let value = if let Some(rest) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) {
            u8::from_str_radix(rest, 16).unwrap_or_else(|e| {
                panic!("vrm_key.bin hex parse failed: token='{}' err={:?}", t, e);
            })
        } else {
            t.parse::<u8>().unwrap_or_else(|e| {
                panic!("vrm_key.bin decimal parse failed: token='{}' err={:?}", t, e);
            })
        };
        bytes.push(value);
    }

    assert_eq!(
        bytes.len(),
        16,
        "vrm_key.bin must contain exactly 16 bytes (got {}): {:?}",
        bytes.len(),
        bytes
    );
    let mut arr = [0u8; 16];
    arr.copy_from_slice(&bytes);
    arr
}
