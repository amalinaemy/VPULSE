import {
  InteractionRequiredAuthError,
} from "@azure/msal-browser";

import {
  dataverseUrl,
  loginRequest,
  msalInstance,
} from "../auth/authConfig";


/*
|--------------------------------------------------------------------------
| Get Microsoft / Dataverse access token
|--------------------------------------------------------------------------
*/

export async function getAccessToken(): Promise<string> {

  let account =
    msalInstance.getActiveAccount();

  if (!account) {

    const accounts =
      msalInstance.getAllAccounts();

    if (accounts.length > 0) {
      account = accounts[0];

      msalInstance.setActiveAccount(account);
    }
  }


  /*
   * User has not signed in yet.
   */

  if (!account) {

    await msalInstance.loginRedirect(
      loginRequest
    );

    throw new Error(
      "Redirecting to Microsoft sign-in."
    );
  }


  /*
   * Try getting token silently.
   */

  try {

    const response =
      await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });

    return response.accessToken;

  } catch (error) {

    if (
      error instanceof
      InteractionRequiredAuthError
    ) {

      await msalInstance.acquireTokenRedirect({
        ...loginRequest,
        account,
      });

      throw new Error(
        "Microsoft authentication required."
      );
    }

    throw error;
  }
}


/*
|--------------------------------------------------------------------------
| Generic Dataverse GET
|--------------------------------------------------------------------------
*/

export async function dataverseGet<T>(
  endpoint: string
): Promise<T> {

  const token =
    await getAccessToken();

  const response =
    await fetch(
      `${dataverseUrl}/api/data/v9.2/${endpoint}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          Accept:
            "application/json",

          "OData-MaxVersion":
            "4.0",

          "OData-Version":
            "4.0",
        },
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Dataverse request failed: ` +
      `${response.status} ` +
      `${response.statusText}\n` +
      `${errorText}`
    );
  }


  return response.json();
}


/*
|--------------------------------------------------------------------------
| Generic Dataverse request
|--------------------------------------------------------------------------
*/

export async function dataverseRequest(
  endpoint: string,
  options: RequestInit
): Promise<Response> {

  const token =
    await getAccessToken();

  return fetch(
    `${dataverseUrl}/api/data/v9.2/${endpoint}`,
    {
      ...options,

      headers: {
        Authorization:
          `Bearer ${token}`,

        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        "OData-MaxVersion":
          "4.0",

        "OData-Version":
          "4.0",

        ...options.headers,
      },
    }
  );
}