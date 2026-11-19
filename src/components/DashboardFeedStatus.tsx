import { getLocale, translate as t } from "../i18n/language";
import { DEFAULT_TIME_ZONE } from "../services/calendar";
import type { DashboardFeed } from "../services/useDashboardData";

export default function DashboardFeedStatus({ feed, onRetry, empty }: {
  feed: DashboardFeed<unknown>;
  onRetry: () => void;
  empty?: string;
}) {
  return (
    <div className={`dashboard-feed-status${feed.stale ? " stale" : ""}`} role="status">
      {feed.pending && <span>{t("Loading…")}</span>}
      {feed.updatedAt !== null ? (
        <span>{t("Last updated")}{" "}
          <time dateTime={new Date(feed.updatedAt).toISOString()}>
            {new Intl.DateTimeFormat(getLocale(), {
              dateStyle: "short", timeStyle: "short", hourCycle: "h23", timeZone: DEFAULT_TIME_ZONE,
            }).format(feed.updatedAt)} WIB
          </time>
        </span>
      ) : feed.data !== undefined && <span>{t("Source update time unavailable")}</span>}
      {feed.stale && <strong>{t("Stale · last valid data")}</strong>}
      {feed.data !== undefined && feed.updating && <span>{t("Updating…")}</span>}
      {empty && feed.data !== undefined && <span>{t(empty)}</span>}
      {feed.error && <><span title={t(feed.error)}>{t(feed.error)}</span><button type="button" onClick={onRetry}>{t("Try again")}</button></>}
    </div>
  );
}
