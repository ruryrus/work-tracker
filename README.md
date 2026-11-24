# 작업 현황판 (PWA)

스톡·이모티콘·프린터블 부업의 **진행 상황**을 플랫폼별로 한눈에 보는 모바일 웹앱입니다.
안드로이드 크롬에서 주소를 열고 **⋮ → 홈 화면에 추가**를 누르면 아이콘까지 달린 앱처럼 실행됩니다.

- 배포 주소: https://ruryrus.github.io/work-tracker/
- 저장소: https://github.com/ruryrus/work-tracker

## 화면

- **홈**: 상단 요약(전체 작업 · 심사중 · 지예 대기 · 승인) → 상태 필터 칩 → 플랫폼 카드 7곳.
  카드를 누르면 세부 작업 목록으로 들어가고, 요약 숫자나 칩을 누르면 그 상태만 걸러 볼 수 있습니다.
- **플랫폼 상세**: 상태별 건수 · 진행률 · 스튜디오 바로가기 링크 · 세부 작업 카드(상태 배지 · 진행 타임라인 · 다음 할 일 · 메모).

진행률은 각 작업의 타임라인 단계를 기준으로 계산합니다(완료 1, 진행중 0.5).

## 파일 구성

```
index.html            화면 뼈대
styles.css            스타일(라이트/다크 자동)
app.js                렌더링·필터·라우팅 (#p/<플랫폼id>)
data/works.json       ★ 진행 상황 데이터 — 여기만 고치면 됩니다
manifest.webmanifest  PWA 설정
sw.js                 서비스 워커(앱은 캐시 우선, works.json은 네트워크 우선)
icons/                아이콘 (tools/make_icons.py 로 재생성)
tools/make_icons.py   Pillow 아이콘 생성기
```

## `data/works.json` 스키마

```jsonc
{
  "schemaVersion": 1,
  "app": {
    "title": "지예 작업 현황",
    "subtitle": "스톡·이모티콘·프린터블 부업 진행판",
    "updatedAt": "2026-11-24T13:30:00+09:00",   // 앱 상단 '최근 업데이트'에 표시
    "timezone": "Asia/Seoul"
  },
  "platforms": [
    {
      "id": "ogq",                    // 영문 소문자·하이픈. 주소(#p/ogq)에 쓰임
      "name": "네이버 OGQ",
      "studio": "콩닥스튜디오",        // 이름 아래 보조 설명
      "emoji": "🐰",
      "color": "#03C75A",             // 카드 포인트 색
      "link": "https://creators.ogq.me",
      "linkLabel": "OGQ 크리에이터 스튜디오",
      "note": "플랫폼 공통 요약(규격·심사 조건 등)",   // 선택
      "items": [
        {
          "id": "ogq-winter24",       // 플랫폼 안에서 고유
          "title": "겨울·크리스마스·새해 콩닥비숑 24종",
          "subtitle": "한 줄 설명",                       // 선택
          "status": "user_action",   // 아래 4가지 중 하나 (필수)
          "meta": "24종 · 740×640 · 캐릭터 누끼 + 데코",   // 수량·규격 (선택)
          "owner": "지예 님 손글씨 + AI 캐릭터",           // 선택
          "updatedAt": "2026-11-23",                     // 선택
          "steps": [
            { "label": "캐릭터 누끼 24종 전달", "state": "done", "date": "11-23" },
            { "label": "지예 님 손글씨 합성중", "state": "current" },
            { "label": "OGQ 업로드", "state": "todo" }
          ],
          "nextAction": "합성 완료본 회신",                // '다음' 강조 줄 (선택)
          "note": "메모·주의할 점",                        // 선택
          "files": ["downloads/ogq_winter_christmas_24/"] // 자료 위치 (선택)
        }
      ]
    }
  ]
}
```

### 상태값 4가지

| 값 | 화면 표시 | 쓰는 때 |
| --- | --- | --- |
| `user_action` | 지예 작업중/대기 | 지예 님 작업·확인·자료 전달·컨펌을 기다리는 항목 |
| `review` | 심사 대기중 | 플랫폼에 제출해 심사 중 |
| `approved` | 승인 완료 | 승인·판매 중 |
| `rejected` | 반려·재작업 | 반려·보완 필요 |

### 타임라인 단계 상태

`done`(완료) · `current`(지금 진행 중, 굵게 표시) · `todo`(남은 일). `date`는 `"11-23"`처럼 짧게.

## 진행 상황 갱신 방법

1. `data/works.json`에서 해당 작업의 `status`·`steps`·`nextAction`·`note`·`app.updatedAt`을 고칩니다.
2. 검사 후 커밋·푸시하면 몇 초 뒤 앱에 반영됩니다(앱은 열 때마다 `works.json`을 네트워크에서 먼저 받아옴).

```bash
cd work-tracker
python3 -c "import json;json.load(open('data/works.json'));print('json OK')"
git add data/works.json && git commit -m "진행상황 갱신: 2026-11-24" && git push
```

- 새 작업은 `items` 배열에 추가하고, 끝난 작업은 `status`를 `approved`로 바꾸거나 항목을 지웁니다.
- 개인정보(계정 아이디·연락처·금액)는 넣지 않습니다. 이 저장소는 공개입니다.
