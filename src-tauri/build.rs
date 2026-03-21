use std::fs;
use std::path::Path;

fn main() {
    tauri_build::build();

    // --- Default VRM embedding pipeline ---
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
    let vrm_source = Path::new("assets/default.vrm");

    // Rerun if the VRM asset or shared key changes
    println!("cargo:rerun-if-changed=assets/default.vrm");
    println!("cargo:rerun-if-changed=src/commands/vrm_consts.rs");

    if vrm_source.exists() {
        // AES-128-GCM encryption
        use aes_gcm::aead::{Aead, KeyInit, OsRng};
        use aes_gcm::Nonce;
        use rand::RngCore;

        // Include the shared key definition (same file used by vrm.rs at runtime)
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/commands/vrm_consts.rs"));
        let key_bytes = DEFAULT_VRM_KEY;

        let plain = fs::read(vrm_source).expect("Failed to read default.vrm");
        let cipher = aes_gcm::Aes128Gcm::new_from_slice(&key_bytes)
            .expect("Invalid AES key length");

        // Random 96-bit nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, plain.as_ref())
            .expect("AES-GCM encryption failed");

        // Write: nonce (12 bytes) || ciphertext (includes 16-byte auth tag)
        let mut enc_data = Vec::with_capacity(12 + ciphertext.len());
        enc_data.extend_from_slice(&nonce_bytes);
        enc_data.extend_from_slice(&ciphertext);

        let enc_path = Path::new(&out_dir).join("default_vrm.enc");
        fs::write(&enc_path, &enc_data).expect("Failed to write encrypted VRM");

        // Generate compile-time flag
        let rs_path = Path::new(&out_dir).join("vrm_embedded.rs");
        fs::write(&rs_path, "pub const HAS_DEFAULT_VRM: bool = true;\n")
            .expect("Failed to write vrm_embedded.rs");

        println!(
            "cargo:warning=Default VRM embedded: {} bytes plaintext -> {} bytes encrypted",
            plain.len(),
            enc_data.len()
        );
    } else {
        // No VRM file — write empty placeholder
        let enc_path = Path::new(&out_dir).join("default_vrm.enc");
        fs::write(&enc_path, b"").expect("Failed to write empty enc file");

        let rs_path = Path::new(&out_dir).join("vrm_embedded.rs");
        fs::write(&rs_path, "pub const HAS_DEFAULT_VRM: bool = false;\n")
            .expect("Failed to write vrm_embedded.rs");
    }
}
