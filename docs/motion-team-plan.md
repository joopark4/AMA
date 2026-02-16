# 모션 자연화 팀 운영 플랜 (P0)

## 목표

- 걷기 시작/루프/정지/회전(좌/우) 기본 5클립을 확보하고 VRM 아바타에 리타게팅 적용
- 감정별(행복/슬픔/분노) 보행 변형 클립을 단계적으로 추가
- 관절 ROM(hip/knee/ankle/elbow) 범위를 넘는 비정상 꺾임을 최소화

## 팀 구성

### Team A - Data Acquisition

- 책임: 모션 소스 수집, 라이선스 검토, 파일 정리
- 우선순위:
  1) VRoid 공식 BOOTH 7종 VRMA 세트 확보
  2) BOOTH `#VRMA` 마켓플레이스 탐색
- 산출물:
  - `walk_start`, `walk_loop`, `walk_stop`, `turn_left_90`, `turn_right_90`
  - optional `emotion_happy_loop`, `emotion_sad_loop`, `emotion_angry_loop`
- 배치 위치: `motions/source`, `motions/sources`, `motions/`, `public/motions/`, 또는 `assets/motions/`
- 검증: `npm run motion:check`

### Team B - Retarget & Runtime Integration

- 책임: VRM 리타게팅 파이프라인 구성, 런타임 클립 전환 로직 적용
- 산출물:
  - clip load 실패 시 procedural fallback
  - start -> loop -> stop 전환 상태머신
  - turn clip와 facing 전환 동기화

### Team C - Biomechanics / ROM Tuning

- 책임: 관절 제한값 기반 튜닝, toe-off 기반 무릎 굴곡 개선
- 산출물:
  - elbow/knee axis clamp 범위
  - hip/knee/ankle 상호작용 파라미터
  - 감정별 stride/cadence 보정값

### Team D - QA / Evaluation

- 책임: 시나리오 테스트와 회귀 검증
- 필수 시나리오:
  - 정지 상태에서 미세 이동 없음
  - 좌/우 경계 부근에서 turn + stop 정상
  - arm/leg 관절이 역방향으로 꺾이지 않음
  - 감정 전환 시 표정/동작 전환이 충돌하지 않음

## P0 체크리스트

- [ ] 필수 5클립 확보
- [ ] `npm run motion:check` 결과 `READY`
- [ ] walk start/loop/stop 전환 구현
- [ ] turn left/right 90도 전환 구현
- [ ] ROM 클램프 튜닝 완료
- [ ] macOS Tauri 실행 검증

## 참고 자료

- VRM Animation / bvh2vrma: https://vrm.dev/en/vrm_animation/
- three-vrm docs: https://pixiv.github.io/three-vrm/
- VRoid 공식 BOOTH 7종 VRMA: https://booth.pm/zh-tw/items/5512385
- VRoid BOOTH VRMA 안내: https://vroid.com/en/news/6HozzBIV0KkcKf9dc1fZGW
- Gait ROM review: https://pmc.ncbi.nlm.nih.gov/articles/PMC12005681/
- Toe-off and knee flexion study: https://pubmed.ncbi.nlm.nih.gov/36106898/
- Mixamo FAQ/license: https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775
- AMASS dataset: https://amass.is.tue.mpg.de/
