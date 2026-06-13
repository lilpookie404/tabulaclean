import type { PropsWithChildren } from "react";

type PageContainerProps = PropsWithChildren<{
  className?: string;
}>;

export default function PageContainer({
  children,
  className
}: PageContainerProps) {
  const classes = ["page-container", className].filter(Boolean).join(" ");

  return <div className={classes}>{children}</div>;
}
