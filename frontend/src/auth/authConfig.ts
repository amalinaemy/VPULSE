import { PublicClientApplication } from "@azure/msal-browser";

export const dataverseUrl =
  import.meta.env.VITE_DATAVERSE_URL;

const clientId =
  import.meta.env.VITE_ENTRA_CLIENT_ID;

const tenantId =
  import.meta.env.VITE_ENTRA_TENANT_ID;

if (!clientId || !tenantId || !dataverseUrl) {
  throw new Error(
    "Microsoft/Dataverse environment variables are missing."
  );
}

export const msalInstance =
  new PublicClientApplication({
    auth: {
      clientId,

      authority:
        `https://login.microsoftonline.com/${tenantId}`,

      redirectUri:
        window.location.origin,

      postLogoutRedirectUri:
        window.location.origin,
    },

    cache: {
      cacheLocation: "sessionStorage",
    },
  });

export const loginRequest = {
  scopes: [
    `${dataverseUrl}/user_impersonation`,
  ],
};