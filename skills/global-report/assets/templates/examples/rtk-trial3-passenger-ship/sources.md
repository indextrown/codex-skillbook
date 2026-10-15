# 자료 목록

원본 폴더: `/Users/kimdonghyeon/Downloads/3차 실증(2026.10.15)(여객선)/`

| ID | 자료 | 받은 날짜 | 요약 | 반영한 섹션 |
| --- | --- | --- | --- | --- |
| S1 | 대화 | 2026-10-16 | 3차 실증 보고서 작성 요청. 팀장 지침: 로그·화면 영상 확인 바탕, 1~2쪽, 표지 없음, PDF. 팀원 보고서는 참고만 | spec.md |
| S2 | sources/log/*.txt (8개) | 2026-10-16 | 기기 4대 × 08:00·09:30 회차 태블릿 앱 로그. NMEA(GGA·GST·HDT), NTRIP·연결·발열 이벤트, 수신 AIS | 1. 실증 개요, 2. 측위 결과, 3. 로그·화면 확인 결과 |
| S3 | sources/stats.json, sources/detail.json (계산 스크립트 analyze_logs.py, detail.py) | 2026-10-16 | S2를 1초 단위로 직접 집계한 측위 품질 비율, Fix 연속 구간, NTRIP 재연결 시간, 자선 AIS 대비 헤딩 차이 | 2. 측위 결과, 3. 로그·화면 확인 결과 |
| S4 | 원본 폴더 `사진 및 영상/*.mp4` 화면 녹화 6개 (복사 안 함). 추출 장면: sources/screens/ | 2026-10-16 | Mapsea ①: 순항 중 RTK Float ±0.47m, 접안 직전 RTK Fix ±0.02m. Mapsea ②: PPP Not Ready·PPP_CONVERGING. AD Nav: 전 구간 RTK Float | 3. 로그·화면 확인 결과, 그림 1 |
| S5 | 원본 폴더 `사진 및 영상/IMG_*.HEIC`, `IMG_1038.PNG` (복사 안 함) | 2026-10-16 | 선미 데크 난간·구조물 가까이 설치한 장면, 선사 오후 항차 통제 안내 문자 | 1. 실증 개요, 3. 로그·화면 확인 결과 |
| S6 | sources/체크리스트_v0.1.xlsx | 2026-10-16 | 기기별 모드·연결 계획, 테스트 항목 T1~T7 | 1. 실증 개요, 4. 후속 조치 |
| S7 | `/Users/kimdonghyeon/mapsea/RTK_Demo/report/1015-여객선-실증-데이터-분석.pdf` (다른 팀원 작성, 복사 안 함) | 2026-10-16 | 내용 대조용으로만 참고. 문장·구성·수치는 가져오지 않음 | 없음 |
| S8 | 대화 | 2026-10-16 | 새 버전 요청: 가독성 개선, 장비 4대 구성 명확히, AD Navi가 Fix가 안 된 이유를 매뉴얼로 분석(팀장 요청). 사용자가 정리한 XR2 설치 방식·원인 후보·포드 좌우 배치 메모. 3차 실증은 좌현 POS·우현 HDG 포드 | 1. 실증 개요, 3. AD Navi 원인 분석, 4. 설치 기준 |
| S9 | `/Users/kimdonghyeon/mapsea/MapseaLab/rtk-doc/AD-Navigation/` XR2 사용자 매뉴얼 MAN-0101(한국어 md, 영문 PDF), 인터페이스 매뉴얼 MAN-0102(한국어 md) (복사 안 함) | 2026-10-16 | UM 11장(반사·장애물, 대칭, 기선 5m, 오프셋 ±90°), 12장(POS 포드 위치), 13장 그림(양쪽 HDG/POS), 14장(반경 80~100cm), 20장(RTCM 3.x). MAN-0102 6장(HB 필드), 8장(경보), 12장(RTCM 3.2·1Hz) | 3. AD Navi 원인 분석, 4. 설치 기준 |
| S10 | sources/adnav.json (계산 스크립트 adnav.py), sources/photos/adnav_pods_IMG_1047.jpg | 2026-10-16 | S2의 AD Navi `$PADN` HB·ALARM을 S9 기준으로 해석한 결과(기준국 거리, 위치·헤딩 포드 측위 방식, 기선, 경보 비율). IMG_1047(10:31 촬영)을 잘라 포드 3개에 원 표시 | 3. AD Navi 원인 분석, 그림 1 |
