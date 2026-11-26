import { useEffect } from "react";
import { Placeholder } from "../components/Placeholder";
import { Page as LayoutPage } from "../components/layout/Page";
import { pageTitle } from "../config/brand";
export default function Page({ title }: { title: string }) {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
  return (
    <LayoutPage width="narrow">
      <Placeholder title={title} />
    </LayoutPage>
  );
}
