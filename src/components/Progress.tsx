import s from "./Progress.module.css";

interface Props {
  value: number;
}

export default function Progress({ value }: Props) {
  return (
    <div className={s.progress}>
      <progress value={value}>{`${Math.floor(value * 100)}%`}</progress>
      {Math.floor(value * 100)}%
    </div>
  );
}
