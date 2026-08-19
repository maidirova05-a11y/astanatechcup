import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/Button";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="section">
      <div className="container-prose flex flex-col items-start gap-6">
        <p className="font-display text-6xl font-extrabold text-brand">404</p>
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("body")}</p>
        <Link href="/" className={buttonClasses({ variant: "solid", size: "lg" })}>
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
