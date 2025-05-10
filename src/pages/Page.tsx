import { PropsWithChildren } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import s from "./Page.module.css";

export default function Page({ children }: PropsWithChildren) {
  return (
    <div className={s.page}>
      <Header />
      <div className={s.content}>{children}</div>
      <Footer />
    </div>
  );
}
