import { Credits } from "@/components/app/Credits";
import { CONTACT_CHANNELS, type ContactChannelId } from "@/lib/app/links";

function ContactChannelIcon({ id }: { id: ContactChannelId }) {
  switch (id) {
    case "email":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M4 7.2 12 13.2 20 7.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "steam":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="8.1" cy="15.2" r="2.35" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15.3" cy="9.1" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15.3" cy="9.1" r="1.15" fill="currentColor" />
          <path
            d="M10 13.8 13.8 10.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "steam-group":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8.2" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M4.6 17.5c.3-2.6 2.2-4 4.4-4s4.1 1.4 4.4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="16.2" cy="8.6" r="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M14.6 17.5c.2-2 1.6-3.3 3.5-3.3 1.6 0 2.9.9 3.3 2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.523 2 12 2z"
          />
        </svg>
      );
  }
}

export function Contact() {
  return (
    <div className="home">
      <article className="contact">
        <h2>Contact</h2>
        <ul className="contact-list">
          {CONTACT_CHANNELS.map((channel) => (
            <li key={channel.href}>
              <a
                className="contact-card"
                href={channel.href}
                {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                <span className="contact-card-icon">
                  <ContactChannelIcon id={channel.id} />
                </span>
                <h3 className="contact-card-label">{channel.label}</h3>
              </a>
            </li>
          ))}
        </ul>
      </article>
      <Credits />
    </div>
  );
}
