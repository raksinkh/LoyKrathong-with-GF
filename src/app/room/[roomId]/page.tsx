import { Suspense } from "react";
import { RoomClient } from "@/components/RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#060918] text-sm text-amber-100">
          กำลังเปิดท่าน้ำใต้แสงจันทร์...
        </main>
      }
    >
      <RoomClient roomId={roomId} />
    </Suspense>
  );
}
