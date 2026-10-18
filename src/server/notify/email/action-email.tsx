import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type ActionEmailCopy = {
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  button: string;
  expiry: string;
  ignore: string;
  linkFallback: string;
  footer: string;
};

type ActionEmailProps = { copy: ActionEmailCopy; url: string; lang: string; dir: "ltr" | "rtl" };

// Inline styles: email clients ignore stylesheets. Colors mirror the app tokens
// (ink, paper, saffron) so the email feels like Cooky in every client.
const INK = "#1d2321";
const MUTED = "#55605b";
const SAFFRON = "#e8a317";

/** One layout for every "do one thing" email: confirm, reset, etc. */
export function ActionEmail({ copy, url, lang, dir }: ActionEmailProps) {
  const align = dir === "rtl" ? "right" : "left";
  return (
    <Html lang={lang} dir={dir}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body
        style={{ backgroundColor: "#f7f8f3", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            maxWidth: 520,
            padding: "32px 28px",
            textAlign: align,
          }}
        >
          <Text style={{ color: INK, fontSize: 20, fontWeight: 700, margin: "0 0 24px" }}>Cooky</Text>
          <Heading as="h1" style={{ color: INK, fontSize: 24, lineHeight: "32px", margin: "0 0 16px" }}>
            {copy.heading}
          </Heading>
          <Text style={{ color: INK, fontSize: 16, lineHeight: "24px", margin: "0 0 8px" }}>{copy.greeting}</Text>
          <Text style={{ color: INK, fontSize: 16, lineHeight: "24px", margin: "0 0 24px" }}>{copy.body}</Text>
          <Section style={{ textAlign: align }}>
            <Button
              href={url}
              style={{
                backgroundColor: SAFFRON,
                borderRadius: 12,
                color: INK,
                display: "inline-block",
                fontSize: 16,
                fontWeight: 700,
                padding: "14px 24px",
                textDecoration: "none",
              }}
            >
              {copy.button}
            </Button>
          </Section>
          <Text style={{ color: MUTED, fontSize: 14, lineHeight: "20px", margin: "24px 0 4px" }}>{copy.expiry}</Text>
          <Text style={{ color: MUTED, fontSize: 14, lineHeight: "20px", margin: 0 }}>{copy.ignore}</Text>
          <Hr style={{ borderColor: "#d9ded6", margin: "24px 0" }} />
          <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: "0 0 4px" }}>{copy.linkFallback}</Text>
          <Link href={url} style={{ color: MUTED, fontSize: 12, wordBreak: "break-all" }}>
            {url}
          </Link>
          <Text style={{ color: MUTED, fontSize: 12, lineHeight: "18px", margin: "16px 0 0" }}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
