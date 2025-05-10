import Page from "./Page";

export default function Contact({
  email = "contact@example.com",
}: {
  email?: string;
}) {
  return (
    <Page>
      <main>
        <h2>✉️ Contact</h2>
        Email <a href={`mailto:${encodeURIComponent(email)}`}>{email}</a>
      </main>
    </Page>
  );
}
