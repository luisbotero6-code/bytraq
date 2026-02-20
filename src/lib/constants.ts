import type { Role } from "@/generated/prisma";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administratör",
  BYRALEDNING: "Byråledning",
  TEAM_LEAD: "Teamledare",
  MEDARBETARE: "Medarbetare",
};

export const ARTICLE_GROUP_TYPE_LABELS = {
  ORDINARIE: "Pakettjänster",
  TILLAGG: "Tilläggstjänster",
  INTERNTID: "Interntid",
  OVRIGT: "Övrigt",
} as const;

export const CUSTOMER_TYPE_LABELS = {
  LOPANDE: "Löpande",
  FASTPRIS: "Fastpris",
  BLANDAD: "Blandad",
} as const;

export const ABSENCE_REASON_LABELS = {
  SEMESTER: "Semester",
  VAB: "VAB",
  SJUK: "Sjukdom",
  FORALDRALEDIG: "Föräldraledig",
  FRANVARO_OVRIGT: "Frånvaro övrigt",
  FLEXTID: "Flextid",
} as const;

export const ABSENCE_CODES = [
  { code: "ARB", label: "Timlön" },
  { code: "ARS", label: "Timlön inom schema" },
  { code: "ASK", label: "Arbetsskada" },
  { code: "ATF", label: "Arbetstidsförkortning" },
  { code: "BE2", label: "Beredskapstid 2" },
  { code: "BER", label: "Beredskapstid" },
  { code: "FPE", label: "Föräldraledig" },
  { code: "FRA", label: "Frånvaro övrigt" },
  { code: "FRX", label: "Flextid −" },
  { code: "HAV", label: "Graviditetspenning" },
  { code: "HLG", label: "Helglön" },
  { code: "JO2", label: "Jourtid 2" },
  { code: "JOR", label: "Jourtid" },
  { code: "KOM", label: "Kompledig" },
  { code: "MER", label: "Mertid" },
  { code: "MIL", label: "Militärtjänst (max 60 dagar)" },
  { code: "NAR", label: "Närståendevård" },
  { code: "NVX", label: "Flextid +" },
  { code: "OB1", label: "OB-ersättning 1" },
  { code: "OB2", label: "OB-ersättning 2" },
  { code: "OB3", label: "OB-ersättning 3" },
  { code: "OB4", label: "OB-ersättning 4" },
  { code: "OB5", label: "OB-ersättning 5" },
  { code: "OB6", label: "OB-ersättning 6" },
  { code: "OB7", label: "OB-ersättning 7" },
  { code: "OK0", label: "Extratid − Komptid" },
  { code: "OK1", label: "Övertid 1 − Komptid" },
  { code: "OK2", label: "Övertid 2 − Komptid" },
  { code: "OK3", label: "Övertid 3 − Komptid" },
  { code: "OK4", label: "Övertid 4 − Komptid" },
  { code: "OK5", label: "Övertid 5 − Komptid" },
  { code: "OS1", label: "Sjuk-OB 1" },
  { code: "OS2", label: "Sjuk-OB 2" },
  { code: "OS3", label: "Sjuk-OB 3" },
  { code: "OS4", label: "Sjuk-OB 4" },
  { code: "OS5", label: "Sjuk-OB 5" },
  { code: "OS6", label: "Sjuk-OB 6" },
  { code: "OS7", label: "Sjuk-OB 7" },
  { code: "OT1", label: "Övertid 1 − Betalning" },
  { code: "OT2", label: "Övertid 2 − Betalning" },
  { code: "OT3", label: "Övertid 3 − Betalning" },
  { code: "OT4", label: "Övertid 4 − Betalning" },
  { code: "OT5", label: "Övertid 5 − Betalning" },
  { code: "OT6", label: "Övertid 6 − Betalning" },
  { code: "PAP", label: "10-dagar vid barns födelse" },
  { code: "PEM", label: "Permission" },
  { code: "PER", label: "Permitterad" },
  { code: "RE2", label: "Restid 2" },
  { code: "RE3", label: "Restid 3" },
  { code: "RES", label: "Restid" },
  { code: "SEM", label: "Semester" },
  { code: "SJK", label: "Sjukfrånvaro" },
  { code: "SMB", label: "Smittbärare" },
  { code: "SVE", label: "Svenska för invandrare" },
  { code: "TID", label: "Arbetstid" },
  { code: "TJL", label: "Tjänstledig" },
  { code: "UTB", label: "Facklig utbildning" },
  { code: "VAB", label: "Vård av barn" },
] as const;

/** Maps an absence code to the AbsenceReason enum for KPI calculations */
export const ABSENCE_CODE_TO_REASON: Record<string, string> = {
  SEM: "SEMESTER",
  VAB: "VAB",
  SJK: "SJUK",
  FPE: "FORALDRALEDIG",
  FRA: "FRANVARO_OVRIGT",
  FRX: "FLEXTID",
  NVX: "FLEXTID",
  ASK: "SJUK",
  SMB: "SJUK",
  HAV: "FORALDRALEDIG",
  PAP: "FORALDRALEDIG",
  NAR: "FRANVARO_OVRIGT",
  TJL: "FRANVARO_OVRIGT",
  PEM: "FRANVARO_OVRIGT",
  MIL: "FRANVARO_OVRIGT",
  SVE: "FRANVARO_OVRIGT",
  UTB: "FRANVARO_OVRIGT",
  KOM: "FRANVARO_OVRIGT",
  PER: "FRANVARO_OVRIGT",
  ATF: "FRANVARO_OVRIGT",
  HLG: "FRANVARO_OVRIGT",
};

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "BYRALEDNING", "TEAM_LEAD", "MEDARBETARE"] },
  { href: "/time", label: "Tidredovisning", roles: ["ADMIN", "BYRALEDNING", "TEAM_LEAD", "MEDARBETARE"] },
  { href: "/budget", label: "Budget", roles: ["ADMIN", "BYRALEDNING", "TEAM_LEAD"] },
  { href: "/reports", label: "Rapporter", roles: ["ADMIN", "BYRALEDNING", "TEAM_LEAD"] },
  { href: "/tasks", label: "Åtgärder", roles: ["ADMIN", "BYRALEDNING", "TEAM_LEAD"] },
  { href: "/data-quality", label: "Datakvalitet", roles: ["ADMIN", "BYRALEDNING"] },
  { href: "/admin", label: "Administration", roles: ["ADMIN", "BYRALEDNING"] },
] as const;

export const TIMER_STORAGE_KEYS = {
  TIMER_STATE: "bytraq:timer-state",
  LAST_CUSTOMER: "bytraq:timer-last-customer",
  LAST_ARTICLE: "bytraq:timer-last-article",
} as const;

export const TIMER_ROUNDING_INCREMENT = 0.25;
