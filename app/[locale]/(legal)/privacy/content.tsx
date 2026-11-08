import { List, Section } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

// Draft text for review by an Israeli privacy lawyer (docs/legal-review.md).
// Keep the Hebrew and English versions saying the same thing.

const email = <span dir="ltr">{LEGAL.contactEmail}</span>;

export function PrivacyHe() {
  return (
    <>
      <Section title="על המדיניות הזו">
        <p>
          Patient Control (״השירות״) מופעל על ידי {LEGAL.operator.he}. השירות
          הוא תוכנה למטפלים עצמאיים לניהול מטופלים, תורים וסיכומי טיפול.
          המדיניות מסבירה איזה מידע אנחנו מטפלים בו, למה ואיך הוא מוגן.
        </p>
      </Section>

      <Section title="שני סוגי מידע">
        <List
          items={[
            <>
              <strong>מידע על המטפלים שנרשמים לשירות</strong> – לגביו אנחנו
              קובעים את מטרות השימוש.
            </>,
            <>
              <strong>מידע על מטופלים</strong> שהקליניקה מזינה, או שמטופלים
              שולחים בדף הזימון – הקליניקה היא בעלת המאגר והאחראית עליו, ואנחנו
              מחזיקים ומעבדים אותו רק בשמה וכדי לספק לה את השירות. מטופלים
              שרוצים לעיין במידע עליהם, לתקן או למחוק אותו, מתבקשים לפנות ישירות
              לקליניקה. נעזור לקליניקה להשיב לבקשה.
            </>,
          ]}
        />
      </Section>

      <Section title="איזה מידע נאסף">
        <List
          items={[
            <>
              <strong>מטפלים:</strong> שם, מייל, סיסמה (נשמרת רק כגיבוב), סוד
              האימות הדו־שלבי, שם הקליניקה וכתובתה, ההגדרות, ורישומי התחברות
              (מועד, כתובת IP ודפדפן).
            </>,
            <>
              <strong>מטופלים (בשם הקליניקה):</strong> שם, טלפון, מייל, תאריך
              לידה, מספר תעודת זהות, רקע רפואי, הערות חשובות, סוגי טיפול, תורים,
              סיכומי טיפול, שפה מועדפת והסכמה לתזכורות.
            </>,
            <>
              <strong>מבקרים בדף הזימון:</strong> הפרטים שהם ממלאים, ובדיקה
              טכנית שמזהה רובוטים (Vercel BotID).
            </>,
          ]}
        />
      </Section>

      <Section title="למה אנחנו משתמשים במידע">
        <p>
          רק כדי לספק את השירות ולאבטח אותו: התחברות, יומן ורשומות, זימון תורים,
          ושליחת מיילים (אימות כתובת, אישורי תורים ותזכורות). כל צפייה בכרטיס
          מטופל נרשמת ביומן פעולות. איננו משתמשים במידע לפרסום, איננו מוכרים
          אותו, איננו בונים ממנו פרופילים ואיננו מאמנים עליו מודלים של בינה
          מלאכותית.
        </p>
      </Section>

      <Section title="מי מעבד את המידע עבורנו">
        <List
          items={[
            <>
              <strong>Vercel</strong> – אחסון השירות, ב{LEGAL.hostingRegion.he}.
            </>,
            <>
              <strong>Neon</strong> – מסד הנתונים, ב{LEGAL.hostingRegion.he}.
            </>,
            <>
              <strong>Resend</strong> – שליחת מיילים. המיילים כוללים שם, שם
              הקליניקה ומועד התור, ולעולם לא מידע רפואי.
            </>,
          ]}
        />
      </Section>

      <Section title="איך המידע מוגן">
        <List
          items={[
            "כל התקשורת מוצפנת (HTTPS).",
            "מספר תעודת הזהות, הרקע הרפואי, ההערות החשובות וסיכומי הטיפול מוצפנים (AES-256) לפני שהם נשמרים.",
            "אימות דו־שלבי חובה לכל מטפל, והתנתקות אוטומטית אחרי 12 שעות.",
            "כל קליניקה רואה רק את המידע שלה, וכל צפייה בכרטיס מטופל נרשמת.",
            "אנשי הצוות שלנו ניגשים למידע רק כשזה נדרש לתפעול, לתמיכה שהתבקשה או לפי חוק.",
          ]}
        />
      </Section>

      <Section title="כמה זמן המידע נשמר">
        <p>
          המידע נשמר כל עוד החשבון קיים. מטפלים יכולים לייצא את כל המידע בכל עת
          ולמחוק את החשבון. המחיקה מסירה את המידע מיד מהמערכת, ועותקים בגיבויים
          נדרסים בתוך {LEGAL.backupRetentionDays} ימים. ייתכן שהחוק מחייב את
          הקליניקה לשמור רשומות רפואיות לאורך שנים; האחריות לייצא ולשמור אותן
          לפני מחיקה היא של הקליניקה.
        </p>
      </Section>

      <Section title="עוגיות">
        <p>
          אנחנו משתמשים רק בעוגיות הכרחיות: עוגיית התחברות ועוגייה ששומרת את
          השפה. אין עוגיות סטטיסטיקה או פרסום.
        </p>
      </Section>

      <Section title="הזכויות שלך">
        <p>
          לפי חוק הגנת הפרטיות, התשמ״א–1981, אפשר לבקש לעיין במידע עליך ולבקש
          לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן. מטפלים יכולים
          לפנות אלינו בכתובת {email}. מטופלים מתבקשים לפנות לקליניקה שלהם.
        </p>
      </Section>

      <Section title="שינויים ויצירת קשר">
        <p>
          על שינויים מהותיים במדיניות נודיע למטפלים במייל לפני שייכנסו לתוקף.
          לשאלות: {email}.
        </p>
      </Section>
    </>
  );
}

