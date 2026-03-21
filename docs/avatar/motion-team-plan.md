# 모션 팀 플랜 (아카이브)

이 문서는 과거 모션 클립 기반 확장 계획 기록입니다.
현재 `main` 브랜치의 최신 구현은 **절차적 보행/제스처 중심**이며, 본 문서의 작업은 필수 경로가 아닙니다.

## 현재 상태 (최신 구현 기준)

- 기본 이동/보행은 런타임 절차 애니메이션(`VRMAvatar.tsx`)으로 동작
- 감정/제스처/댄스는 `AnimationManager` + `avatarStore` 상태 기반으로 적용
- 별도 VRMA 모션 클립 없이도 기본 상호작용이 동작

## 향후 확장 시 참고 항목

다음이 필요할 때만 본 계획을 재활성화합니다.

- 고품질 모션 캡처 기반 걷기/회전/정지 클립 도입
- 감정별 모션 클립(행복/슬픔/분노) 전환
- 리타게팅 파이프라인 구축(VRMA/BVH)

## 재활성화 체크리스트

- [ ] 모션 에셋 라이선스 확인
- [ ] 리타게팅 대상 VRM 본 맵 검증
- [ ] 런타임 fallback(절차 애니메이션) 유지
- [ ] 모션 미존재 시 앱 기능 퇴화 없음 확인

## 참고 링크

- VRM Animation: https://vrm.dev/en/vrm_animation/
- three-vrm docs: https://pixiv.github.io/three-vrm/
- Mixamo 라이선스 FAQ: https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775
