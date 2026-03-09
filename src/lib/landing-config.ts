export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#solutions", label: "Solutions" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
] as const;

export const TRUST_STRIP = [
  "Branded client portals",
  "Subdomain-based access",
  "Centralized management",
  "Built to scale",
] as const;

export const FEATURES = [
  {
    title: "Custom subdomains for every client",
    description:
      "Each client gets a dedicated subdomain (e.g. acme.harborops.co.uk) for a branded, professional experience.",
    icon: "Globe",
  },
  {
    title: "White-label portal experience",
    description:
      "Portals are fully branded to your business. Your logo, colors, and domain—no third-party branding.",
    icon: "Palette",
  },
  {
    title: "Central dashboard to manage all tenants",
    description:
      "One place to onboard clients, assign access, and monitor activity across every portal.",
    icon: "LayoutDashboard",
  },
  {
    title: "Role-based access and permissions",
    description:
      "Control who sees what. Define roles and permissions per client or per user with fine-grained access.",
    icon: "Shield",
  },
  {
    title: "Real-time operational visibility",
    description:
      "See activity, tasks, and status across all client workspaces from a single operations view.",
    icon: "Activity",
  },
  {
    title: "Scalable multi-tenant architecture",
    description:
      "Add new clients without scaling headaches. Harbor is built for many tenants and high availability.",
    icon: "Layers",
  },
  {
    title: "Secure document and workflow handling",
    description:
      "Store and share documents securely. Support approvals, workflows, and audit trails where needed.",
    icon: "FileCheck",
  },
  {
    title: "Fast onboarding for new clients",
    description:
      "Launch a new client portal in minutes. No lengthy setup—get from signup to live subdomain quickly.",
    icon: "Zap",
  },
] as const;

export const SOLUTIONS = [
  {
    title: "Letting agencies",
    description:
      "Give each landlord or tenant a branded portal for applications, documents, and communications—all on your subdomains.",
  },
  {
    title: "Fleet operators",
    description:
      "Per-client or per-driver portals for compliance, documents, and reporting with centralized oversight.",
  },
  {
    title: "Recruitment businesses",
    description:
      "Client portals for hiring managers and candidates. Keep placements and contracts in one place per client.",
  },
  {
    title: "Service agencies",
    description:
      "White-label client spaces for project status, deliverables, and billing—scaled across many accounts.",
  },
  {
    title: "Operations teams",
    description:
      "Internal and external stakeholders get the right access. One platform, many workspaces, full control.",
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Onboard your business",
    description: "Set up your account, branding, and default settings. We guide you through configuration.",
  },
  {
    step: 2,
    title: "Create client workspaces",
    description: "Add clients and configure their portal. Assign roles and customize what they see.",
  },
  {
    step: 3,
    title: "Launch branded subdomains",
    description: "Each client gets a live subdomain (e.g. clientname.harborops.co.uk) in minutes.",
  },
  {
    step: 4,
    title: "Manage all operations from one place",
    description: "Switch between tenants, view activity, and control access from your central dashboard.",
  },
] as const;

export const PRICING_TIERS = [
  {
    name: "Starter",
    description: "For small teams getting started",
    features: [
      "Custom branding",
      "Up to 3 subdomains",
      "5 portal workspaces",
      "2 admin users",
      "Email support",
    ],
    cta: "Get started",
    highlighted: false,
    price: "Contact us",
  },
  {
    name: "Growth",
    description: "For growing teams and more clients",
    features: [
      "Custom branding",
      "Up to 15 subdomains",
      "25 portal workspaces",
      "10 admin users",
      "Priority support",
    ],
    cta: "Contact sales",
    highlighted: false,
    price: "Custom pricing",
  },
  {
    name: "Enterprise",
    description: "For scale and full control",
    features: [
      "Full white-label",
      "Unlimited subdomains",
      "Unlimited workspaces",
      "Unlimited admin users",
      "Dedicated support & SLA",
    ],
    cta: "Book a demo",
    highlighted: true,
    price: "Custom pricing",
  },
] as const;

export const SUBDOMAIN_EXAMPLES = [
  "acme.harborops.co.uk",
  "truehold.harborops.co.uk",
  "client.harborops.co.uk",
] as const;