export function PrivacyEn() {
  return (
    <>
      <Section title="About this policy">
        <p>
          Patient Control (“the Service”) is operated by {LEGAL.operator.en}. It
          is software for independent practitioners to manage patients,
          appointments and treatment summaries. This policy explains what
          information we handle, why, and how it is protected.
        </p>
      </Section>

      <Section title="Two kinds of information">
        <List
          items={[
            <>
              <strong>Information about practitioners</strong> who sign up – we
              decide how it is used.
            </>,
            <>
              <strong>Information about patients</strong> that a clinic enters,
              or that patients send through a booking page – the clinic owns and
              is responsible for it, and we hold and process it only on the
              clinic’s behalf, to provide the Service. Patients who want to see,
              correct or delete their information should contact their clinic.
              We’ll help the clinic answer.
            </>,
          ]}
        />
      </Section>

      <Section title="What we collect">
        <List
          items={[
            <>
              <strong>Practitioners:</strong> name, email, password (stored only
              as a hash), the two-step verification secret, clinic name and
              address, settings, and sign-in records (time, IP address and
              browser).
            </>,
            <>
              <strong>Patients (on the clinic’s behalf):</strong> name, phone,
              email, date of birth, ID number, medical background, important
              notes, treatment types, appointments, treatment summaries,
              preferred language and reminder consent.
            </>,
            <>
              <strong>Booking page visitors:</strong> the details they enter,
              and a technical bot check (Vercel BotID).
            </>,
          ]}
        />
      </Section>

      <Section title="How we use it">
        <p>
          Only to provide and secure the Service: signing in, the calendar and
          records, online booking, and emails (address verification, booking
          confirmations and reminders). Every view of a patient card is recorded
          in an audit log. We don’t use the information for advertising, sell
          it, build profiles from it, or train AI models on it.
        </p>
      </Section>

      <Section title="Who processes it for us">
        <List
          items={[
            <>
              <strong>Vercel</strong> – hosting, in {LEGAL.hostingRegion.en}.
            </>,
            <>
              <strong>Neon</strong> – the database, in {LEGAL.hostingRegion.en}.
            </>,
            <>
              <strong>Resend</strong> – sending emails. Emails contain a name,
              the clinic’s name and the appointment time, never medical
              information.
            </>,
          ]}
        />
      </Section>

      <Section title="How it is protected">
        <List
          items={[
            "All traffic is encrypted (HTTPS).",
            "ID numbers, medical background, important notes and treatment summaries are encrypted (AES-256) before they are stored.",
            "Two-step verification is required for every practitioner, with automatic sign-out after 12 hours.",
            "Each clinic sees only its own information, and every view of a patient card is recorded.",
            "Our staff access information only when needed to operate the Service, for support you asked for, or when the law requires it.",
          ]}
        />
      </Section>

      <Section title="How long it is kept">
        <p>
          Information is kept while the account exists. Practitioners can export
          everything at any time and delete their account. Deleting removes the
          information from the Service immediately, and copies in backups are
          overwritten within {LEGAL.backupRetentionDays} days. The law may
          require a clinic to keep medical records for years; exporting and
          keeping them before deleting is the clinic’s responsibility.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use only essential cookies: one that keeps you signed in and one
          that remembers your language. There are no analytics or advertising
          cookies.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the Israeli Privacy Protection Law, 1981, you can ask to see the
          information about you, and ask to correct or delete information that
          is incorrect, incomplete, unclear or out of date. Practitioners can
          contact us at {email}. Patients should contact their clinic.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We’ll email practitioners about material changes to this policy before
          they take effect. Questions: {email}.
        </p>
      </Section>
    </>
  );
}
