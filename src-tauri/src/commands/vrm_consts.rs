/// Deterministic AES-128 key derived from a project-specific seed.
/// This is NOT a security boundary against a determined reverse-engineer;
/// it prevents casual extraction via `strings` / `hexdump`.
///
/// Shared between build.rs (encryption) and vrm.rs (decryption).
/// Key bytes are defined in vrm_key.bin (raw hex array) for include! compatibility.
pub const DEFAULT_VRM_KEY: [u8; 16] = include!("vrm_key.bin");
