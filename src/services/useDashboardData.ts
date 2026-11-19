import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  DASHBOARD_REFRESH_MS, dashboardDate, getDashboardAlarms, getDashboardOverview, getDashboardPlants, isDashboardDataStale,
} from "./dashboard";
import type { DashboardSnapshot } from "./dashboard";

export interface DashboardFeed<T> {
  data: T | undefined;
  pending: boolean;
  updating: boolean;
  error: string | null;
  updatedAt: number | null;
  receivedAt: number;
  stale: boolean;
}

function feed<T>(query: UseQueryResult<DashboardSnapshot<T>>, now: number): DashboardFeed<T> {
  const offline = query.fetchStatus === "paused";
  const error = query.error?.message ?? (offline ? "The dashboard is offline." : null);
  const updatedAt = query.data?.updatedAt ?? null;
  return {
    data: query.data?.value,
    pending: query.isPending && !offline,
    updating: query.isFetching,
    error,
    updatedAt,
    receivedAt: query.dataUpdatedAt,
    stale: Boolean(query.data && (query.data.stale || error || isDashboardDataStale(updatedAt ?? query.dataUpdatedAt, now))),
  };
}

const dashboardKey = ["dashboard"] as const;

export function useDashboardData(now: number) {
  const client = useQueryClient();
  const overview = useQuery({
    queryKey: [...dashboardKey, "overview"],
    queryFn: async ({ signal }) => {
      const date = dashboardDate(Date.now());
      return { ...await getDashboardOverview(date, signal), date };
    },
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
  const plants = useQuery({
    queryKey: [...dashboardKey, "plants"],
    queryFn: ({ signal }) => getDashboardPlants(signal),
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
  const alarms = useQuery({
    queryKey: [...dashboardKey, "active-alarms"],
    queryFn: ({ signal }) => getDashboardAlarms(signal),
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: dashboardKey }), [client]);
  const overviewFeed = feed(overview, now);
  if (overview.data && overview.data.date !== dashboardDate(now)) overviewFeed.stale = true;
  return {
    overview: overviewFeed,
    plants: feed(plants, now),
    alarms: feed(alarms, now),
    refreshing: overview.isFetching || plants.isFetching || alarms.isFetching,
    refresh,
  };
}
