import { Credits } from "@/components/app/Credits";
import { CONTACT_CHANNELS } from "@/lib/app/links";

export function Contact() {
  return (
    <div className="home">
      <article className="contact">
        <h2>Contact</h2>
        <p className="contact-lead">
          Fan project. The analyzer is local-first: a dropped demo is parsed in your browser and
          never leaves this machine.
        </p>
        <ul className="contact-list">
          {CONTACT_CHANNELS.map((channel) => (
            <li key={channel.href}>
              <a
                className="contact-card"
                href={channel.href}
                {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                <span className="contact-card-label">{channel.label}</span>
                <span className="contact-card-detail">{channel.detail}</span>
                <span className="contact-card-hint muted">{channel.hint}</span>
              </a>
            </li>
          ))}
        </ul>
      </article>
      <Credits />
    </div>
  );
}
