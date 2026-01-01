import { cn } from "@/lib/utils";

interface DisclaimerProps {
  title?: string;
  description?: string;
  icon?: string;
  className?: string;
}

const DEFAULT_TEXT = "This platform is for anonymous feedback. Your identity is protected and will not be disclosed. It is part of an experimental student project and is not the official feedback portal used by RC4. We do not guarantee that your feedback or concerns are immediately addressed. This tool is designed to improve NUS community experience and is not a crisis service.";

export function Disclaimer({
  title = "Disclaimer",
  description = DEFAULT_TEXT,
  icon = "ℹ️",
  className,
}: DisclaimerProps) {
  return (
    <div className={cn("spill-disclaimer-shell", className)}>
        <div className="text-lg" aria-hidden>
            {icon}
        </div>
        <div>
            <h3 className="font-semibold mb-1 text-sm">{title}</h3>
            <p className="spill-disclaimer">{description}</p>
        </div>
    </div>
  );
}

export default Disclaimer;
