type IconName =
  | "home"
  | "list"
  | "globe"
  | "chart"
  | "search"
  | "chevron"
  | "refresh"
  | "settings"
  | "bell"
  | "user"
  | "help"
  | "info"
  | "sun"
  | "bolt"
  | "battery"
  | "coins"
  | "panel"
  | "calendar"
  | "close"
  | "download"
  | "tree"
  | "cloud"
  | "coal"
  | "pin"
  | "arrow"
  | "check";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  chart: "M12 3v9h9M21 15a9 9 0 1 1-12-12M16 3a9 9 0 0 1 5 5",
  search: "M16 16 21 21M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m9 5 7 7-7 7",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
  user: "M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-3a7 7 0 0 1 14 0v3H5Z",
  help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6M12 7h.01",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7l1-7Z",
  battery: "M3 7h16v12H3V7ZM7 3v4M15 3v4M7 13h4M9 11v4M14 13h2",
  coins:
    "M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c4 4 12 4 16 0",
  panel: "M5 4h14l3 12H2L5 4ZM12 4v12M4 10h16M12 16v5M7 21h10",
  calendar: "M4 5h16v16H4V5ZM8 2v6M16 2v6M4 11h16M8 15h2M14 15h2",
  close: "m6 6 12 12M18 6 6 18",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  tree: "m12 2-6 7h3l-5 6h5l-4 4h14l-4-4h5l-5-6h3l-6-7ZM12 19v3",
  cloud: "M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 0 12H6Z",
  coal: "M3 10h18l-3 8H6l-3-8ZM6 10l3-6 4 3 3-4 4 7M8 21h.01M16 21h.01",
  pin: "M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 0 1 14 0ZM14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
};
export default function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export type { IconName };
