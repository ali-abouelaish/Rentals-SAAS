import { requireModule } from "@/modules/guards";

export default async function RoomEnhancerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireModule("room_enhancer");
  return <>{children}</>;
}

