import { useMemo, useState } from "react";
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function PlatformAdminPage() {
  const [gateType, setGateType] = useState<GateType | undefined>();
  const [day, setDay] = useState<DayType | undefined>();
  const [time, setTime] = useState<string | undefined>();
  const [data, setData] = useState<ParkingLayoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // 변경사항 추적
  const [changes, setChanges] = useState<
    Map<number, { isArrived: boolean | null; status: RouteStatus }>
  >(new Map());

  const canSearch = useMemo(
    () => Boolean(gateType && day && time),
    [gateType, day, time]
  );

  const hasChanges = useMemo(() => changes.size > 0, [changes]);

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
      setChanges(new Map()); // 데이터 새로고침 시 변경사항 초기화
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

  // 변경사항 추적
  const handleRouteChange = (
    routeId: number,
    isArrived: boolean | null,
    status: RouteStatus
  ) => {
    setChanges((prev) => {
      const newChanges = new Map(prev);
      newChanges.set(routeId, { isArrived, status });
      return newChanges;
    });
  };

  // 변경사항 일괄 적용
  const handleApplyChanges = async () => {
    if (changes.size === 0) return;

    setApplying(true);
    const errors: string[] = [];

    try {
      // 모든 변경사항을 순차적으로 처리
      const changeEntries = Array.from(changes.entries());
      for (const [routeId, change] of changeEntries) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/parking/route/${routeId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                isArrived: change.isArrived,
                status: change.status,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`노선 ID ${routeId} 업데이트 실패`);
          }
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `노선 ID ${routeId} 오류`
          );
        }
      }

      if (errors.length > 0) {
        alert(`일부 업데이트 실패:\n${errors.join("\n")}`);
      }

      // 성공 후 데이터 새로고침
      await fetchParkingLayout();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Apply Changes Error:", err);
      alert("변경사항 적용에 실패했습니다");
    } finally {
      setApplying(false);
    }
  };

  // 현재 노선의 값 가져오기 (변경사항이 있으면 변경값, 없으면 원본값)
  const getRouteValue = (route: Route) => {
    const change = changes.get(route.id);
    return change || { isArrived: route.isArrived, status: route.status };
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
                  <SelectItem key="18:15">18:15</SelectItem>
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
                    <Button
                      size="sm"
                      color="primary"
                      onPress={handleApplyChanges}
                      isDisabled={!hasChanges || applying}
                      isLoading={applying}
                    >
                      변경내용 적용
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
                      const currentValue = getRouteValue(route);
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
                                      currentValue.status === "warning"
                                        ? "warning"
                                        : "success"
                                    }
                                  >
                                    {currentValue.status === "warning"
                                      ? "주의"
                                      : "정상"}
                                  </Chip>
                                </div>
                                <p className="text-xs text-default-500">
                                  Spot ID: {route.spotId}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Select
                                  size="sm"
                                  label="도착 상태"
                                  selectedKeys={
                                    new Set([
                                      currentValue.isArrived === null
                                        ? "null"
                                        : currentValue.isArrived
                                          ? "true"
                                          : "false",
                                    ])
                                  }
                                  onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    const isArrived =
                                      value === "null"
                                        ? null
                                        : value === "true";
                                    handleRouteChange(
                                      route.id,
                                      isArrived,
                                      currentValue.status
                                    );
                                  }}
                                  className="w-36"
                                  classNames={{
                                    trigger: "h-10",
                                  }}
                                  variant="bordered"
                                >
                                  <SelectItem key="null">알수없음</SelectItem>
                                  <SelectItem key="true">IN</SelectItem>
                                  <SelectItem key="false">OUT</SelectItem>
                                </Select>

                                <Select
                                  size="sm"
                                  label="상태"
                                  selectedKeys={new Set([currentValue.status])}
                                  onSelectionChange={(keys) => {
                                    const value = Array.from(
                                      keys
                                    )[0] as RouteStatus;
                                    handleRouteChange(
                                      route.id,
                                      currentValue.isArrived,
                                      value
                                    );
                                  }}
                                  className="w-28"
                                  classNames={{
                                    trigger: "h-10",
                                  }}
                                  variant="bordered"
                                >
                                  <SelectItem key="normal">정상</SelectItem>
                                  <SelectItem key="warning">주의</SelectItem>
                                </Select>
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
