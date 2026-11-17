/** Presentation stories only. These forms are never connected to an auth action. */
import {
  LoginView,
  type LoginViewProps,
} from "../../../components/auth/LoginView";
import { ProviderButton } from "../../../components/auth/ProviderButton";
import {
  OAUTH_PROVIDERS,
  loginErrorMessage,
} from "../../../lib/auth/providers";

const states = [
  "signed-out",
  "member",
  "not-invited",
  "signin-error",
  "email-error",
  "invite-error",
  "unavailable",
  "pending",
] as const;
export type LoginFixture = (typeof states)[number];
export const loginFixtures = states;
export function LoginFixtureView({ name }: { name: LoginFixture }) {
  const error =
    name === "signin-error"
      ? "signin"
      : name === "email-error"
        ? "email"
        : name === "invite-error"
          ? "invite"
          : null;
  const viewer: LoginViewProps["viewer"] =
    name === "member"
      ? {
          status: "member",
          email: "example.member@example.test",
          displayName: "Example Member",
        }
      : name === "not-invited"
        ? { status: "not_member" }
        : { status: "anonymous" };
  return (
    <LoginView
      configured={name !== "unavailable"}
      viewer={viewer}
      error={loginErrorMessage(error)}
      providerForms={OAUTH_PROVIDERS.map((provider) => (
        <form key={provider.id}>
          <input name="provider" type="hidden" value={provider.id} />
          <input name="next" type="hidden" value="/library?scope=mine" />
          <ProviderButton
            provider={provider.id}
            label={provider.label}
            pending={name === "pending"}
          />
        </form>
      ))}
    />
  );
}
