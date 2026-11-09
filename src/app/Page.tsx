import { useEffect } from "react";
import { Placeholder } from "../components/Placeholder";
export default function Page({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | Payment Project`;
  }, [title]);
  return <Placeholder title={title} />;
}
