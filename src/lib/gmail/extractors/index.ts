import { extractZooplaLead, type ZooplaLeadData } from "./zoopla";
import { extractRightmoveLead, type RightmoveLeadData } from "./rightmove";

export type LeadData = ZooplaLeadData | RightmoveLeadData;

type ExtractorFn = (body: string) => LeadData | null;

const EXTRACTORS: Record<string, ExtractorFn> = {
  zoopla: extractZooplaLead,
  rightmove: extractRightmoveLead,
};

export function getExtractor(platformName: string): ExtractorFn | null {
  return EXTRACTORS[platformName.toLowerCase()] ?? null;
}
