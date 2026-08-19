"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * Route-level error boundary.
 *
 * The user is shown a generic message and a retry. `error.message` is
 * deliberately NOT rendered: in a production build Next already digests server
 * errors, and echoing an exception string to the page is how stack details and
 * occasionally user input leak into a screenshot posted in a support chat.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    // The digest is the server-side correlation id — safe to log, and it is
    // what lets an organiser's report be matched to a server log line.
    console.error("route_error", { digest: error.digest });
  }, [error]);

  return (
    <div className="section">
      <div className="container-prose flex flex-col items-start gap-6">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("body")}</p>
        {error.digest && (
          <p className="font-mono text-xs text-subtle">ID: {error.digest}</p>
        )}
        <Button variant="solid" size="lg" onClick={reset}>
          {t("cta")}
        </Button>
      </div>
    </div>
  );
}
