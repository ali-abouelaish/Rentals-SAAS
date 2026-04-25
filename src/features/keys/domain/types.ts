export type KeyStatus =
  | "in_office"
  | "loaned"
  | "with_tenant"
  | "lost"
  | "destroyed";

export type KeyAssignmentPurpose =
  | "viewing"
  | "tenancy"
  | "maintenance"
  | "inspection"
  | "other";

export type KeyAssignmentReturnedCondition = "good" | "damaged" | "lost";

export type KeyHolderUser = {
  kind: "user";
  userId: string;
  name: string | null;
};

export type KeyHolderContact = {
  kind: "contact";
  name: string;
  phone: string | null;
};

export type KeyHolder = KeyHolderUser | KeyHolderContact;

export type KeyAssignment = {
  id: string;
  keyId: string;
  heldBy: KeyHolder;
  purpose: KeyAssignmentPurpose;
  notes: string | null;
  checkedOutAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  returnedCondition: KeyAssignmentReturnedCondition | null;
  isOverdue: boolean;
};

export type KeyWithCurrent = {
  id: string;
  setName: string;
  copyLabel: string;
  status: KeyStatus;
  notes: string | null;
  unitId: string | null;
  unitLabel: string | null;
  currentAssignment: KeyAssignment | null;
};

export type KeyGroup = {
  setName: string;
  unitId: string | null;
  unitLabel: string | null;
  keys: KeyWithCurrent[];
};

export type PropertyKeysPayload = {
  property: {
    id: string;
    address: string;
  };
  groups: KeyGroup[];
  totals: {
    registered: number;
    out: number;
  };
};

export type KeysOutItem = {
  key: {
    id: string;
    setName: string;
    copyLabel: string;
    status: KeyStatus;
  };
  property: {
    id: string;
    address: string;
  };
  unitLabel: string | null;
  heldBy: KeyHolder;
  purpose: KeyAssignmentPurpose;
  checkedOutAt: string;
  expectedReturnAt: string | null;
  isOverdue: boolean;
};

export type KeysOutPayload = {
  items: KeysOutItem[];
};

export const KEY_STATUS_LABELS: Record<KeyStatus, string> = {
  in_office: "In office",
  loaned: "Loaned",
  with_tenant: "With tenant",
  lost: "Lost",
  destroyed: "Destroyed",
};

export const KEY_PURPOSE_LABELS: Record<KeyAssignmentPurpose, string> = {
  viewing: "Viewing",
  tenancy: "Tenancy",
  maintenance: "Maintenance",
  inspection: "Inspection",
  other: "Other",
};

export const KEY_PURPOSES: KeyAssignmentPurpose[] = [
  "viewing",
  "tenancy",
  "maintenance",
  "inspection",
  "other",
];
