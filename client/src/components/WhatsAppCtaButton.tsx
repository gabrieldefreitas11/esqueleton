import { MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

function buildWhatsAppUrl(number: string, message: string) {
  const cleanNumber = number.replace(/\D/g, "");
  if (!cleanNumber) return null;
  const encodedMessage = encodeURIComponent(message || "Oi! Preciso de ajuda.");
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}

export default function WhatsAppCtaButton() {
  const { data } = trpc.site.settings.useQuery();

  if (!data?.whatsappEnabled) return null;

  const url = buildWhatsAppUrl(data.whatsappNumber || "", data.whatsappMessage || "");
  if (!url) return null;

  const sideClass =
    data.whatsappPosition === "left"
      ? "left-4 sm:left-6"
      : "right-4 sm:right-6";

  const motionClass =
    data.whatsappAnimation === "bounce"
      ? "animate-bounce"
      : data.whatsappAnimation === "pulse"
        ? "animate-pulse"
        : "";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-6 ${sideClass} z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-xl transition-transform hover:scale-105 ${motionClass}`}
      aria-label="Falar no WhatsApp"
    >
      {data.whatsappAnimation !== "none" && (
        <span className="pointer-events-none absolute -inset-1 rounded-full bg-[#25D366]/30 animate-ping" />
      )}
      <MessageCircle className="relative z-10 h-5 w-5" />
      <span className="relative z-10 hidden text-sm font-semibold sm:inline">
        {data.whatsappCtaText || "WhatsApp"}
      </span>
    </a>
  );
}

