import Link from "next/link";
import { EscudoCRSN } from "@/components/icons/EscudoCRSN";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-crsn-gray-bg p-4 overflow-x-hidden w-full max-w-full">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#1B2A5E08_1px,transparent_1px),linear-gradient(to_bottom,#1B2A5E08_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      <Link href="/" className="mb-8 flex items-center gap-3 shrink-0">
        <EscudoCRSN size={48} />
        <h1 className="font-headline text-xl sm:text-2xl uppercase tracking-tight truncate max-w-[90vw]">
          <span className="text-crsn-text-dark">Club de Regatas </span>
          <span className="text-crsn-orange">San Nicolás</span>
        </h1>
      </Link>
      <div className="w-full max-w-full min-w-0 flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}
