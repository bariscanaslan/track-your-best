declare module "react-google-recaptcha" {
  import * as React from "react";

  export interface ReCAPTCHAProps {
    sitekey: string;
    onChange?: (token: string | null) => void;
    onExpired?: () => void;
    onErrored?: () => void;

    size?: "invisible" | "normal" | "compact";
  }

  export default class ReCAPTCHA extends React.Component<ReCAPTCHAProps> {
    execute(): void;
    executeAsync(): Promise<string | null>;
    reset(): void;
    getValue(): string | null;
  }
}
