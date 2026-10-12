import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/Button";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="section">
      <div className="container-prose flex flex-col items-start gap-5">
        <p className="font-display text-5xl font-extrabold leading-none text-brand">404</p>
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="max-w-[36rem] text-base leading-relaxed text-muted md:text-lg">{t("body")}</p>
        <Link href="/" className={buttonClasses({ variant: "solid", size: "lg", className: "mt-2" })}>
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
