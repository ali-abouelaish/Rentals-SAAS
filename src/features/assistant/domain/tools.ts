import type OpenAI from "openai";

/**
 * The fixed catalog of read-only tools the assistant may call. Each name maps to
 * a wrapper in ../data/dispatch.ts that calls an existing tenant-scoped data
 * function (RLS isolates the tenant). Keep this list and the dispatch table in
 * lockstep — `ToolName` is derived from the catalog.
 *
 * Money convention: every wrapper normalises monetary values to GBP (pounds)
 * before returning, so all amounts the model sees are already in pounds.
 */
export const ASSISTANT_TOOLS = [
  // ── Properties & units ───────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_properties",
      description:
        "List properties (buildings/flats). Optionally filter by portfolio id or area. Each property can contain multiple units (rooms).",
      parameters: {
        type: "object",
        properties: {
          portfolioId: { type: "string", description: "Filter to a portfolio id (resolve names via list_portfolios first)." },
          area: { type: "string", description: "Filter by area name." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_property",
      description: "Get one property by id, including its portfolio and owner landlord.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_units",
      description:
        "Search/list units (rooms). Filter by status, unit type, room type, availability date range and price (GBP). Returns at most 20 rows.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Match room number or property address." },
          statuses: {
            type: "array",
            items: { type: "string", enum: ["available", "occupied", "move_out", "booked", "on_hold", "renewal", "replacement"] },
            description: "Filter by one or more unit statuses. Use ['available'] for vacant rooms.",
          },
          unitTypes: { type: "array", items: { type: "string", enum: ["room", "studio", "whole_flat"] } },
          roomTypes: { type: "array", items: { type: "string", enum: ["single", "double", "master", "ensuite"] } },
          availableFrom: { type: "string", description: "Available date >= this ISO date (YYYY-MM-DD)." },
          availableTo: { type: "string", description: "Available date <= this ISO date (YYYY-MM-DD)." },
          minPrice: { type: "number", description: "Minimum price per month in GBP." },
          maxPrice: { type: "number", description: "Maximum price per month in GBP." },
          page: { type: "number", description: "1-based page number (page size is 20)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_units_by_property",
      description: "List all units (rooms) belonging to one property.",
      parameters: {
        type: "object",
        properties: { propertyId: { type: "string" } },
        required: ["propertyId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_occupancy_snapshot",
      description:
        "Portfolio-wide counts of units grouped by status (available, occupied, etc.) plus an occupancy rate. Use this for 'how many vacant rooms' style questions instead of paging units.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_portfolios",
      description: "List portfolios (property groupings). Use to resolve a portfolio name to its id.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_owner_landlords",
      description: "List owner landlords (the people/entities the agency rents properties from / pays rent to).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },

  // ── pm_tenants & contracts ───────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_pm_tenants",
      description:
        "List property tenants (the occupants renting units). 'tenant' in a user question means one of these. Optional name/email/phone search.",
      parameters: {
        type: "object",
        properties: { search: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pm_tenant",
      description: "Get one property tenant by id with their current unit, current contract and guarantors.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pm_tenant_contract_history",
      description: "Get the full contract history for one property tenant.",
      parameters: {
        type: "object",
        properties: { pmTenantId: { type: "string" } },
        required: ["pmTenantId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_contracts",
      description:
        "List tenancy contracts. Filter by status, deposit protection, portfolio or a free-text search over tenant/property.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "sent", "signed", "active", "notice_given", "terminated"] },
          depositProtected: { type: "string", enum: ["yes", "no"], description: "yes = deposit has a protected date; no = not protected." },
          portfolioId: { type: "string" },
          search: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contract",
      description: "Get one tenancy contract by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // ── Rent & finances ──────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_arrears_summary",
      description:
        "Summary of rent arrears across active tenancies: how many are in arrears, total arrears (GBP) and the top tenants by arrears. Use for 'who is behind on rent' questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rent_collection",
      description:
        "Per active tenancy: expected vs paid rent to date, arrears (GBP), whether the current month is paid, and last payment date. Returns at most 20 rows (highest arrears first).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_finance_rollup",
      description:
        "Monthly profit & loss for a given month: rent expected/received/outstanding, property costs, owner rent, admin overheads, vacancy loss and net profit (all GBP), plus a per-portfolio breakdown AND a per-property breakdown (byProperty: each property's rent/costs/net profit, sorted most-profitable-first). Use byProperty to answer 'which property is most/least profitable' or 'which property am I losing most on' — never estimate per-property figures yourself.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          month: { type: "number", description: "1-12" },
        },
        required: ["year", "month"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tenant_charges",
      description: "List recurring tenant charges (extra income billed on top of rent), with the tenant/property context.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_month_close_status",
      description: "Whether a finance month is open or closed, and who closed it.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          month: { type: "number", description: "1-12" },
        },
        required: ["year", "month"],
        additionalProperties: false,
      },
    },
  },

  // ── Bookings & leads ─────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_bookings",
      description: "List inbound rental applications (bookings). Filter by status, submitted-date range, or search. Returns at most 20 rows.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "under_review", "approved", "rejected"] },
          dateFrom: { type: "string", description: "Submitted on/after this ISO date." },
          dateTo: { type: "string", description: "Submitted on/before this ISO date." },
          search: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_booking",
      description: "Get one booking (application) by id, including its form responses.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_leads",
      description: "List inbound portal leads. Filter by status, source or search. Returns one page (15) at a time.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string", description: "Lead status, or 'all'." },
          source: { type: "string", description: "Lead source, or 'all'." },
          page: { type: "number", description: "1-based page." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead_stats",
      description: "Quick lead stats: count received today, total new leads, and when the last lead arrived.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
] as const satisfies readonly OpenAI.Chat.Completions.ChatCompletionTool[];

export type ToolName = (typeof ASSISTANT_TOOLS)[number]["function"]["name"];
