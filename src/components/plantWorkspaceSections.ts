import type { IconName } from "./Icon";

export const PLANT_WORKSPACE_GROUPS = [
  {
    label: "Plant", icon: "panel",
    items: [
      { id: "plant-management", label: "Plant Management" },
      { id: "plant-migration", label: "Plant Migration" },
      { id: "plant-license", label: "Plant License" },
      { id: "plant-authorization", label: "Plant Authorization" },
    ],
  },
  {
    label: "Device", icon: "device",
    items: [
      { id: "device-management", label: "Device Management" },
      { id: "update-management", label: "Update Management" },
      { id: "log-export", label: "Log Export" },
      { id: "license-management", label: "License Management" },
      { id: "inspection", label: "Inspection" },
      { id: "configure-strings", label: "Configure Strings" },
      { id: "module-library-management", label: "Module Library Management" },
      { id: "device-certificate-management", label: "Device Certificate Management" },
    ],
  },
  {
    label: "System Configuration", icon: "settings",
    items: [
      { id: "electricity-prices", label: "Set Electricity Prices" },
      { id: "holidays", label: "Set Holidays" },
    ],
  },
] as const satisfies readonly { label: string; icon: IconName; items: readonly { id: string; label: string }[] }[];

export type PlantWorkspaceSection = (typeof PLANT_WORKSPACE_GROUPS)[number]["items"][number]["id"];
