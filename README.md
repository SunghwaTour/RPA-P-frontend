# RPA-P-Frontend (Kingbus)

카카오 지도를 웹뷰로 표시하는 React(Typescript) 프론트엔드입니다. 
`/map/location-select` 경로에서 쿼리 파라미터로 좌표와 라벨을 받아 동작합니다.

## 환경 변수
- 루트 경로 `.env`
  - `REACT_APP_KAKAO_MAP_API_KEY=카카오_자바스크립트_키`

## 라우팅 경로
- `/map/location-select`
  - 쿼리 파라미터: `x`(경도), `y`(위도), `infoText`(선택 표시 라벨)
  - 예시: `/map/location-select?x=126.978&y=37.5665&infoText=출발지`
  - 파라미터 없을 때 기본값: 서울시청(37.5665, 126.978)
- `*` (그 외 모든 경로)
  - 간단한 안내 화면(“Kingbus”) 표시

## 파라미터와 지도 동작
- `x`/`y`: 경도/위도. 이 좌표는 "현위치"로 간주되어 지도 위에 빨간 원(`Circle`)으로 고정 표시됩니다.
- `infoText`: 선택 라벨. 중앙 오버레이 하단(또는 상단)에 라벨로 표시합니다.
- 중앙 표시: 지도 뷰의 정확한 중앙에 UI 오버레이(이미지)로 렌더링하며, 카카오 지도 마커는 사용하지 않습니다.
- 이동 이벤트: 마우스 드래그로 지도 이동 완료(`dragend`) 시 현재 지도 중심 좌표를 읽어 브릿지로 전송합니다. 초기 로딩 시에도 1회 전송합니다.

## 브릿지 이벤트(WebView)
- 이벤트명: `didChangeLocation`
- 전송 시점:
  - 초기 지도 생성 직후 1회
  - 이후 매번 `dragend` 발생 시
- 페이로드 구조 예시:
  - `{ "type": "didChangeLocation", "payload": { "lat": 37.5665, "lng": 126.978, "x": 126.978, "y": 37.5665 } }`
  - 주의: `x`=경도(lng), `y`=위도(lat)
- RN(WebView) 수신 예시:
  - React Native `WebView`에서 `onMessage={(e) => { const data = JSON.parse(e.nativeEvent.data); /* ... */ }}`