"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { getPendingCount } from "@/lib/api/inbound";

/**
 * The email inbox, as an icon beside the notification bell.
 *
 * It was a sidebar entry first, which was wrong twice over: the sidebar is for
 * places you navigate to on purpose, and this is a thing that happens TO you —
 * documents arrive whether or not you went looking. It also made an already
 * long list longer for something most people open only when the badge says to.
 *
 * Beside the bell it costs nothing when there is nothing waiting, and it is
 * exactly where somebody already looks to find out what happened while they
 * were away.
 *
 * Reads a COUNT, not the queue. The page fetches the documents themselves;
 * a badge that renders one digit has no business pulling a hundred rows of
 * extracted fields on every dashboard load.
 */
export default function InboxBell({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = () => {
      // Nothing to learn from polling a tab nobody is looking at.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      getPendingCount()
        .then((r) => { if (alive) setCount(r.count); })
        .catch(() => { /* no badge rather than a broken header */ });
    };

    read();
    const timer = setInterval(read, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") read(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const buttonBg = isDark
    ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700"
    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50";

  return (
    <button
      onClick={() => router.push("/inbox")}
      title={t("dashboard", "inbTitle")}
      aria-label={t("dashboard", "inbTitle")}
      className={`relative p-2 rounded-lg border transition-colors ${buttonBg}`}
    >
      <Mail className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
