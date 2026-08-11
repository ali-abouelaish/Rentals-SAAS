"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Client shell for the owner detail tabs. Each tab's contents are rendered on
 * the server and handed in as children, so the server work still happens on
 * the server — only the tab switching is client-side.
 */
export function OwnerDetailTabs({
  overview,
  properties,
  statements,
  propertyCount,
  statementCount,
}: {
  overview: React.ReactNode;
  properties: React.ReactNode;
  statements: React.ReactNode;
  propertyCount: number;
  statementCount: number;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="properties">Properties ({propertyCount})</TabsTrigger>
        <TabsTrigger value="statements">Statements ({statementCount})</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="properties">{properties}</TabsContent>
      <TabsContent value="statements">{statements}</TabsContent>
    </Tabs>
  );
}
