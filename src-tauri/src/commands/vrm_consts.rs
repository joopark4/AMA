/// Deterministic AES-128 key derived from a project-specific seed.
/// This is NOT a security boundary against a determined reverse-engineer;
/// it prevents casual extraction via `strings` / `hexdump`.
///
/// Shared between build.rs (encryption) and vrm.rs (decryption).
/// build.rs uses `include!()` to pull this file at compile time.
pub const DEFAULT_VRM_KEY: [u8; 16] = [
    0x4d, 0x50, 0x41, 0x49, // MPAI
    0x56, 0x52, 0x4d, 0x4b, // VRMK
    0x32, 0x30, 0x32, 0x36, // 2026
    0xde, 0xad, 0xbe, 0xef,
];
