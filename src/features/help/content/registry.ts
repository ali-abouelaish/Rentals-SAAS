import type { HelpArticle } from "../domain/types";
// General fallback
import { generalArticle } from "./general";
// Shared
import { dashboardArticle } from "./dashboard";
import { meArticle } from "./me";
// Rental Agency module
import { earningsArticle } from "./earnings";
import { clientsArticle } from "./clients";
import { leadsArticle } from "./leads";
import { rentalsArticle } from "./rentals";
import { landlordsArticle } from "./landlords";
import { bonusesArticle } from "./bonuses";
import { invoicesArticle } from "./invoices";
import { roomEnhancerArticle } from "./room-enhancer";
import { agentsArticle } from "./agents";
import { billingProfilesArticle } from "./billing-profiles";
import { billingInfoArticle } from "./billing-info";
import { apiKeysArticle } from "./api-keys";
import { upgradeArticle } from "./upgrade";
// Property Management module
import { inboxArticle } from "./inbox";
import { propertiesArticle } from "./properties";
import { propertiesNewArticle } from "./properties-new";
import { bookingsArticle } from "./bookings";
import { tenantsArticle } from "./tenants";
import { contractsArticle } from "./contracts";
import { contractTemplatesArticle } from "./contract-templates";
import { profitabilityArticle } from "./profitability";
import { financesArticle } from "./finances";
import { assistantArticle } from "./assistant";
import { rentCollectionArticle } from "./rent-collection";
import { rentStatementsArticle } from "./rent-statements";
import { maintenanceArticle } from "./maintenance";
import { keysArticle } from "./keys";
import { acquisitionInsightsArticle } from "./acquisition-insights";
import { marketingArticle } from "./marketing";
import { sharesArticle } from "./shares";
import { settingsBookingFormsArticle } from "./settings-booking-forms";
import { settingsBankDetailsArticle } from "./settings-bank-details";
import { teamArticle } from "./team";
import { depositsTdsArticle } from "./deposits-tds";
// Generic Forms module
import { formsArticle } from "./forms";
import { formsBuilderArticle } from "./forms-builder";

/**
 * Every authored help guide. Order is not significant — the route matcher in
 * `lib/matchRoute.ts` resolves the right article by exact match then longest
 * prefix, falling back to the `general` article (route "/") which matches any
 * page. Because a fallback always exists, the Help button shows on every page
 * inside the app shell (it is hidden only on the super admin panel, which has
 * no top bar).
 */
export const HELP_ARTICLES: HelpArticle[] = [
  // General fallback
  generalArticle,
  // Shared
  dashboardArticle,
  meArticle,
  // Rental Agency module
  earningsArticle,
  clientsArticle,
  leadsArticle,
  rentalsArticle,
  landlordsArticle,
  bonusesArticle,
  invoicesArticle,
  roomEnhancerArticle,
  agentsArticle,
  billingProfilesArticle,
  billingInfoArticle,
  apiKeysArticle,
  upgradeArticle,
  // Property Management module
  inboxArticle,
  propertiesArticle,
  propertiesNewArticle,
  bookingsArticle,
  tenantsArticle,
  contractsArticle,
  contractTemplatesArticle,
  profitabilityArticle,
  financesArticle,
  assistantArticle,
  rentCollectionArticle,
  rentStatementsArticle,
  maintenanceArticle,
  keysArticle,
  acquisitionInsightsArticle,
  marketingArticle,
  sharesArticle,
  settingsBookingFormsArticle,
  settingsBankDetailsArticle,
  teamArticle,
  depositsTdsArticle,
  // Generic Forms module
  formsArticle,
  formsBuilderArticle,
];
