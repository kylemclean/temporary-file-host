import s from "./Footer.module.css";

export default function Footer() {
  return (
    <footer>
      <ul className={s.list}>
        <li>
          <a href="/">Home</a>
        </li>
        <li>
          <a href="/contact">Contact</a>
        </li>
      </ul>
    </footer>
  );
}
