import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";

import DefaultLayout from "@/layouts/default";
import { title, subtitle } from "@/components/primitives";

type GateType = "FRONTDOOR" | "BACKDOOR";
type DayType = "월" | "화" | "수" | "목" | "금";

type RouteStatus = "normal" | "warning";

interface Route {
  id: number;
  spotId: number;
  route: string;
  isArrived: boolean | null;
  status: RouteStatus;
}

interface ParkingLayoutData {
  gateType: string;
  routes: Route[];
}

interface ApiResponse {
  data: ParkingLayoutData;
  status: number;
  message: string;
  responseTime: string;
}

interface Spot {
  id: number;
  name: string;
  x: number;
  y: number;
  rotation: number;
}

interface SpotApiResponse {
  data: {
    gateType: string;
    spots: Spot[];
  };
  status: number;
  message: string;
  responseTime: string;
}

const API_BASE_URL = "/api";

export default function PlatformAdminPage() {
  const [gateType, setGateType] = useState<GateType | undefined>();
  const [day, setDay] = useState<DayType | undefined>();
  const [time, setTime] = useState<string | undefined>();
  const [data, setData] = useState<ParkingLayoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 라우트별 업데이트 상태
  const [updatingRouteIds, setUpdatingRouteIds] = useState<Set<number>>(
    new Set()
  );
  // spotId -> name 매핑
  const [spotNameById, setSpotNameById] = useState<Record<number, string>>({});

  const canSearch = useMemo(
    () => Boolean(gateType && day && time),
    [gateType, day, time]
  );

  // 변경사항 일괄 적용 제거로 해당 변수는 불필요

  const fetchParkingLayout = async () => {
    if (!canSearch) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        gateType: gateType!,
        day: day!,
        time: time!,
      });

      const response = await fetch(
        `${API_BASE_URL}/parking/layout?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      setData(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다"
      );
      // eslint-disable-next-line no-console
      console.error("API Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchParkingLayout();
  };

  const handleRefresh = () => {
    fetchParkingLayout();
  };

  // 검색 조건이 모두 채워진 상태에서 값이 바뀌면 자동 재검색
  useEffect(() => {
    if (gateType && day && time) {
      fetchParkingLayout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateType, day, time]);

  // 게이트별 스팟 목록 조회 및 매핑 구성
  const fetchSpots = async (gate: GateType) => {
    try {
      const params = new URLSearchParams({ gateType: gate || "FRONTDOOR" });
      const response = await fetch(
        `${API_BASE_URL}/parking/spot?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`Spot API 오류: ${response.status}`);
      }
      const result: SpotApiResponse = await response.json();
      const map: Record<number, string> = {};
      for (const s of result.data.spots) {
        map[s.id] = s.name;
      }
      setSpotNameById(map);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Spot API Error:", e);
      setSpotNameById({});
    }
  };

  // 라우트 상태(도착/주차상태) 업데이트 공통 유틸
  const withRouteUpdating = async (
    routeId: number,
    action: () => Promise<void>
  ) => {
    setUpdatingRouteIds((prev) => {
      const next = new Set(prev);
      next.add(routeId);
      return next;
    });
    try {
      await action();
    } finally {
      setUpdatingRouteIds((prev) => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    }
  };

  const updateArrival = async (route: Route, next: "in" | "out") => {
    const prevArrived = route.isArrived;
    // 낙관적 반영
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        routes: prev.routes.map((r) =>
          r.id === route.id ? { ...r, isArrived: next === "in" } : r
        ),
      };
    });

    await withRouteUpdating(route.id, async () => {
      const res = await fetch(`${API_BASE_URL}/parking/arrival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeSpotId: route.id,
          arrivalStatus: next,
        }),
      });
      if (!res.ok) {
        // 롤백
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            routes: prev.routes.map((r) =>
              r.id === route.id ? { ...r, isArrived: prevArrived } : r
            ),
          };
        });
        alert("도착 상태 변경에 실패했습니다.");
      }
    });
  };

  const updateParkingStatus = async (route: Route, next: RouteStatus) => {
    const prevStatus = route.status;
    // 낙관적 반영
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        routes: prev.routes.map((r) =>
          r.id === route.id ? { ...r, status: next } : r
        ),
      };
    });

    await withRouteUpdating(route.id, async () => {
      const res = await fetch(`${API_BASE_URL}/parking/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeSpotId: route.id,
          parkingStatus: next,
        }),
      });
      if (!res.ok) {
        // 롤백
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            routes: prev.routes.map((r) =>
              r.id === route.id ? { ...r, status: prevStatus } : r
            ),
          };
        });
        alert("상태 변경에 실패했습니다.");
      }
    });
  };

  return (
    <DefaultLayout>
      <section className="flex flex-col gap-20 py-8 md:py-10">
        {/* Header */}
        <div className="text-center md flex flex-col gap-0">
          <h1 className={title({ size: "md" })}>
            플랫폼{" "}
            <span className={title({ color: "blue", size: "md" })}>
              시뮬레이션
            </span>
          </h1>
        </div>

        {/* Main Content - Left/Right Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {/* Left Side - Search Filters */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-default-200" radius="lg">
              <CardHeader className="px-4 py-3">
                <h2 className="text-lg font-semibold">검색 조건</h2>
              </CardHeader>
              <Divider />
              <CardBody className="gap-4 px-4 py-4">
                <Select
                  label="출입문"
                  placeholder="출입문을 선택하세요"
                  selectedKeys={gateType ? new Set([gateType]) : new Set([])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as GateType;
                    setGateType(value);
                    if (value) {
                      fetchSpots(value);
                    }
                  }}
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{
                    trigger: "h-12",
                  }}
                >
                  <SelectItem key="FRONTDOOR">정문</SelectItem>
                  <SelectItem key="BACKDOOR">후문</SelectItem>
                </Select>

                <Select
                  label="요일"
                  placeholder="요일을 선택하세요"
                  selectedKeys={day ? new Set([day]) : new Set([])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as DayType;
                    setDay(value);
                  }}
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{
                    trigger: "h-12",
                  }}
                >
                  {(["월", "화", "수", "목", "금"] as DayType[]).map((d) => (
                    <SelectItem key={d}>{d}</SelectItem>
                  ))}
                </Select>

                <Select
                  label="시간"
                  placeholder="시간을 선택하세요"
                  selectedKeys={time ? new Set([time]) : new Set([])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    setTime(value);
                  }}
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{
                    trigger: "h-12",
                  }}
                >
                  <SelectItem key="15:15">15:15</SelectItem>
                  <SelectItem key="16:15">16:15</SelectItem>
                  <SelectItem key="17:15">17:15</SelectItem>
                  <SelectItem key="19:15">19:15</SelectItem>
                </Select>

                <Button
                  color="primary"
                  size="lg"
                  isDisabled={!canSearch}
                  onPress={handleSearch}
                  className="w-full mt-2 font-semibold"
                >
                  검색
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Right Side - Results */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-default-200 h-full" radius="lg">
              <CardHeader className="px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">버스 배차 노선 정보</h2>
                  {data && (
                    <Chip size="sm" variant="flat" color="primary">
                      {data.gateType}
                    </Chip>
                  )}
                </div>
                {data && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={handleRefresh}
                      isLoading={loading}
                    >
                      새로고침
                    </Button>
                  </div>
                )}
              </CardHeader>
              <Divider />
              <CardBody className="px-4 py-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-3 min-h-[400px]">
                    <Spinner size="lg" color="primary" />
                    <p className="text-default-500">데이터를 불러오는 중...</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center gap-3 min-h-[400px]">
                    <p className="text-danger">{error}</p>
                    <Button size="sm" variant="flat" onPress={handleRefresh}>
                      다시 시도
                    </Button>
                  </div>
                ) : data && data.routes.length > 0 ? (
                  <div className="space-y-3">
                    {data.routes.map((route) => {
                      const isUpdating = updatingRouteIds.has(route.id);
                      return (
                        <Card
                          key={route.id}
                          className="border border-default-200"
                          shadow="none"
                        >
                          <CardBody className="px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold">
                                    {route.route}
                                  </h3>
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={
                                      route.status === "warning"
                                        ? "warning"
                                        : "success"
                                    }
                                  >
                                    {route.status === "warning"
                                      ? "주의"
                                      : "정상"}
                                  </Chip>
                                </div>
                                <p className="text-xs text-default-500">
                                  {spotNameById[route.spotId] ?? "-"}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Select
                                  size="sm"
                                  label="도착 상태"
                                  selectedKeys={
                                    new Set(
                                      [
                                        route.isArrived === null
                                          ? undefined
                                          : route.isArrived
                                            ? "in"
                                            : "out",
                                      ].filter(Boolean) as string[]
                                    )
                                  }
                                  onSelectionChange={(keys) => {
                                    if (isUpdating) return;
                                    const value = Array.from(keys)[0] as string;
                                    const next = value as "in" | "out";
                                    if (next !== "in" && next !== "out") return;
                                    updateArrival(route, next);
                                  }}
                                  className="w-36"
                                  classNames={{
                                    trigger: "h-10",
                                  }}
                                  variant="bordered"
                                  isDisabled={isUpdating}
                                >
                                  <SelectItem key="in">IN</SelectItem>
                                  <SelectItem key="out">OUT</SelectItem>
                                </Select>

                                <Select
                                  size="sm"
                                  label="상태"
                                  selectedKeys={new Set([route.status])}
                                  onSelectionChange={(keys) => {
                                    if (isUpdating) return;
                                    const value = Array.from(
                                      keys
                                    )[0] as RouteStatus;
                                    if (
                                      value !== "normal" &&
                                      value !== "warning"
                                    )
                                      return;
                                    updateParkingStatus(route, value);
                                  }}
                                  className="w-28"
                                  classNames={{
                                    trigger: "h-10",
                                  }}
                                  variant="bordered"
                                  isDisabled={isUpdating}
                                >
                                  <SelectItem key="normal">정상</SelectItem>
                                  <SelectItem key="warning">주의</SelectItem>
                                </Select>

                                {isUpdating && <Spinner size="sm" />}
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      );
                    })}
                  </div>
                ) : data && data.routes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 min-h-[400px]">
                    <p className="text-default-500 text-center">
                      일치하는 노선이 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 min-h-[400px]">
                    <p className="text-default-500 text-center">
                      검색 조건을 선택하고 검색 버튼을 눌러주세요
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
