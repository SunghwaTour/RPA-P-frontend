import React, { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청

const parseCenter = (searchParams: URLSearchParams) => {
  const x = parseFloat(searchParams.get("x") || ""); // 경도(longitude)
  const y = parseFloat(searchParams.get("y") || ""); // 위도(latitude)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return DEFAULT_CENTER;
  return { lat: y, lng: x };
};

const getInfoText = (searchParams: URLSearchParams) => {
  const t = (searchParams.get("infoText") || "").trim();
  return t || null;
};

type KakaoMap = InstanceType<typeof window.kakao.maps.Map>;
type KakaoCircle = InstanceType<typeof window.kakao.maps.Circle>;

const LocationSelectInner = () => {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const currentCircleRef = useRef<KakaoCircle | null>(null);

  useEffect(() => {
    const loadKakaoMap = () => {
      if (window.kakao && window.kakao.maps && containerRef.current) {
        const { lat, lng } = parseCenter(searchParams);
        const options = {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 3,
        };
        const map = new window.kakao.maps.Map(containerRef.current, options);
        mapRef.current = map;

        // 1) 현위치(파라미터) 빨간 원 고정 표시
        const circle = new window.kakao.maps.Circle({
          center: new window.kakao.maps.LatLng(lat, lng),
          radius: 12,
          strokeWeight: 2,
          strokeColor: "#e74c3c",
          strokeOpacity: 0.9,
          strokeStyle: "solid",
          fillColor: "#e74c3c",
          fillOpacity: 0.6,
        });
        circle.setMap(map);
        currentCircleRef.current = circle;

        // 3) 중심 좌표 참조(마커 대신 UI 오버레이 사용)
        const center = map.getCenter();

        // 5) 초기 생성 시 브릿지 이벤트 전송
        try {
          const payload = {
            type: "didChangeLocation",
            payload: {
              lat: center.getLat(),
              lng: center.getLng(),
              x: center.getLng(),
              y: center.getLat(),
            },
          };
          if (window.ReactNativeWebView?.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } else {
            console.log("[Bridge]", payload);
          }
        } catch (e) {
          console.error("Bridge postMessage error", e);
        }

        // 2) 지도 이동 완료(dragend) 이벤트 등록
        window.kakao.maps.event.addListener(map, "dragend", () => {
          const c = map.getCenter();

          // 샘플 메시지 DOM 업데이트(있을 때만)
          const resultDiv = document.getElementById("result");
          if (resultDiv) {
            resultDiv.innerHTML = `변경된 지도 중심좌표는 ${c.getLat()} 이고, 경도는 ${c.getLng()} 입니다`;
          }

          // 중심 표시는 UI 오버레이로 처리하므로 마커/인포윈도우는 사용하지 않음

          // 브릿지 이벤트 전송
          try {
            const payload = {
              type: "didChangeLocation",
              payload: {
                lat: c.getLat(),
                lng: c.getLng(),
                x: c.getLng(),
                y: c.getLat(),
              },
            };
            if (window.ReactNativeWebView?.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            } else {
              console.log("[Bridge]", payload);
            }
          } catch (e) {
            console.error("Bridge postMessage error", e);
          }
        });
      } else {
        console.error("Kakao Maps API 로드 실패");
      }
    };

    if (!window.kakao || !window.kakao.maps) {
      const existing = document.querySelector(
        'script[src^="https://dapi.kakao.com/v2/maps/sdk.js"]'
      );

      if (existing) {
        existing.addEventListener("load", () => {
          if (window.kakao && window.kakao.maps) {
            window.kakao.maps.load(loadKakaoMap);
          }
        });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&autoload=false`;
      script.async = true;
      script.onload = () => {
        window.kakao.maps.load(loadKakaoMap);
      };
      document.head.appendChild(script);
    } else {
      loadKakaoMap();
    }
  }, [searchParams]);

  useEffect(() => {
    // 쿼리스트링(x,y) 변경 시: 지도 중심 이동 + 현위치 원 갱신
    if (!(window.kakao && window.kakao.maps)) return;
    if (!mapRef.current) return;
    const { lat, lng } = parseCenter(searchParams);
    const newPos = new window.kakao.maps.LatLng(lat, lng);

    mapRef.current.setCenter(newPos);

    if (currentCircleRef.current) {
      currentCircleRef.current.setMap(null);
      currentCircleRef.current = null;
    }
    const circle = new window.kakao.maps.Circle({
      center: newPos,
      radius: 12,
      strokeWeight: 2,
      strokeColor: "#e74c3c",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
      fillColor: "#e74c3c",
      fillOpacity: 0.6,
    });
    circle.setMap(mapRef.current);
    currentCircleRef.current = circle;
  }, [searchParams]);

  const infoText = getInfoText(searchParams);
  const markerSrc = "/assets/center-marker.png";
  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div
        id="map"
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
      {/* 중심 지표 오버레이(UI): 커스텀 PNG 마커 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        {infoText && (
          <Card
            className="mb-2 shadow-lg"
            style={{
              pointerEvents: "none",
              transform: "translateY(6px)",
            }}
          >
            <CardBody className="py-2 px-3">
              <p className="text-xs font-medium text-default-700">{infoText}</p>
            </CardBody>
          </Card>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={markerSrc}
          alt="center-marker"
          style={{
            width: 40,
            height: "auto",
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
          }}
          onError={(e) => {
            // 이미지를 못 불러오면 간단한 SVG로 대체
            const el = e.currentTarget as HTMLImageElement;
            el.src =
              "data:image/svg+xml;utf8," +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                   <path d="M32 4c-12 0-22 9.7-22 21.6C10 38 32 60 32 60s22-22 22-34.4C54 13.7 44 4 32 4z" fill="#ef233c" stroke="#7b0000" stroke-width="2"/>
                   <circle cx="32" cy="26" r="10" fill="#0f2530"/>
                 </svg>`
              );
          }}
        />
      </div>
    </div>
  );
};

const LocationSelect = () => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center w-full h-screen bg-default-100">
          <Spinner size="lg" color="primary" label="지도 로딩 중..." />
        </div>
      }
    >
      <LocationSelectInner />
    </Suspense>
  );
};

export default LocationSelect;
