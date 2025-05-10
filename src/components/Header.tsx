import s from "./Header.module.css";

export default function Header() {
  return (
    <header>
      <a className={s.homeLink} href="/">
        <h1>🗃️ Temporary File Host</h1>
      </a>
    </header>
  );
}
