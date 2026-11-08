import Link from "next/link";
import { List, Section } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

// Draft text for review by an Israeli privacy lawyer (docs/legal-review.md).
// Keep the Hebrew and English versions saying the same thing.

const email = <span dir="ltr">{LEGAL.contactEmail}</span>;

export function TermsHe() {
  return (
    <>
      <Section title="השירות">
        <p>
          Patient Control (״השירות״) מופעל על ידי {LEGAL.operator.he}, ומיועד
          למטפלים עצמאיים בישראל לניהול מטופלים, תורים וסיכומי טיפול. השימוש
          בשירות מותנה בתנאים האלה וב
          <Link href="/he/privacy" className="underline underline-offset-4">
            מדיניות הפרטיות
          </Link>
          . השירות ניתן כרגע ללא תשלום, בשלב גישה מוקדמת.
        </p>
      </Section>

      <Section title="החשבון שלך">
        <List
          items={[
            "יש לשמור על הסיסמה ועל המכשיר של האימות הדו־שלבי, ולא לשתף אותם.",
            "את/ה אחראי/ת לכל פעולה שנעשית בחשבון.",
            `אם יש חשד לגישה לא מורשית, יש להודיע לנו מיד בכתובת ${LEGAL.contactEmail}.`,
          ]}
        />
      </Section>

      <Section title="המידע על המטופלים שלך">
        <List
          items={[
            "את/ה בעל/ת המאגר והאחראי/ת למידע שמוזן לשירות: לבסיס החוקי לאיסוף, להסכמת המטופלים כשנדרשת (למשל לתזכורות), ולדיוק המידע.",
            "את/ה אחראי/ת לחובות המקצועיות שלך, כולל שמירת רשומות רפואיות לתקופה שהחוק דורש, ומענה לבקשות של מטופלים לעיין במידע עליהם.",
            "השירות אינו תחליף לשיקול דעת מקצועי ואינו מיועד למצבי חירום.",
          ]}
        />
      </Section>

      <Section title="התפקיד שלנו">
        <p>
          אנחנו מחזיקים ומעבדים את המידע על המטופלים רק בשמך ולפי מדיניות
          הפרטיות. איננו ניגשים אליו אלא כשזה נדרש לתפעול השירות, לאבטחתו,
          לתמיכה שביקשת, או לפי חוק.
        </p>
      </Section>

      <Section title="שימוש מותר">
        <p>
          אסור להשתמש בשירות בניגוד לחוק, לנסות לגשת למידע של קליניקות אחרות,
          לעקוף את מנגנוני האבטחה, להעמיס על השירות או לאסוף ממנו מידע באופן
          אוטומטי.
        </p>
      </Section>

      <Section title="זמינות ושינויים בשירות">
        <p>
          השירות ניתן ״כמות שהוא״. אנו עשויים לשנות או להפסיק תכונות. אם נחליט
          להפסיק את השירות, נודיע מראש ונאפשר זמן סביר לייצוא המידע.
        </p>
      </Section>

      <Section title="ייצוא, מחיקה והשעיה">
        <p>
          אפשר לייצא את כל המידע ולמחוק את החשבון בכל עת מדף ההגדרות. אנו רשאים
          להשעות חשבון שמפר את התנאים; ככל שהחוק מאפשר, נאפשר קודם לייצא את
          המידע.
        </p>
      </Section>

      <Section title="אחריות">
        <p>
          ככל שהחוק מתיר, איננו אחראים לנזק עקיף או תוצאתי, לאובדן רווחים או
          לאובדן מידע שנגרם משימוש בשירות.
        </p>
      </Section>

      <Section title="דין וסמכות שיפוט">
        <p>
          על התנאים חל הדין הישראלי, וסמכות השיפוט הייחודית נתונה לבתי המשפט
          המוסמכים בתל אביב–יפו.
        </p>
      </Section>

      <Section title="שינויים בתנאים ויצירת קשר">
        <p>
          על שינויים מהותיים נודיע במייל לפני שייכנסו לתוקף. לשאלות: {email}.
        </p>
      </Section>
    </>
  );
}

export function TermsEn() {
  return (
    <>
      <Section title="The Service">
        <p>
          Patient Control (“the Service”) is operated by {LEGAL.operator.en} for
          independent practitioners in Israel to manage patients, appointments
          and treatment summaries. Using it is subject to these terms and to the{" "}
          <Link href="/en/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          . The Service is currently free of charge, in early access.
        </p>
      </Section>

      <Section title="Your account">
        <List
          items={[
            "Keep your password and your two-step verification device safe, and don’t share them.",
            "You are responsible for everything done with your account.",
            `If you suspect unauthorized access, tell us right away at ${LEGAL.contactEmail}.`,
          ]}
        />
      </Section>

      <Section title="Your patients’ information">
        <List
          items={[
            "You own the database and are responsible for the information you enter: the legal basis for collecting it, patients’ consent where needed (for example for reminders), and its accuracy.",
            "You are responsible for your professional obligations, including keeping medical records for as long as the law requires and answering patients’ requests to see their information.",
            "The Service doesn’t replace professional judgment and isn’t meant for emergencies.",
          ]}
        />
      </Section>

      <Section title="Our role">
        <p>
          We hold and process your patients’ information only on your behalf and
          as the privacy policy describes. We don’t access it except as needed
          to operate or secure the Service, for support you asked for, or when
          the law requires it.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Don’t use the Service unlawfully, try to access other clinics’
          information, get around its security, overload it, or collect
          information from it automatically.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          The Service is provided “as is”. We may change or remove features. If
          we decide to shut the Service down, we’ll tell you in advance and give
          you reasonable time to export your information.
        </p>
      </Section>

      <Section title="Export, deletion and suspension">
        <p>
          You can export all your information and delete your account at any
          time from Settings. We may suspend an account that breaches these
          terms; where the law allows, we’ll let you export your information
          first.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the extent the law allows, we are not liable for indirect or
          consequential damage, lost profits or lost information arising from
          using the Service.
        </p>
      </Section>

      <Section title="Law and jurisdiction">
        <p>
          These terms are governed by Israeli law, and the competent courts in
          Tel Aviv–Jaffa have exclusive jurisdiction.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We’ll email you about material changes before they take effect.
          Questions: {email}.
        </p>
      </Section>
    </>
  );
}
