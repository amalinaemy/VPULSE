# V-PULSE API

## Configure Dataverse for local development

Store the Dataverse application credentials in .NET user secrets. They stay outside the repository.

```bash
dotnet user-secrets set "Dataverse:ConnectionString" "AuthType=ClientSecret;Url=https://org69aa2524.crm5.dynamics.com;ClientId=YOUR-APPLICATION-ID;ClientSecret=YOUR-CLIENT-SECRET;TenantId=YOUR-TENANT-ID"
```

The Entra application needs Dataverse application-user access and read permission for the `cr1da_utilitypoleriskassessment2` table. Start the API with:

```bash
dotnet run --launch-profile http
```

The frontend loads records from `GET /api/dataverse/poles`.
