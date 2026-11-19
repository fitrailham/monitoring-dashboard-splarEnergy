import type { IconName } from "./Icon";

export const MORE_ITEMS = {
  status: { label: "Real-Time Status" },
  alarms: { label: "Alarm Management" },
  tasks: { label: "Task Management" },
  "iv-diagnosis": { label: "Smart I-V Curve Diagnosis" },
  "module-diagnosis": { label: "Smart Module-level Diagnosis", beta: true },
  offers: { label: "Special Offer" },
  "buy-services": { label: "Buy Services" },
  "buy-software": { label: "Buy Software" },
  company: { label: "Company Management" },
  personal: { label: "Personal Settings" },
  "delete-account": { label: "Delete Account" },
  privacy: { label: "Privacy Statement" },
  agreement: { label: "User Agreement" },
  cookies: { label: "Cookies Policy" },
  updates: { label: "Update Log" },
  contact: { label: "Contact Us" },
  services: { label: "Service Settings" },
  "data-modification": { label: "Data Modification" },
  announcements: { label: "Announcements" },
  "send-announcement": { label: "Send Announcement" },
} as const satisfies Record<string, { label: string; beta?: boolean }>;

export type MoreSection = keyof typeof MORE_ITEMS;

interface MoreGroup {
  label: string;
  icon: IconName;
  items: readonly MoreSection[];
}

interface MoreCategory {
  id: string;
  label: string;
  groups: readonly MoreGroup[];
}

export const MORE_CATEGORIES: readonly MoreCategory[] = [
  { id: "maintenance", label: "Maintenance", groups: [
    { label: "Maintenance", icon: "settings", items: ["status", "alarms", "tasks"] },
  ] },
  { id: "value-added", label: "Value-Added Services", groups: [
    { label: "Value-Added Services", icon: "chart", items: ["iv-diagnosis", "module-diagnosis"] },
    { label: "Buy", icon: "coins", items: ["offers", "buy-services", "buy-software"] },
  ] },
  { id: "system", label: "System", groups: [
    { label: "Company Management", icon: "building", items: ["company"] },
    { label: "System Settings", icon: "settings", items: ["personal", "delete-account"] },
    { label: "About", icon: "info", items: ["privacy", "agreement", "cookies", "updates", "contact"] },
    { label: "Business Configuration", icon: "list", items: ["services", "data-modification"] },
    { label: "Message Management", icon: "bell", items: ["announcements", "send-announcement"] },
  ] },
];

export function categoryForMoreSection(section: MoreSection | undefined) {
  return MORE_CATEGORIES.find((category) => category.groups.some((group) => section && group.items.includes(section))) ??
    MORE_CATEGORIES[0];
}
