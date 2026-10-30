import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";

const NotFound = () => {
  const location = useLocation();
  const { lang, dir } = useLanguage();
  const ar = lang === "ar";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen jood-ambient flex items-center justify-center p-4" dir={dir}>
      <div className="glass rounded-2xl px-8 py-10 text-center max-w-sm w-full">
        <p className="font-mono text-5xl font-bold text-jood-gold-600 dark:text-jood-gold-300 mb-3">404</p>
        <h1 className="font-arabic text-xl font-bold text-foreground mb-2">
          {ar ? "هذه الصفحة غير موجودة" : "This page doesn't exist"}
        </h1>
        <p className="font-arabic text-sm text-muted-foreground mb-6">
          {ar ? "ربما تغيّر الرابط أو حُذفت الصفحة." : "The link may have changed or the page was removed."}
        </p>
        <Link to="/" className="jood-btn-primary">
          {ar ? "العودة للرئيسية" : "Back to home"}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
