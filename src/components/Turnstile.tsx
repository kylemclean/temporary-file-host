import ReactTurnstile from "react-turnstile";
import s from "./Turnstile.module.css";

export default function Turnstile({
  id = "cf-turnstile",
  setToken,
}: {
  id?: string;
  setToken: (token: string) => void;
}) {
  if (id === "turnstile") throw new Error("id cannot be 'turnstile'");

  return (
    <div className={s.turnstileContainer}>
      <ReactTurnstile
        id={id}
        sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
        onVerify={setToken}
      />
    </div>
  );
}
