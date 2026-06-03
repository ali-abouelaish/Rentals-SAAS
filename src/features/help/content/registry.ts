import type { HelpArticle } from "../domain/types";
import { inboxArticle } from "./inbox";
import { propertiesArticle } from "./properties";
import { propertiesNewArticle } from "./properties-new";
import { bookingsArticle } from "./bookings";
import { tenantsArticle } from "./tenants";
import { contractsArticle } from "./contracts";
import { profitabilityArticle } from "./profitability";
import { rentCollectionArticle } from "./rent-collection";
import { rentStatementsArticle } from "./rent-statements";
import { maintenanceArticle } from "./maintenance";
import { keysArticle } from "./keys";
import { acquisitionInsightsArticle } from "./acquisition-insights";
import { marketingArticle } from "./marketing";
import { sharesArticle } from "./shares";
import { settingsBookingFormsArticle } from "./settings-booking-forms";
import { settingsBankDetailsArticle } from "./settings-bank-details";

/**
 * Every authored help guide. Order is not significant — the route matcher in
 * `lib/matchRoute.ts` resolves the right article by exact match then longest
 * prefix. All articles cover Property Management module routes, which is what
 * scopes the Help button to PM pages.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  inboxArticle,
  propertiesArticle,
  propertiesNewArticle,
  bookingsArticle,
  tenantsArticle,
  contractsArticle,
  profitabilityArticle,
  rentCollectionArticle,
  rentStatementsArticle,
  maintenanceArticle,
  keysArticle,
  acquisitionInsightsArticle,
  marketingArticle,
  sharesArticle,
  settingsBookingFormsArticle,
  settingsBankDetailsArticle,
];
