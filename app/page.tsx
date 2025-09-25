import dynamic from "next/dynamic";
import { headers } from "next/headers";

import UI from "@/components/ui/UI";

const Canvas = dynamic(() => import("../components/Canvas"), {
  loading: () => (
    <div className="absolute animate-pulse inset-0 flex items-center justify-center text-white/30">
      <p>Loading...</p>
    </div>
  ),
});

const isMobileServer = async () => {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent");
  return !!userAgent?.includes("Mobile");
};

export default async function Home() {
  const isMobile = await isMobileServer();

  return (
    <main className="w-full bg-black h-lvh overflow-hidden">
      <Canvas isMobile={isMobile} />
      <UI isMobile={isMobile} />
    </main>
  );
}
